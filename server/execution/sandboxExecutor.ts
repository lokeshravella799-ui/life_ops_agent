import type {
  CheckoutPreparation,
  BookingPreparation,
  AnyPreparation,
} from './types';
import type {
  SandboxExecutionResult,
  SandboxOrder,
  SandboxBusBooking,
  SandboxHotelBooking,
  SandboxFlightBooking,
  SandboxBooking,
  SandboxReceipt,
  ExecutionAuditEvent,
} from './sandboxTypes';
import { confirmationGate } from './confirmationGate';
import { AuditReceiptGenerator } from './auditReceipt';
import { InputValidator } from './inputValidator';
import { logger } from '../utils/logger';

export class SandboxExecutor {
  // Store completed executions for strict idempotency
  private completedExecutions: Map<string, SandboxExecutionResult> = new Map();
  // Concurrency guard: in-flight execution promises
  private inFlightExecutions: Map<string, Promise<SandboxExecutionResult>> = new Map();
  // Audit log of execution lifecycle events
  private auditEvents: ExecutionAuditEvent[] = [];

  /**
   * Helper to generate deterministic simulated sandbox IDs
   */
  private generateSandboxId(type: string, executionId: string): string {
    // Generate deterministic 8-character hex code from executionId
    let hash = 0;
    for (let i = 0; i < executionId.length; i++) {
      hash = (hash << 5) - hash + executionId.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }
    const hex = Math.abs(hash).toString(16).toUpperCase().padStart(8, '0').slice(-8);

    switch (type) {
      case 'PRODUCT_ORDER':
        return `SANDBOX-ORD-${hex}`;
      case 'BUS_BOOKING':
        return `SANDBOX-BUS-${hex}`;
      case 'HOTEL_BOOKING':
        return `SANDBOX-HOTEL-${hex}`;
      case 'FLIGHT_BOOKING':
        return `SANDBOX-FLT-${hex}`;
      default:
        return `SANDBOX-GEN-${hex}`;
    }
  }

  /**
   * Records an audit event safely with no credentials leaked
   */
  logAuditEvent(event: ExecutionAuditEvent): void {
    // Thoroughly clean metadata of any potential secrets
    const sanitizedMetadata: Record<string, any> = {};
    const prohibited = [
      'card',
      'cvv',
      'cvc',
      'pin',
      'password',
      'otp',
      'upi_pin',
      'upipin',
      'atm_pin',
      'atmpin',
      'banking_password',
      'bankpassword',
      'netbanking',
      'token',
      'secret',
      'account_number',
    ];

    if (event.metadata && typeof event.metadata === 'object') {
      for (const [k, v] of Object.entries(event.metadata)) {
        const kLower = k.toLowerCase();
        if (prohibited.some((p) => kLower.includes(p))) {
          continue;
        }
        if (typeof v === 'string') {
          const digitsOnly = v.replace(/[^0-9]/g, '');
          if (digitsOnly.length >= 13 && digitsOnly.length <= 19 && /\b(?:\d[ -]*?){13,19}\b/.test(v)) {
            continue;
          }
        }
        sanitizedMetadata[k] = v;
      }
    }

    const safeEvent: ExecutionAuditEvent = {
      ...event,
      metadata: sanitizedMetadata,
    };

    this.auditEvents.push(safeEvent);
    logger.info(`[AUDIT] Execution event: ${event.eventType}`, {
      executionId: event.executionId,
      type: event.type,
      status: event.status,
    });
  }

  recordAuditEvent(event: ExecutionAuditEvent): void {
    this.logAuditEvent(event);
  }

  getAuditEvents(): ExecutionAuditEvent[] {
    return [...this.auditEvents];
  }

