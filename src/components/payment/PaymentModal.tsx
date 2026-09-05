import React, { useEffect, useState } from 'react';
import type { ProductItem } from '../../types/agent';
import { LifeOpsOrb } from '../orb/LifeOpsOrb';
import { ShieldCheck, Lock, CheckCircle2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PaymentModalProps {
  isOpen: boolean;
  product: ProductItem;
  onSuccess: () => void;
  onError?: () => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  product,
  onSuccess,
}) => {
  const [step, setStep] = useState<
    'preparing' | 'authenticating' | 'settling' | 'complete'
  >('preparing');

  useEffect(() => {
    if (!isOpen) {
      setStep('preparing');
      return;
    }

    // Progression of simulated Razorpay Sandbox gateway states
    const timer1 = setTimeout(() => {
      setStep('authenticating');
    }, 1200);

    const timer2 = setTimeout(() => {
      setStep('settling');
    }, 2500);

    const timer3 = setTimeout(() => {
      setStep('complete');
      setTimeout(() => {
        onSuccess();
      }, 900);
    }, 3800);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [isOpen, onSuccess]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/90 backdrop-blur-xl"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.92 }}
          className="relative w-full max-w-md bg-white dark:bg-[#0a0a14] border border-cyan-500/30 dark:border-cyan-500/40 rounded-3xl p-6 text-center space-y-5 shadow-2xl shadow-slate-300 dark:shadow-cyan-950/60 z-10 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-center gap-2 text-xs font-mono text-cyan-700 dark:text-cyan-400">
            <Lock className="w-3.5 h-3.5" />
            <span>SECURE AUTONOMOUS GATEWAY</span>
          </div>

          {/* Mini Orb in Processing State */}
          <div className="py-2 flex items-center justify-center">
            <LifeOpsOrb
              state={step === 'complete' ? 'success' : 'processing'}
              size="compact"
              statusTextOverride={
                step === 'preparing'
                  ? 'Preparing simulated sandbox session...'
                  : step === 'authenticating'
                  ? 'Simulating provider authorization...'
                  : step === 'settling'
                  ? 'Simulating ledger settlement...'
                  : 'Sandbox simulation complete'
              }

            />
          </div>

          {/* Transaction detail summary */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-950/80 border border-slate-200 dark:border-white/5 text-left text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-zinc-400">Recipient:</span>
              <span className="text-slate-800 dark:text-zinc-200 font-medium">{product.provider}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-zinc-400">Authorized Total:</span>
              <span className="text-cyan-700 dark:text-cyan-300 font-mono font-bold text-sm">
                ₹{product.price.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400 dark:text-zinc-500">Method:</span>
              <span className="text-slate-500 dark:text-zinc-400 font-mono">Simulated Sandbox Handshake (No Real Money)</span>
            </div>
          </div>


          {/* Step Progress Indicators */}
          <div className="flex items-center justify-center gap-3 text-[11px] font-mono text-slate-500 dark:text-zinc-400">
            <div
              className={`flex items-center gap-1 ${
                step !== 'preparing' ? 'text-emerald-500 dark:text-emerald-400' : 'text-cyan-600 dark:text-cyan-300 animate-pulse'
              }`}
            >
              {step !== 'preparing' ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              )}
              <span>Init</span>
            </div>
            <span>•</span>
            <div
              className={`flex items-center gap-1 ${
                step === 'settling' || step === 'complete'
                  ? 'text-emerald-500 dark:text-emerald-400'
                  : step === 'authenticating'
                  ? 'text-cyan-600 dark:text-cyan-300 animate-pulse'
                  : 'text-slate-300 dark:text-zinc-600'
              }`}
            >
              {step === 'settling' || step === 'complete' ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : step === 'authenticating' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : null}
              <span>Auth</span>
            </div>
            <span>•</span>
            <div
              className={`flex items-center gap-1 ${
                step === 'complete'
                  ? 'text-emerald-500 dark:text-emerald-400'
                  : step === 'settling'
                  ? 'text-cyan-600 dark:text-cyan-300 animate-pulse'
                  : 'text-slate-300 dark:text-zinc-600'
              }`}
            >
              {step === 'complete' ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : step === 'settling' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : null}
              <span>Clear</span>
            </div>
          </div>

          <div className="text-[10px] text-slate-400 dark:text-zinc-500 flex items-center justify-center gap-1.5 font-light">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
            <span>Sandbox Mode • Simulated Transaction • No Real Money Charged</span>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
};
