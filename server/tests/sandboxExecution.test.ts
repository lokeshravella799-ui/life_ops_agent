import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  ExecutionPreparer,
  confirmationGate,
  sandboxExecutor,
  AuditReceiptGenerator,
} from '../execution';
import type { SelectedItem } from '../execution/types';

describe('LifeOps Phase 2 Step 6: Checkout / Booking Execution Sandbox', () => {
  beforeEach(() => {
    confirmationGate.clear();
    sandboxExecutor.clear();
  });

  const createVerifiedProduct = (id: string = 'prod-test-1'): SelectedItem => ({
    id,
    title: 'ASUS ROG Strix G16 Gaming Laptop',
    category: 'Electronics > Laptops',
    price: {
      amount: 64999,
      currency: 'INR',
    },
    provider: {
      id: 'mock_omnistore',
      name: 'OmniStore Electronics',
      url: 'https://omnistore.example.com/item/1',
    },
    availability: 'AVAILABLE',
    verification: {
      status: 'VERIFIED',
      verifiedAt: new Date().toISOString(),
      priceVerified: true,
      availabilityVerified: true,
      providerVerified: true,
      urlVerified: true,
      freshness: 'FRESH',
    },
  });

  const createVerifiedBus = (id: string = 'bus-test-1'): SelectedItem => ({
    id,
    title: 'Zingbus Sleeper 2+1 (Hyderabad -> Bangalore)',
    category: 'Transit > Bus',
    price: {
      amount: 1450,
      currency: 'INR',
    },
    provider: {
      id: 'mock_smarttransit',
      name: 'SmartTransit Express',
      url: 'https://smarttransit.example.com/route/1',
    },
    availability: 'AVAILABLE',
    verification: {
      status: 'VERIFIED',
      verifiedAt: new Date().toISOString(),
      priceVerified: true,
      availabilityVerified: true,
      providerVerified: true,
      urlVerified: true,
      freshness: 'FRESH',
    },
  });

  const createVerifiedHotel = (id: string = 'hotel-test-1'): SelectedItem => ({
    id,
    title: 'Taj Krishna Luxury Suite, Hyderabad',
    category: 'Hospitality > Hotel',
    price: {
      amount: 12500,
      currency: 'INR',
    },
    provider: {
      id: 'mock_horizonstays',
      name: 'HorizonStays Worldwide',
      url: 'https://horizonstays.example.com/hotel/1',
    },
    availability: 'AVAILABLE',
    verification: {
      status: 'VERIFIED',
      verifiedAt: new Date().toISOString(),
      priceVerified: true,
      availabilityVerified: true,
      providerVerified: true,
      urlVerified: true,
      freshness: 'FRESH',
    },
  });

  const createVerifiedFlight = (id: string = 'flight-test-1'): SelectedItem => ({
    id,
    title: 'IndiGo 6E-204 (DEL -> BLR)',
    category: 'Aviation > Flight',
    price: {
      amount: 5800,
      currency: 'INR',
    },
    provider: {
      id: 'mock_skyroutes',
      name: 'SkyRoutes Air Portal',
      url: 'https://skyroutes.example.com/flight/1',
    },
    availability: 'AVAILABLE',
    verification: {
      status: 'VERIFIED',
      verifiedAt: new Date().toISOString(),
      priceVerified: true,
      availabilityVerified: true,
      providerVerified: true,
      urlVerified: true,
      freshness: 'FRESH',
    },
  });

  // TEST 1: Product sandbox execution
  test('TEST 1: Product sandbox execution completes with valid simulation', async () => {
    const item = createVerifiedProduct('prod-101');
    const prepRes = ExecutionPreparer.prepareProductOrder(
      item,
      { name: 'John Doe', email: 'john@example.com', phone: '9876543210' },
      { recipientName: 'John Doe', addressLine1: 'Road 12, Banjara Hills', city: 'Hyderabad', state: 'Telangana', postalCode: '500034', country: 'India' }
    );
    assert.equal(prepRes.success, true);
    confirmationGate.registerPreparation(prepRes.preparation!);
    confirmationGate.confirm(prepRes.preparation!.executionId);

    const execRes = await sandboxExecutor.execute(prepRes.preparation!.executionId);
    assert.equal(execRes.success, true);
    assert.equal(execRes.status, 'COMPLETED');
    assert.equal(execRes.type, 'PRODUCT_ORDER');
    assert.ok(execRes.order);
    assert.equal(execRes.order!.sandbox, true);
    assert.match(execRes.order!.sandboxOrderId, /^SANDBOX-ORD-[A-F0-9]{8}$/);
    assert.equal(execRes.order!.message, 'Sandbox order simulated successfully. No real order was placed.');
  });

  // TEST 2: Bus sandbox execution
  test('TEST 2: Bus sandbox execution completes with route and passenger details', async () => {
    const bus = createVerifiedBus('bus-102');
    const prepRes = ExecutionPreparer.prepareBusBooking(
      bus,
      [{ name: 'Jane Doe', age: 28, gender: 'Female', seatNumber: '12U' }]
    );
    assert.equal(prepRes.success, true);
    confirmationGate.registerPreparation(prepRes.preparation!);
    confirmationGate.confirm(prepRes.preparation!.executionId);

    const execRes = await sandboxExecutor.execute(prepRes.preparation!.executionId);
    assert.equal(execRes.success, true);
    assert.equal(execRes.status, 'COMPLETED');
    assert.equal(execRes.type, 'BUS_BOOKING');
    assert.ok(execRes.booking);
    assert.match(execRes.booking!.bookingId, /^SANDBOX-BUS-[A-F0-9]{8}$/);
    assert.equal(execRes.booking!.message, 'Sandbox bus booking simulated successfully. No real ticket was booked.');
  });

  // TEST 3: Hotel sandbox execution
  test('TEST 3: Hotel sandbox execution completes with room and guest details', async () => {
    const hotel = createVerifiedHotel('hotel-103');
    const prepRes = ExecutionPreparer.prepareHotelBooking(
      hotel,
      { primaryGuestName: 'Alex Smith', numberOfGuests: 2, numberOfRooms: 1 }
    );
    assert.equal(prepRes.success, true);
    confirmationGate.registerPreparation(prepRes.preparation!);
    confirmationGate.confirm(prepRes.preparation!.executionId);

    const execRes = await sandboxExecutor.execute(prepRes.preparation!.executionId);
    assert.equal(execRes.success, true);
    assert.equal(execRes.status, 'COMPLETED');
    assert.equal(execRes.type, 'HOTEL_BOOKING');
    assert.ok(execRes.booking);
    assert.match(execRes.booking!.bookingId, /^SANDBOX-HOTEL-[A-F0-9]{8}$/);
    assert.equal(execRes.booking!.message, 'Sandbox hotel booking simulated successfully. No real reservation was created.');
  });

  // TEST 4: Flight sandbox execution
  test('TEST 4: Flight sandbox execution completes with flight itinerary', async () => {
    const flight = createVerifiedFlight('flight-104');
    const prepRes = ExecutionPreparer.prepareFlightBooking(
      flight,
      [{ name: 'David Miller', age: 35, gender: 'Male', seatNumber: '4A' }]
    );
    assert.equal(prepRes.success, true);
    confirmationGate.registerPreparation(prepRes.preparation!);
    confirmationGate.confirm(prepRes.preparation!.executionId);

    const execRes = await sandboxExecutor.execute(prepRes.preparation!.executionId);
    assert.equal(execRes.success, true);
    assert.equal(execRes.status, 'COMPLETED');
    assert.equal(execRes.type, 'FLIGHT_BOOKING');
    assert.ok(execRes.booking);
    assert.match(execRes.booking!.bookingId, /^SANDBOX-FLT-[A-F0-9]{8}$/);
    assert.equal(execRes.booking!.message, 'Sandbox flight booking simulated successfully. No real ticket was issued.');
  });

  // TEST 5: Execution requires confirmation
  test('TEST 5: Execution requires confirmation before proceeding', async () => {
    const item = createVerifiedProduct('prod-105');
    const prepRes = ExecutionPreparer.prepareProductOrder(item, undefined, undefined, { skipDeliveryCheck: true });
    confirmationGate.registerPreparation(prepRes.preparation!);

    // Do NOT call confirm
    const execRes = await sandboxExecutor.execute(prepRes.preparation!.executionId);
    assert.equal(execRes.success, false);
    assert.equal(execRes.status, 'NOT_EXECUTED');
    assert.match(execRes.error!, /not confirmed/i);
  });

  // TEST 6: Unconfirmed execution is rejected
  test('TEST 6: Unconfirmed execution is rejected without generating orders', async () => {
    const item = createVerifiedProduct('prod-106');
    const prepRes = ExecutionPreparer.prepareProductOrder(item, undefined, undefined, { skipDeliveryCheck: true });
    confirmationGate.registerPreparation(prepRes.preparation!);

    const state = confirmationGate.getConfirmationState(prepRes.preparation!.executionId);
    assert.equal(state?.status, 'AWAITING_CONFIRMATION');

    const execRes = await sandboxExecutor.execute(prepRes.preparation!.executionId);
    assert.equal(execRes.success, false);
    assert.equal(execRes.order, undefined);
    assert.equal(execRes.receipt, undefined);
  });

  // TEST 7: Cancelled execution is rejected
  test('TEST 7: Cancelled execution is rejected', async () => {
    const item = createVerifiedProduct('prod-107');
    const prepRes = ExecutionPreparer.prepareProductOrder(item, undefined, undefined, { skipDeliveryCheck: true });
    confirmationGate.registerPreparation(prepRes.preparation!);
    confirmationGate.cancel(prepRes.preparation!.executionId, 'User changed mind');

    const execRes = await sandboxExecutor.execute(prepRes.preparation!.executionId);
    assert.equal(execRes.success, false);
    assert.equal(execRes.status, 'CANCELLED');
    assert.match(execRes.error!, /cancelled/i);
  });

  // TEST 8: Expired execution is rejected
  test('TEST 8: Expired execution is rejected', async () => {
    const item = createVerifiedProduct('prod-108');
    const prepRes = ExecutionPreparer.prepareProductOrder(item, undefined, undefined, { skipDeliveryCheck: true });
    // Force expiration
    prepRes.preparation!.expiresAt = new Date(Date.now() - 60000).toISOString();
    confirmationGate.registerPreparation(prepRes.preparation!);
    // Confirmation Gate will catch expiration
    const confirmRes = confirmationGate.confirm(prepRes.preparation!.executionId);
    assert.equal(confirmRes.success, false);

    const execRes = await sandboxExecutor.execute(prepRes.preparation!.executionId);
    assert.equal(execRes.success, false);
    assert.match(execRes.error!, /(expired|not confirmed)/i);
  });

  // TEST 9: Unverified item is rejected
  test('TEST 9: Unverified item is rejected from sandbox execution', async () => {
    const item = createVerifiedProduct('prod-109');
    item.verification = {
      status: 'UNVERIFIED',
      verifiedAt: new Date().toISOString(),
      priceVerified: false,
      availabilityVerified: false,
      providerVerified: false,
      urlVerified: false,
      freshness: 'FRESH',
    };
    const prepRes = ExecutionPreparer.prepareProductOrder(item, undefined, undefined, { skipDeliveryCheck: true });
    assert.equal(prepRes.success, false);
    assert.match(prepRes.error!, /(verified|unverified)/i);
  });

  // TEST 10: Unavailable item is rejected
  test('TEST 10: Unavailable item is rejected from sandbox execution', async () => {
    const item = createVerifiedProduct('prod-110');
    item.availability = 'UNAVAILABLE';
    const prepRes = ExecutionPreparer.prepareProductOrder(item, undefined, undefined, { skipDeliveryCheck: true });
    assert.equal(prepRes.success, false);
    assert.match(prepRes.error!, /unavailable/i);
  });

  // TEST 11: Successful execution generates sandbox ID
  test('TEST 11: Successful execution generates unique, correctly prefixed simulated sandbox ID', async () => {
    const item = createVerifiedProduct('prod-111');
    const prepRes = ExecutionPreparer.prepareProductOrder(item, undefined, undefined, { skipDeliveryCheck: true });
    confirmationGate.registerPreparation(prepRes.preparation!);
    confirmationGate.confirm(prepRes.preparation!.executionId);

    const execRes = await sandboxExecutor.execute(prepRes.preparation!.executionId);
    assert.equal(execRes.success, true);
    assert.match(execRes.sandboxExecutionId!, /^SANDBOX-ORD-[A-F0-9]{8}$/);
    assert.ok(!execRes.sandboxExecutionId!.includes('AMZN'));
    assert.ok(!execRes.sandboxExecutionId!.includes('FLIP'));
  });

  // TEST 12: Receipt is generated
  test('TEST 12: Receipt is generated upon successful sandbox execution', async () => {
    const item = createVerifiedProduct('prod-112');
    const prepRes = ExecutionPreparer.prepareProductOrder(item, undefined, undefined, { skipDeliveryCheck: true });
    confirmationGate.registerPreparation(prepRes.preparation!);
    confirmationGate.confirm(prepRes.preparation!.executionId);

    const execRes = await sandboxExecutor.execute(prepRes.preparation!.executionId);
    assert.equal(execRes.success, true);
    assert.ok(execRes.receipt);
    assert.match(execRes.receipt!.receiptId, /^SANDBOX-RCP-/);
    assert.equal(execRes.receipt!.executionId, prepRes.preparation!.executionId);
    assert.equal(execRes.receipt!.sandboxExecutionId, execRes.sandboxExecutionId);
  });

  // TEST 13: Receipt preserves cost breakdown
  test('TEST 13: Receipt preserves cost breakdown and totals', async () => {
    const item = createVerifiedProduct('prod-113');
    const prepRes = ExecutionPreparer.prepareProductOrder(item, undefined, undefined, { skipDeliveryCheck: true });
    confirmationGate.registerPreparation(prepRes.preparation!);
    confirmationGate.confirm(prepRes.preparation!.executionId);

    const execRes = await sandboxExecutor.execute(prepRes.preparation!.executionId);
    assert.equal(execRes.success, true);
    const rcp = execRes.receipt!;
    assert.equal(rcp.costBreakdown.total, prepRes.preparation!.costBreakdown.total);
    assert.equal(rcp.total, prepRes.preparation!.costBreakdown.total);
    assert.equal(rcp.currency, 'INR');
    assert.ok(rcp.costBreakdown.basePrice > 0);
  });

  // TEST 14: Receipt identifies provider
  test('TEST 14: Receipt identifies provider accurately', async () => {
    const item = createVerifiedProduct('prod-114');
    const prepRes = ExecutionPreparer.prepareProductOrder(item, undefined, undefined, { skipDeliveryCheck: true });
    confirmationGate.registerPreparation(prepRes.preparation!);
    confirmationGate.confirm(prepRes.preparation!.executionId);

    const execRes = await sandboxExecutor.execute(prepRes.preparation!.executionId);
    assert.equal(execRes.success, true);
    assert.equal(execRes.receipt!.provider.id, 'mock_omnistore');
    assert.ok(execRes.receipt!.provider.name.includes('OmniStore'));
  });


  // TEST 15: Receipt explicitly identifies sandbox status
  test('TEST 15: Receipt explicitly identifies sandbox status and safety disclaimer', async () => {
    const item = createVerifiedProduct('prod-115');
    const prepRes = ExecutionPreparer.prepareProductOrder(item, undefined, undefined, { skipDeliveryCheck: true });
    confirmationGate.registerPreparation(prepRes.preparation!);
    confirmationGate.confirm(prepRes.preparation!.executionId);

    const execRes = await sandboxExecutor.execute(prepRes.preparation!.executionId);
    assert.equal(execRes.success, true);
    assert.equal(execRes.receipt!.sandbox, true);
    assert.equal(
      execRes.receipt!.safetyStatement,
      'No real payment was processed and no real order or booking was created.'
    );
  });

  // TEST 16: Duplicate execution is prevented (Idempotency)
  test('TEST 16: Duplicate execution attempt returns DUPLICATE without creating new order', async () => {
    const item = createVerifiedProduct('prod-116');
    const prepRes = ExecutionPreparer.prepareProductOrder(item, undefined, undefined, { skipDeliveryCheck: true });
    confirmationGate.registerPreparation(prepRes.preparation!);
    confirmationGate.confirm(prepRes.preparation!.executionId);

    // First execution
    const firstRes = await sandboxExecutor.execute(prepRes.preparation!.executionId);
    assert.equal(firstRes.success, true);
    assert.equal(firstRes.status, 'COMPLETED');
    const firstOrderId = firstRes.sandboxExecutionId;

    // Second execution with identical executionId
    const secondRes = await sandboxExecutor.execute(prepRes.preparation!.executionId);
    assert.equal(secondRes.status, 'DUPLICATE');
    assert.equal(secondRes.isDuplicate, true);
    assert.equal(secondRes.sandboxExecutionId, firstOrderId);
    assert.equal(secondRes.receipt?.receiptId, firstRes.receipt?.receiptId);
  });

  // TEST 17: Concurrent duplicate execution is prevented
  test('TEST 17: Concurrent duplicate execution attempts are locked and deduplicated', async () => {
    const item = createVerifiedProduct('prod-117');
    const prepRes = ExecutionPreparer.prepareProductOrder(item, undefined, undefined, { skipDeliveryCheck: true });
    confirmationGate.registerPreparation(prepRes.preparation!);
    confirmationGate.confirm(prepRes.preparation!.executionId);

    // Launch 2 parallel executions for the same executionId
    const [res1, res2] = await Promise.all([
      sandboxExecutor.execute(prepRes.preparation!.executionId),
      sandboxExecutor.execute(prepRes.preparation!.executionId),
    ]);

    const completed = [res1, res2].filter((r) => r.status === 'COMPLETED');
    const duplicate = [res1, res2].filter((r) => r.status === 'DUPLICATE');

    assert.equal(completed.length, 1);
    assert.equal(duplicate.length, 1);
    assert.equal(res1.sandboxExecutionId, res2.sandboxExecutionId);
  });

  // TEST 18: No financial credentials are accepted
  test('TEST 18: Rejects execution if financial credentials (card/CVV/PIN) are passed in options', async () => {
    const item = createVerifiedProduct('prod-118');
    const prepRes = ExecutionPreparer.prepareProductOrder(item, undefined, undefined, { skipDeliveryCheck: true });
    confirmationGate.registerPreparation(prepRes.preparation!);
    confirmationGate.confirm(prepRes.preparation!.executionId);

    const execRes = await sandboxExecutor.execute(prepRes.preparation!.executionId, {
      cardNumber: '4111222233334444',
      cvv: '123',
    });

    assert.equal(execRes.success, false);
    assert.equal(execRes.status, 'FAILED');
    assert.match(execRes.error!, /financial credentials/i);
  });

  // TEST 19: Audit log does not leak secrets
  test('TEST 19: Audit log records lifecycle events without leaking financial secrets', async () => {
    const item = createVerifiedProduct('prod-119');
    const prepRes = ExecutionPreparer.prepareProductOrder(item, undefined, undefined, { skipDeliveryCheck: true });
    confirmationGate.registerPreparation(prepRes.preparation!);
    confirmationGate.confirm(prepRes.preparation!.executionId);

    await sandboxExecutor.execute(prepRes.preparation!.executionId);

    const auditEvents = sandboxExecutor.getAuditEvents();
    assert.ok(auditEvents.length >= 2);
    const eventTypes = auditEvents.map((e) => e.eventType);
    assert.ok(eventTypes.includes('EXECUTION_STARTED'));
    assert.ok(eventTypes.includes('EXECUTION_COMPLETED'));

    // Check no event metadata contains financial keys
    for (const evt of auditEvents) {
      if (evt.metadata) {
        assert.equal(evt.metadata.cardNumber, undefined);
        assert.equal(evt.metadata.cvv, undefined);
        assert.equal(evt.metadata.pin, undefined);
        assert.equal(evt.metadata.password, undefined);
      }
    }
  });

  // TEST 20: Existing confirmation lifecycle remains intact
  test('TEST 20: ConfirmationGate lifecycle works smoothly with sandbox execution', async () => {
    const item = createVerifiedProduct('prod-120');
    const prepRes = ExecutionPreparer.prepareProductOrder(item, undefined, undefined, { skipDeliveryCheck: true });
    const regState = confirmationGate.registerPreparation(prepRes.preparation!);
    assert.equal(regState.status, 'AWAITING_CONFIRMATION');
    assert.equal(regState.isExecuted, false);

    const confirmRes = confirmationGate.confirm(prepRes.preparation!.executionId);
    assert.equal(confirmRes.success, true);
    assert.equal(confirmRes.status, 'CONFIRMED');

    const execRes = await sandboxExecutor.execute(prepRes.preparation!.executionId);
    assert.equal(execRes.success, true);
    confirmationGate.markExecuted(prepRes.preparation!.executionId);

    const finalState = confirmationGate.getConfirmationState(prepRes.preparation!.executionId);
    assert.equal(finalState?.isExecuted, true);
    assert.equal(finalState?.actionTaken, 'EXECUTED_SANDBOX');
  });

  // TEST 21: Existing Phase 2 tests continue passing (Self-verifying receipt model)
  test('TEST 21: AuditReceiptGenerator creates compliant receipts with all safety disclaimers', () => {
    const item = createVerifiedProduct('prod-121');
    const prepRes = ExecutionPreparer.prepareProductOrder(item, undefined, undefined, { skipDeliveryCheck: true });
    const order = {
      sandbox: true as const,
      type: 'PRODUCT_ORDER' as const,
      executionId: prepRes.preparation!.executionId,
      sandboxOrderId: 'SANDBOX-ORD-TEST1234',
      status: 'COMPLETED' as const,
      item: {
        id: item.id,
        title: item.title,
        price: item.price,
      },
      provider: {
        id: item.provider.id,
        name: item.provider.name,
      },
      costBreakdown: prepRes.preparation!.costBreakdown,
      simulatedAt: new Date().toISOString(),
      message: 'Sandbox order simulated successfully. No real order was placed.',
    };

    const receipt = AuditReceiptGenerator.generateReceipt(order, new Date().toISOString());
    assert.equal(receipt.sandbox, true);
    assert.equal(receipt.sandboxExecutionId, 'SANDBOX-ORD-TEST1234');
    assert.match(receipt.safetyStatement, /No real payment was processed/i);
    assert.equal(receipt.executionStatus, 'COMPLETED');
  });
});