  /**
   * Main entry point to execute any prepared transaction in sandbox mode
   */
  async execute(executionId: string, options?: any): Promise<SandboxExecutionResult> {
    // 1. Strict Idempotency Check: Already completed execution
    if (this.completedExecutions.has(executionId)) {
      const prevResult = this.completedExecutions.get(executionId)!;
      this.logAuditEvent({
        eventType: 'DUPLICATE_EXECUTION_BLOCKED',
        executionId,
        type: prevResult.type || 'PRODUCT_ORDER',
        status: 'DUPLICATE',
        timestamp: new Date().toISOString(),
      });

      logger.warn('Duplicate execution attempt blocked', { executionId });
      return {
        ...prevResult,
        status: 'DUPLICATE',
        isDuplicate: true,
        message: `Duplicate execution blocked. Transaction "${executionId}" has already been executed. Returning original receipt.`,
      };
    }

    // 2. Concurrency Lock: Check if already in-flight
    if (this.inFlightExecutions.has(executionId)) {
      logger.warn('Concurrent duplicate execution detected, joining existing execution', { executionId });
      // Await in-flight promise and return as duplicate
      const originalResult = await this.inFlightExecutions.get(executionId)!;
      this.logAuditEvent({
        eventType: 'DUPLICATE_EXECUTION_BLOCKED',
        executionId,
        type: originalResult.type || 'PRODUCT_ORDER',
        status: 'DUPLICATE',
        timestamp: new Date().toISOString(),
      });
      return {
        ...originalResult,
        status: 'DUPLICATE',
        isDuplicate: true,
        message: `Concurrent execution blocked. Transaction "${executionId}" was already being processed.`,
      };
    }

    // Create execution task promise for concurrency locking
    const executionPromise = this.performExecution(executionId, options);
    this.inFlightExecutions.set(executionId, executionPromise);

    try {
      const result = await executionPromise;
      if (result.success) {
        this.completedExecutions.set(executionId, result);
      }
      return result;
    } finally {
      this.inFlightExecutions.delete(executionId);
    }
  }

