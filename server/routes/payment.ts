import { Router, Request, Response } from 'express';
import { paymentService } from '../services/paymentService';
import { conversationStore } from '../db/conversationStore';
import { logger } from '../utils/logger';

export const paymentRouter = Router();

/**
 * POST /api/payment/create-order
 * Generates Razorpay test mode order
 */
paymentRouter.post('/create-order', (req: Request, res: Response): void => {
  try {
    const { amount, currency, receipt, notes } = req.body;
    const order = paymentService.createOrder({
      amount: Number(amount) || 1299,
      currency: currency || 'INR',
      receipt,
      notes,
    });
    res.json(order);
  } catch (err: any) {
    logger.error('Error creating Razorpay order:', { error: err?.message });
    res.status(500).json({ error: 'Failed to initialize payment gateway order.' });
  }
});

/**
 * POST /api/payment/verify-signature
 * Verifies Razorpay payment signature and confirms booking
 */
paymentRouter.post('/verify-signature', (req: Request, res: Response): void => {
  try {
    const {
      orderId,
      paymentId,
      signature,
      conversationId,
      serviceType,
      bookingDetails,
    } = req.body;

    const result = paymentService.verifyPayment({
      orderId: orderId || `order_test_${Date.now()}`,
      paymentId: paymentId || `pay_test_${Date.now()}`,
      signature,
      serviceType: serviceType || 'bus',
      bookingDetails,
    });

    if (conversationId) {
      conversationStore.updateBookingState(conversationId, {
        serviceType: (serviceType as any) || 'bus',
        pickup: bookingDetails?.pickup || 'Current Location (Hyderabad, Telangana)',
        destination: bookingDetails?.destination || 'Chennai',
        selectedItem: bookingDetails,
        totalAmount: bookingDetails?.amount || 1299,
        status: 'confirmed',
        bookingId: result.bookingId,
        orderId: result.orderId,
        paymentId: result.paymentId,
        confirmedAt: result.confirmedAt,
      });

      // Also append confirmed booking assistant message into the conversation
      conversationStore.addMessage(conversationId, {
        role: 'assistant',
        content: `Booking Confirmed!\nPayment Successful via Razorpay Test Gateway.\nBooking ID: ${result.bookingId}\nPickup: ${bookingDetails?.pickup || 'Current Location (Hyderabad, Telangana)'}\nDestination: ${bookingDetails?.destination || 'Chennai'}\nTotal: ₹${bookingDetails?.amount || 1299}`,
        metadata: {
          bookingId: result.bookingId,
          isBusBooking: true,
          pickup: bookingDetails?.pickup || 'Current Location (Hyderabad, Telangana)',
          destination: bookingDetails?.destination || 'Chennai',
        },
      });
    }

    res.json(result);
  } catch (err: any) {
    logger.error('Error verifying Razorpay payment:', { error: err?.message });
    res.status(500).json({ error: 'Payment verification failed.' });
  }
});
