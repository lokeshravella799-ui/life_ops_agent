import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Sparkles,
  MapPin,
  Calendar,
  IndianRupee,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPaymentOrder, verifyPaymentSignature } from '../../services/agentApi';

declare global {
  interface Window {
    Razorpay?: any;
  }
}

export interface BookingDetails {
  serviceId?: string;
  title: string;
  category?: string;
  price: number;
  pickup?: string;
  destination?: string;
  dateTime?: string;
  seats?: string;
  busOperator?: string;
  departureTime?: string;
  arrivalTime?: string;
}

interface RazorpayCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: BookingDetails;
  conversationId?: string;
  onPaymentSuccess: (result: {
    bookingId: string;
    paymentId: string;
    orderId: string;
    bookingDetails: BookingDetails;
  }) => void;
}

export const RazorpayCheckoutModal: React.FC<RazorpayCheckoutModalProps> = ({
  isOpen,
  onClose,
  booking,
  conversationId,
  onPaymentSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{
    bookingId: string;
    paymentId: string;
    orderId: string;
  } | null>(null);

  // Load Razorpay checkout.js script
  useEffect(() => {
    if (!isOpen) {
      setSuccessResult(null);
      setError(null);
      setLoading(false);
      return;
    }

    if (!window.Razorpay) {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, [isOpen]);

  const handleStartPayment = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Create order on backend with Razorpay Test Mode
      const orderRes = await createPaymentOrder({
        amount: booking.price,
        currency: 'INR',
        bookingDetails: booking,
        conversationId,
      });

      if (!orderRes.success || !orderRes.orderId) {
        throw new Error('Failed to generate Razorpay test order');
      }

      // Check if Razorpay script is available in browser
      if (typeof window !== 'undefined' && window.Razorpay) {
        const options = {
          key: orderRes.keyId || 'rzp_test_51NgQexample',
          amount: Math.round(orderRes.amount * 100),
          currency: orderRes.currency || 'INR',
          name: 'LifeOps Agent',
          description: `Demo Booking: ${booking.title}`,
          order_id: orderRes.orderId,
          handler: async function (response: any) {
            try {
              setLoading(true);
              const verifyRes = await verifyPaymentSignature({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                bookingDetails: booking,
                conversationId,
              });

              if (verifyRes.success) {
                const confirmed = {
                  bookingId: verifyRes.bookingId,
                  paymentId: verifyRes.paymentId,
                  orderId: verifyRes.orderId,
                };
                setSuccessResult(confirmed);
                onPaymentSuccess({
                  ...confirmed,
                  bookingDetails: booking,
                });
              } else {
                throw new Error(verifyRes.message || 'Signature verification failed');
              }
            } catch (err: any) {
              setError(err.message || 'Payment verification failed');
            } finally {
              setLoading(false);
            }
          },
          prefill: {
            name: 'LifeOps Demo User',
            email: 'demo@lifeops.ai',
            contact: '9999999999',
          },
          notes: {
            service: booking.title,
            environment: 'Demo Test Mode',
          },
          theme: {
            color: '#06b6d4',
          },
          modal: {
            ondismiss: function () {
              setLoading(false);
            },
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (resp: any) {
          setError(`Payment Failed: ${resp.error?.description || 'Declined'}`);
          setLoading(false);
        });
        rzp.open();
      } else {
        // Direct test simulation fallback if external script blocked
        await simulateTestPayment(orderRes.orderId);
      }
    } catch (err: any) {
      setError(err.message || 'Error processing payment order');
      setLoading(false);
    }
  };

  // Instant simulator for hackathon demo resilience
  const simulateTestPayment = async (existingOrderId?: string) => {
    try {
      setLoading(true);
      setError(null);

      let orderId = existingOrderId;
      if (!orderId) {
        const orderRes = await createPaymentOrder({
          amount: booking.price,
          currency: 'INR',
          bookingDetails: booking,
          conversationId,
        });
        orderId = orderRes.orderId;
      }

      // Simulate verification with test payment ID & signature
      const simPaymentId = `pay_test_${Math.random().toString(36).substring(2, 9)}`;
      const simSignature = `sig_test_${Math.random().toString(36).substring(2, 12)}`;

      const verifyRes = await verifyPaymentSignature({
        razorpay_order_id: orderId,
        razorpay_payment_id: simPaymentId,
        razorpay_signature: simSignature,
        bookingDetails: booking,
        conversationId,
      });

      if (verifyRes.success) {
        const confirmed = {
          bookingId: verifyRes.bookingId,
          paymentId: verifyRes.paymentId,
          orderId: verifyRes.orderId,
        };
        setSuccessResult(confirmed);
        onPaymentSuccess({
          ...confirmed,
          bookingDetails: booking,
        });
      } else {
        throw new Error(verifyRes.message || 'Signature verification failed');
      }
    } catch (err: any) {
      setError(err.message || 'Simulated payment failed');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          className="relative w-full max-w-lg bg-[#090914] border border-cyan-500/30 rounded-3xl p-6 sm:p-7 text-zinc-100 shadow-2xl shadow-cyan-950/60 overflow-hidden"
        >
          {/* Background Neon Accent Glows */}
          <div className="absolute top-0 right-0 w-56 h-56 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-56 h-56 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          {!successResult ? (
            /* ======================================================== */
            /* 1. BOOKING SUMMARY & RAZORPAY CHECKOUT TRIGGER           */
            /* ======================================================== */
            <div className="space-y-5">
              {/* Header & Demo Badge */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/40 text-[11px] font-mono font-bold text-cyan-300">
                    <Sparkles className="w-3 h-3 text-cyan-400" />
                    DEMO MODE • TEST KEYS
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400 uppercase">
                    Razorpay Gateway
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight">
                  Booking Summary & Checkout
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Confirm your route details and complete transaction in test mode.
                </p>
              </div>

              {/* Service & Route Card */}
              <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-white/5">
                  <div>
                    <h4 className="text-sm font-semibold text-white">
                      {booking.title}
                    </h4>
                    <p className="text-xs text-cyan-400 font-mono">
                      {booking.busOperator || 'Express Service'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold font-mono text-white flex items-center justify-end">
                      <IndianRupee className="w-4 h-4 text-cyan-400" />
                      {booking.price.toLocaleString('en-IN')}
                    </span>
                    <span className="text-[10px] text-zinc-400 uppercase font-mono">
                      All taxes included
                    </span>
                  </div>
                </div>

                {/* Pickup & Destination Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                    <span className="text-[10px] font-mono text-cyan-300 uppercase block mb-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-cyan-400" /> Pickup Point
                    </span>
                    <p className="text-zinc-200 font-medium truncate">
                      {booking.pickup || 'Current Location (Hyderabad, Telangana)'}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/5">
                    <span className="text-[10px] font-mono text-purple-300 uppercase block mb-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-purple-400" /> Destination
                    </span>
                    <p className="text-zinc-200 font-medium truncate">
                      {booking.destination || 'Chennai'}
                    </p>
                  </div>
                </div>

                {/* Date & Time if available */}
                <div className="flex items-center justify-between text-xs px-1 text-zinc-400">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                    {booking.dateTime || 'Tomorrow, 08:30 PM'}
                  </span>
                  <span className="font-mono text-cyan-400/80">
                    Seat: {booking.seats || '14A (Window)'}
                  </span>
                </div>
              </div>

              {/* Security notice */}
              <div className="flex items-center gap-2 text-xs text-zinc-400 bg-white/5 px-3.5 py-2.5 rounded-xl border border-white/5">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Razorpay Test Sandbox enabled. No real money will be charged.
                </span>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Payment Buttons */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={handleStartPayment}
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 shadow-lg shadow-cyan-900/40 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Opening Razorpay Checkout...</span>
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" />
                      <span>Pay with Razorpay (₹{booking.price.toLocaleString('en-IN')})</span>
                    </>
                  )}
                </button>

                {/* Demo Instant Verification Fallback */}
                <button
                  type="button"
                  onClick={() => simulateTestPayment()}
                  disabled={loading}
                  className="w-full py-2 px-3 rounded-xl text-xs font-mono text-zinc-400 hover:text-cyan-300 hover:bg-white/5 transition-colors cursor-pointer border border-transparent hover:border-cyan-500/30"
                >
                  ⚡ Instant Demo Simulator Checkout (1-Click Test Pass)
                </button>
              </div>
            </div>
          ) : (
            /* ======================================================== */
            /* 2. PAYMENT CONFIRMATION SUCCESS SCREEN                   */
            /* ======================================================== */
            <div className="text-center py-4 space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-xl shadow-emerald-950/50">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-[10px] font-mono text-emerald-300 font-bold uppercase mb-1">
                  Payment Successful
                </span>
                <h3 className="text-2xl font-bold text-white tracking-tight">
                  Booking Confirmed
                </h3>
                <p className="text-xs text-zinc-400 mt-1 font-mono">
                  Booking ID: <strong className="text-cyan-400">{successResult.bookingId}</strong>
                </p>
              </div>

              {/* Confirmation Details Card */}
              <div className="p-4 rounded-2xl bg-black/40 border border-white/5 text-left text-xs space-y-2">
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-zinc-400">Service:</span>
                  <span className="text-white font-medium">{booking.title}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-zinc-400">Pickup:</span>
                  <span className="text-cyan-300 font-medium truncate max-w-[240px]">
                    {booking.pickup || 'Hyderabad, Telangana'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-zinc-400">Destination:</span>
                  <span className="text-purple-300 font-medium truncate max-w-[240px]">
                    {booking.destination || 'Chennai'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-zinc-400">Payment ID:</span>
                  <span className="text-zinc-300 font-mono text-[11px]">
                    {successResult.paymentId}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-zinc-400">Amount Paid:</span>
                  <span className="text-emerald-400 font-mono font-bold">
                    ₹{booking.price.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 transition-all cursor-pointer shadow-lg shadow-emerald-950/40"
                >
                  Done & View in History
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