  /**
   * Core internal execution with full validation pipeline
   */
  private async performExecution(executionId: string, options?: any): Promise<SandboxExecutionResult> {
    // Check security of input options
    if (options && !InputValidator.validateNonFinancialPayload(options)) {
      this.logAuditEvent({
        eventType: 'EXECUTION_FAILED',
        executionId,
        type: 'PRODUCT_ORDER',
        status: 'FAILED',
        timestamp: new Date().toISOString(),
      });
      return {
        success: false,
        status: 'FAILED',
        executionId,
        error: 'Security violation: Prohibited financial credentials detected in execution options.',
        message: 'LifeOps Agent never accepts or stores financial credentials (cards, CVV, UPI PIN, OTP, banking passwords).',
      };
    }

    // 1. Validation: Execution exists
    const confirmationState = confirmationGate.getConfirmationState(executionId);
    if (!confirmationState) {
      this.logAuditEvent({
        eventType: 'EXECUTION_FAILED',
        executionId,
        type: 'PRODUCT_ORDER',
        status: 'FAILED',
        timestamp: new Date().toISOString(),
      });
      return {
        success: false,
        status: 'FAILED',
        executionId,
        error: `Execution preparation "${executionId}" does not exist.`,
        message: 'No active transaction preparation was found matching this execution identifier.',
      };
    }

    const prep: AnyPreparation = confirmationState.preparation;

    // 2. Validation: Execution status must be explicitly CONFIRMED
    if (confirmationState.status === 'CANCELLED') {
      this.logAuditEvent({
        eventType: 'EXECUTION_FAILED',
        executionId,
        type: prep.type,
        status: 'CANCELLED',
        timestamp: new Date().toISOString(),
      });
      return {
        success: false,
        status: 'CANCELLED',
        executionId,
        type: prep.type,
        error: `Cannot execute cancelled preparation "${executionId}".`,
        message: 'This transaction preparation was previously cancelled and cannot be executed.',
      };
    }

    if (confirmationState.status !== 'CONFIRMED') {
      this.logAuditEvent({
        eventType: 'EXECUTION_FAILED',
        executionId,
        type: prep.type,
        status: 'NOT_EXECUTED',
        timestamp: new Date().toISOString(),
      });
      return {
        success: false,
        status: 'NOT_EXECUTED',
        executionId,
        type: prep.type,
        error: `Execution "${executionId}" is not confirmed. Current status: "${confirmationState.status}".`,
        message: 'Explicit user confirmation is strictly required before executing any sandbox transaction.',
      };
    }

    // 3. Validation: Expiry check
    if (prep.expiresAt) {
      const expiryTimestamp = Date.parse(prep.expiresAt);
      if (!isNaN(expiryTimestamp) && Date.now() > expiryTimestamp) {
        this.logAuditEvent({
          eventType: 'EXECUTION_FAILED',
          executionId,
          type: prep.type,
          status: 'FAILED',
          timestamp: new Date().toISOString(),
        });
        return {
          success: false,
          status: 'FAILED',
          executionId,
          type: prep.type,
          error: `Execution preparation "${executionId}" has expired.`,
          message: 'The quote or inventory reservation has expired. A fresh search and preparation is required.',
        };
      }
    }

    // 4. Validation: Item was verified
    if (!prep.verification || prep.verification.status !== 'VERIFIED') {
      this.logAuditEvent({
        eventType: 'EXECUTION_FAILED',
        executionId,
        type: prep.type,
        status: 'FAILED',
        timestamp: new Date().toISOString(),
      });
      return {
        success: false,
        status: 'FAILED',
        executionId,
        type: prep.type,
        error: `Item verification failed or is unverified. Current verification status: "${prep.verification?.status || 'UNKNOWN'}".`,
        message: 'Unverified items cannot proceed to sandbox execution. Provider verification is required.',
      };
    }

    // 5. Validation: Item is available
    if (
      prep.item.availability === 'UNAVAILABLE' ||
      prep.item.verification?.availability === 'UNAVAILABLE'
    ) {
      this.logAuditEvent({
        eventType: 'EXECUTION_FAILED',
        executionId,
        type: prep.type,
        status: 'FAILED',
        timestamp: new Date().toISOString(),
      });
      return {
        success: false,
        status: 'FAILED',
        executionId,
        type: prep.type,
        error: `Selected item "${prep.item.title}" is currently unavailable.`,
        message: 'The selected item is out of stock or unavailable from the provider.',
      };
    }

    // 6. Validation: Required preparation data exists
    if (!prep.item || !prep.provider || !prep.costBreakdown) {
      this.logAuditEvent({
        eventType: 'EXECUTION_FAILED',
        executionId,
        type: prep.type,
        status: 'FAILED',
        timestamp: new Date().toISOString(),
      });
      return {
        success: false,
        status: 'FAILED',
        executionId,
        type: prep.type,
        error: 'Malformed preparation: Missing required item, provider, or cost breakdown data.',
        message: 'The transaction preparation is incomplete and cannot be executed.',
      };
    }

    // START EXECUTION LIFECYCLE
    this.logAuditEvent({
      eventType: 'EXECUTION_STARTED',
      executionId,
      type: prep.type,
      status: 'PROCESSING',
      timestamp: new Date().toISOString(),
    });

    const confirmationTimestamp = confirmationState.confirmedAt || new Date().toISOString();

    // Delegate to specific simulated execution handlers
    switch (prep.type) {
      case 'PRODUCT_ORDER':
        return this.executeProductOrder(prep as CheckoutPreparation, confirmationTimestamp);
      case 'BUS_BOOKING':
        return this.executeBusBooking(prep as BookingPreparation, confirmationTimestamp);
      case 'HOTEL_BOOKING':
        return this.executeHotelBooking(prep as BookingPreparation, confirmationTimestamp);
      case 'FLIGHT_BOOKING':
        return this.executeFlightBooking(prep as BookingPreparation, confirmationTimestamp);
      default:
        this.logAuditEvent({
          eventType: 'EXECUTION_FAILED',
          executionId,
          type: (prep as any).type,
          status: 'FAILED',
          timestamp: new Date().toISOString(),
        });
        return {
          success: false,
          status: 'FAILED',
          executionId,
          error: `Unsupported execution type: "${(prep as any).type}".`,
          message: 'The requested transaction type is not supported by the sandbox executor.',
        };
    }
  }

