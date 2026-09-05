import type {
  SandboxReceipt,
  SandboxOrder,
  SandboxBooking,
  SandboxExecutionType,
} from './sandboxTypes';
import { logger } from '../utils/logger';

export class AuditReceiptGenerator {
  /**
   * Generates an immutable, verified audit receipt for a completed sandbox execution.
   */
  static generateReceipt(
    orderOrBooking: SandboxOrder | SandboxBooking,
    confirmationTimestamp: string,
    completionTimestamp: string = new Date().toISOString()
  ): SandboxReceipt {
    const isOrder = orderOrBooking.type === 'PRODUCT_ORDER';
    const sandboxId = isOrder
      ? (orderOrBooking as SandboxOrder).sandboxOrderId
      : (orderOrBooking as SandboxBooking).bookingId;

    const receiptSuffix = Math.random().toString(36).substring(2, 10).toUpperCase();
    const receiptId = `SANDBOX-RCP-${Date.now().toString().slice(-4)}${receiptSuffix}`;

    // Item snapshot
    let selectedItem: {
      id: string;
      title: string;
      price: { amount: number; currency: string };
    };

    if (isOrder) {
      const order = orderOrBooking as SandboxOrder;
      selectedItem = {
        id: order.item.id || order.executionId,
        title: order.item.title,
        price: order.item.price,
      };
    } else {
      const booking = orderOrBooking as SandboxBooking;
      let title = 'Booking Service';
      if (booking.type === 'BUS_BOOKING') {
        title = `${booking.operator} (${booking.source || 'Origin'} -> ${booking.destination || 'Destination'})`;
      } else if (booking.type === 'HOTEL_BOOKING') {
        title = `${booking.hotel} (${booking.room || 'Standard Room'})`;
      } else if (booking.type === 'FLIGHT_BOOKING') {
        title = `${booking.airline} ${booking.flightNumber || ''} (${booking.origin || 'Origin'} -> ${booking.destination || 'Destination'})`.trim();
      }

      selectedItem = {
        id: booking.executionId,
        title,
        price: {
          amount: booking.costBreakdown.total,
          currency: booking.costBreakdown.currency || 'INR',
        },
      };
    }

    const receipt: SandboxReceipt = Object.freeze({
      receiptId,
      executionId: orderOrBooking.executionId,
      ...(isOrder
        ? { sandboxOrderId: (orderOrBooking as SandboxOrder).sandboxOrderId }
        : { sandboxBookingId: (orderOrBooking as SandboxBooking).bookingId }),
      sandboxExecutionId: sandboxId,
      executionType: orderOrBooking.type as SandboxExecutionType,
      timestamp: completionTimestamp,
      provider: {
        id: orderOrBooking.provider.id,
        name: orderOrBooking.provider.name,
        url: orderOrBooking.provider.url,
      },
      selectedItem,
      costBreakdown: Object.freeze({ ...orderOrBooking.costBreakdown }),
      total: orderOrBooking.costBreakdown.total,
      currency: orderOrBooking.costBreakdown.currency || 'INR',
      executionStatus: orderOrBooking.status,
      sandbox: true,
      confirmationTimestamp,
      completionTimestamp,
      safetyStatement:
        'No real payment was processed and no real order or booking was created.',
      message: orderOrBooking.message,
    });

    logger.info('Generated immutable sandbox audit receipt', {
      receiptId: receipt.receiptId,
      executionId: receipt.executionId,
      sandboxExecutionId: receipt.sandboxExecutionId,
      total: receipt.total,
      currency: receipt.currency,
    });

    return receipt;
  }
}
