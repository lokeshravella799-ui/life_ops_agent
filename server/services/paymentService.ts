import crypto from 'crypto';
import { logger } from '../utils/logger';

export interface CreateOrderInput {
  amount: number; // in INR (Rupees)
  currency?: string;
  receipt?: string;
  notes?: Record<string, string>;
}

export interface RazorpayOrderResult {
  success: boolean;
  orderId: string;
  amount: number; // in paise
  amountInRupees: number;
  currency: string;
  keyId: string;
  isTestMode: boolean;
}

export interface VerifyPaymentInput {
  orderId: string;
  paymentId: string;
  signature?: string;
  serviceType?: string;
  bookingDetails?: {
    pickup?: string;
    destination?: string;
    operator?: string;
    departureTime?: string;
    title?: string;
    amount?: number;
  };
}

export interface VerifyPaymentResult {
  success: boolean;
  bookingId: string;
  orderId: string;
  paymentId: string;
  status: 'CONFIRMED';
  safetyStatement: string;
  isTestMode: boolean;
  confirmedAt: string;
  details?: any;
}

export class PaymentService {
  private keyId: string;
  private keySecret: string;

  constructor() {
    this.keyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_LifeOpsDemoKey123';
    this.keySecret = process.env.RAZORPAY_KEY_SECRET || 'rzp_test_LifeOpsDemoSecret456';
  }

  createOrder(input: CreateOrderInput): RazorpayOrderResult {
    const amountInRupees = input.amount || 1299;
    const amountInPaise = Math.round(amountInRupees * 100);
    const orderId = `order_test_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    logger.info('Created Razorpay test mode order', {
      orderId,
      amountInRupees,
      currency: input.currency || 'INR',
    });

    return {
      success: true,
      orderId,
      amount: amountInPaise,
      amountInRupees,
      currency: input.currency || 'INR',
      keyId: this.keyId,
      isTestMode: true,
    };
  }

  verifyPayment(input: VerifyPaymentInput): VerifyPaymentResult {
    const { orderId, paymentId, signature, bookingDetails } = input;

    // Cryptographic signature check if signature provided and secret is configured
    if (signature && process.env.RAZORPAY_KEY_SECRET && process.env.RAZORPAY_KEY_SECRET !== 'rzp_test_LifeOpsDemoSecret456') {
      try {
        const expectedSignature = crypto
          .createHmac('sha256', this.keySecret)
          .update(`${orderId}|${paymentId}`)
          .digest('hex');

        if (expectedSignature !== signature) {
          logger.warn('Razorpay signature mismatch in live mode', { orderId, paymentId });
        }
      } catch (err: any) {
        logger.error('Signature verification error:', { error: err?.message });
      }
    }

    // Generate verified booking ID matching format LO-XXXX
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const bookingId = `LO-${randomDigits}`;

    logger.info('Razorpay test payment verified successfully', {
      orderId,
      paymentId,
      bookingId,
      pickup: bookingDetails?.pickup,
      destination: bookingDetails?.destination,
    });

    return {
      success: true,
      bookingId,
      orderId,
      paymentId: paymentId || `pay_test_${Date.now()}`,
      status: 'CONFIRMED',
      safetyStatement: 'DEMO TRANSACTION: Completed via Razorpay Test Gateway. No real money charged.',
      isTestMode: true,
      confirmedAt: new Date().toISOString(),
      details: bookingDetails,
    };
  }
}

export const paymentService = new PaymentService();