  /**
   * Simulates a product order in sandbox
   */
  async executeProductOrder(
    prep: CheckoutPreparation,
    confirmationTimestamp: string = new Date().toISOString()
  ): Promise<SandboxExecutionResult> {
    const sandboxOrderId = this.generateSandboxId('PRODUCT_ORDER', prep.executionId);
    const simulatedAt = new Date().toISOString();

    const order: SandboxOrder = {
      sandbox: true,
      type: 'PRODUCT_ORDER',
      executionId: prep.executionId,
      sandboxOrderId,
      status: 'COMPLETED',
      item: {
        id: prep.item.id,
        title: prep.item.title,
        price: prep.item.price,
        specifications: prep.item.specifications,
      },
      provider: {
        id: prep.provider.id,
        name: prep.provider.name,
        url: prep.provider.url || prep.provider.productUrl,
      },
      delivery: prep.delivery,
      costBreakdown: prep.costBreakdown,
      simulatedAt,
      message: 'Sandbox order simulated successfully. No real order was placed.',
    };

    const receipt: SandboxReceipt = AuditReceiptGenerator.generateReceipt(
      order,
      confirmationTimestamp,
      simulatedAt
    );

    this.logAuditEvent({
      eventType: 'EXECUTION_COMPLETED',
      executionId: prep.executionId,
      type: 'PRODUCT_ORDER',
      status: 'COMPLETED',
      timestamp: simulatedAt,
      metadata: { sandboxOrderId, total: prep.costBreakdown.total },
    });

    return {
      success: true,
      status: 'COMPLETED',
      executionId: prep.executionId,
      sandboxExecutionId: sandboxOrderId,
      type: 'PRODUCT_ORDER',
      order,
      receipt,
      message: order.message,
    };
  }

  /**
   * Simulates a bus booking in sandbox
   */
  async executeBusBooking(
    prep: BookingPreparation,
    confirmationTimestamp: string = new Date().toISOString()
  ): Promise<SandboxExecutionResult> {
    const bookingId = this.generateSandboxId('BUS_BOOKING', prep.executionId);
    const simulatedAt = new Date().toISOString();

    const booking: SandboxBusBooking = {
      sandbox: true,
      type: 'BUS_BOOKING',
      executionId: prep.executionId,
      bookingId,
      status: 'COMPLETED',
      operator: prep.bookingDetails?.operator || prep.item.title,
      source: prep.itinerary?.source,
      destination: prep.itinerary?.destination,
      departure: prep.itinerary?.departureTime || prep.bookingDetails?.departureTime,
      arrival: prep.itinerary?.arrivalTime || prep.bookingDetails?.arrivalTime,
      busType: prep.bookingDetails?.seatType,
      seatInformation: prep.passengers?.map((p) => p.seatNumber || 'Standard Seat').filter(Boolean),
      passengerInformation: prep.passengers,
      costBreakdown: prep.costBreakdown,
      provider: {
        id: prep.provider.id,
        name: prep.provider.name,
        url: prep.provider.url || prep.provider.bookingUrl,
      },
      simulatedAt,
      message: 'Sandbox bus booking simulated successfully. No real ticket was booked.',
    };

    const receipt: SandboxReceipt = AuditReceiptGenerator.generateReceipt(
      booking,
      confirmationTimestamp,
      simulatedAt
    );

    this.logAuditEvent({
      eventType: 'EXECUTION_COMPLETED',
      executionId: prep.executionId,
      type: 'BUS_BOOKING',
      status: 'COMPLETED',
      timestamp: simulatedAt,
      metadata: { bookingId, total: prep.costBreakdown.total },
    });

    return {
      success: true,
      status: 'COMPLETED',
      executionId: prep.executionId,
      sandboxExecutionId: bookingId,
      type: 'BUS_BOOKING',
      booking,
      receipt,
      message: booking.message,
    };
  }

  /**
   * Simulates a hotel booking in sandbox
   */
  async executeHotelBooking(
    prep: BookingPreparation,
    confirmationTimestamp: string = new Date().toISOString()
  ): Promise<SandboxExecutionResult> {
    const bookingId = this.generateSandboxId('HOTEL_BOOKING', prep.executionId);
    const simulatedAt = new Date().toISOString();

    const booking: SandboxHotelBooking = {
      sandbox: true,
      type: 'HOTEL_BOOKING',
      executionId: prep.executionId,
      bookingId,
      status: 'COMPLETED',
      hotel: prep.stayDetails?.hotelName || prep.item.title,
      room: prep.stayDetails?.roomType || prep.itinerary?.roomType,
      checkIn: prep.stayDetails?.checkIn || prep.itinerary?.checkInDate,
      checkOut: prep.stayDetails?.checkOut || prep.itinerary?.checkOutDate,
      guests: prep.guests,
      costBreakdown: prep.costBreakdown,
      cancellationInformation: prep.cancellationPolicy,
      provider: {
        id: prep.provider.id,
        name: prep.provider.name,
        url: prep.provider.url || prep.provider.bookingUrl,
      },
      simulatedAt,
      message: 'Sandbox hotel booking simulated successfully. No real reservation was created.',
    };

    const receipt: SandboxReceipt = AuditReceiptGenerator.generateReceipt(
      booking,
      confirmationTimestamp,
      simulatedAt
    );

    this.logAuditEvent({
      eventType: 'EXECUTION_COMPLETED',
      executionId: prep.executionId,
      type: 'HOTEL_BOOKING',
      status: 'COMPLETED',
      timestamp: simulatedAt,
      metadata: { bookingId, total: prep.costBreakdown.total },
    });

    return {
      success: true,
      status: 'COMPLETED',
      executionId: prep.executionId,
      sandboxExecutionId: bookingId,
      type: 'HOTEL_BOOKING',
      booking,
      receipt,
      message: booking.message,
    };
  }

  /**
   * Simulates a flight booking in sandbox
   */
  async executeFlightBooking(
    prep: BookingPreparation,
    confirmationTimestamp: string = new Date().toISOString()
  ): Promise<SandboxExecutionResult> {
    const bookingId = this.generateSandboxId('FLIGHT_BOOKING', prep.executionId);
    const simulatedAt = new Date().toISOString();

    const booking: SandboxFlightBooking = {
      sandbox: true,
      type: 'FLIGHT_BOOKING',
      executionId: prep.executionId,
      bookingId,
      status: 'COMPLETED',
      airline: prep.flightDetails?.airline || prep.item.title,
      flightNumber: prep.flightDetails?.flightNumber,
      origin: prep.flightDetails?.origin || prep.itinerary?.source,
      destination: prep.flightDetails?.destination || prep.itinerary?.destination,
      departure: prep.flightDetails?.departureTime || prep.itinerary?.departureTime,
      arrival: prep.flightDetails?.arrivalTime || prep.itinerary?.arrivalTime,
      cabin: prep.flightDetails?.cabinClass,
      passengerInformation: prep.passengers,
      costBreakdown: prep.costBreakdown,
      provider: {
        id: prep.provider.id,
        name: prep.provider.name,
        url: prep.provider.url || prep.provider.bookingUrl,
      },
      simulatedAt,
      message: 'Sandbox flight booking simulated successfully. No real ticket was issued.',
    };

    const receipt: SandboxReceipt = AuditReceiptGenerator.generateReceipt(
      booking,
      confirmationTimestamp,
      simulatedAt
    );

    this.logAuditEvent({
      eventType: 'EXECUTION_COMPLETED',
      executionId: prep.executionId,
      type: 'FLIGHT_BOOKING',
      status: 'COMPLETED',
      timestamp: simulatedAt,
      metadata: { bookingId, total: prep.costBreakdown.total },
    });

    return {
      success: true,
      status: 'COMPLETED',
      executionId: prep.executionId,
      sandboxExecutionId: bookingId,
      type: 'FLIGHT_BOOKING',
      booking,
      receipt,
      message: booking.message,
    };
  }

  clear(): void {
    this.completedExecutions.clear();
    this.inFlightExecutions.clear();
    this.auditEvents = [];
  }
}

export const sandboxExecutor = new SandboxExecutor();
