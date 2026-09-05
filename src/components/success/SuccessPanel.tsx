import React, { useEffect } from 'react';
import type { ProductItem, SandboxReceipt } from '../../types/agent';
import confetti from 'canvas-confetti';
import {
  CheckCircle2,
  Download,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import { motion } from 'framer-motion';

interface SuccessPanelProps {
  product: ProductItem;
  orderId: string;
  onNewTask: () => void;
  receipt?: SandboxReceipt;
}

export const SuccessPanel: React.FC<SuccessPanelProps> = ({
  product,
  orderId,
  onNewTask,
  receipt,
}) => {
  // Trigger celebratory confetti on mount
  useEffect(() => {
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#a855f7', '#ec4899', '#06b6d4', '#10b981', '#ffffff'],
      });
    } catch {}
  }, []);

  const displayOrderId = receipt?.sandboxExecutionId || receipt?.sandboxOrderId || orderId;
  const cost = receipt?.costBreakdown;
  const totalAmount = cost?.total ?? (receipt?.total ?? product.price);
  const currencySymbol = receipt?.currency === 'USD' ? '$' : '₹';
  const providerName = receipt?.provider?.name || product.provider;
  const itemName = receipt?.selectedItem?.title || product.name;

  const completionTime = receipt?.completionTimestamp
    ? new Date(receipt.completionTimestamp).toLocaleString('en-IN')
    : new Date().toLocaleString('en-IN');

  const handleDownloadReceipt = () => {
    const basePrice = cost?.basePrice ?? product.price;
    const taxes = cost?.taxes ?? 0;
    const deliveryFee = cost?.deliveryFee ?? 0;
    const convenienceFee = cost?.convenienceFee ?? 0;
    const currency = receipt?.currency || 'INR';

    const receiptText = `
========================================
     LIFEOPS AGENT - SANDBOX RECEIPT
========================================
SAFETY NOTICE:
No real payment was processed and no real order or booking was created.
----------------------------------------
Sandbox Execution ID: ${displayOrderId}
Receipt ID:           ${receipt?.receiptId || 'N/A'}
Execution ID:         ${receipt?.executionId || 'N/A'}
Execution Type:       ${receipt?.executionType || 'PRODUCT_ORDER'}
Date / Timestamp:     ${completionTime}
Status:               SIMULATION COMPLETED
----------------------------------------
Item:                 ${itemName}
Provider:             ${providerName}
----------------------------------------
Base Subtotal:        ${currency} ${basePrice.toLocaleString('en-IN')}
Taxes:                ${currency} ${taxes.toLocaleString('en-IN')}
Delivery Fee:         ${currency} ${deliveryFee.toLocaleString('en-IN')}
Convenience Fee:      ${currency} ${convenienceFee.toLocaleString('en-IN')}
----------------------------------------
TOTAL:                ${currency} ${totalAmount.toLocaleString('en-IN')}
Execution Mode:       Deterministic Simulation Sandbox
Safety Statement:     ${receipt?.safetyStatement || 'No real payment was processed and no real order or booking was created.'}
========================================
Generated securely by LifeOps Autonomous Agent
    `.trim();

    const blob = new Blob([receiptText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LifeOps_Sandbox_Receipt_${displayOrderId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 15 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-2xl mx-auto space-y-6 pb-8"
    >
      {/* 1. HERO SUCCESS BANNER */}
      <div className="text-center space-y-3 pt-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-tr from-emerald-500/20 to-cyan-500/20 border border-emerald-400/40 text-emerald-400 shadow-xl shadow-emerald-950/40">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <div>
          <span className="text-xs font-mono uppercase tracking-widest text-emerald-400 font-semibold">
            SANDBOX EXECUTION COMPLETE
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1">
            Sandbox Simulation Successful
          </h2>
          <p className="text-xs sm:text-sm text-amber-300/90 font-medium mt-1">
            No real payment was processed and no real order or booking was created.
          </p>
        </div>
      </div>

      {/* 2. ORDER RECEIPT CARD */}
      <div className="p-6 rounded-2xl bg-[#0a0a14]/90 border border-emerald-500/30 backdrop-blur-2xl shadow-2xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
          <div>
            <span className="text-[10px] font-mono text-zinc-500 uppercase">Sandbox Execution ID</span>
            <div className="text-lg font-bold font-mono text-cyan-300 tracking-wider">
              {displayOrderId}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-700/40 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              SIMULATED & VERIFIED
            </span>
          </div>
        </div>

        {/* Product Details */}
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="text-[10px] font-mono uppercase text-purple-400 font-medium">
                {product.brand}
              </span>
              <h3 className="text-base sm:text-lg font-bold text-white">{itemName}</h3>
              <p className="text-xs text-zinc-400 font-light mt-0.5">
                {product.specs.cpu} • {product.specs.gpu} • {product.specs.ram}
              </p>
            </div>

            <div className="text-right shrink-0">
              <div className="text-xl font-bold font-mono text-white">
                Total: {currencySymbol}{totalAmount.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-emerald-400 font-mono">Simulated Settlement</div>
            </div>
          </div>

          {/* Fulfillment details */}
          <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-zinc-500 font-mono text-[10px] uppercase">Selected Provider</span>
              <p className="text-zinc-200 font-medium mt-0.5">{providerName}</p>
            </div>

            <div>
              <span className="text-zinc-500 font-mono text-[10px] uppercase">
                Execution Timestamp
              </span>
              <p className="text-emerald-300 font-medium mt-0.5">{completionTime}</p>
            </div>
          </div>

          {/* Real Cost Breakdown */}
          {cost && (
            <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-white/5 space-y-1.5 text-xs font-mono">
              <div className="flex justify-between text-zinc-400">
                <span>Subtotal:</span>
                <span className="text-zinc-200">{currencySymbol}{cost.basePrice.toLocaleString('en-IN')}</span>
              </div>
              {cost.taxes !== undefined && cost.taxes > 0 && (
                <div className="flex justify-between text-zinc-400">
                  <span>Taxes:</span>
                  <span className="text-zinc-200">{currencySymbol}{cost.taxes.toLocaleString('en-IN')}</span>
                </div>
              )}
              {cost.deliveryFee !== undefined && cost.deliveryFee > 0 && (
                <div className="flex justify-between text-zinc-400">
                  <span>Delivery:</span>
                  <span className="text-zinc-200">{currencySymbol}{cost.deliveryFee.toLocaleString('en-IN')}</span>
                </div>
              )}
              {cost.convenienceFee !== undefined && cost.convenienceFee > 0 && (
                <div className="flex justify-between text-zinc-400">
                  <span>Convenience Fee:</span>
                  <span className="text-zinc-200">{currencySymbol}{cost.convenienceFee.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="border-t border-white/10 pt-1 flex justify-between font-bold text-white">
                <span>Total:</span>
                <span className="text-cyan-300">{currencySymbol}{cost.total.toLocaleString('en-IN')}</span>
              </div>
            </div>
          )}
        </div>

        {/* Truthful Sandbox Execution Lifecycle */}
        <div className="pt-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-2 block">
            Sandbox Execution Lifecycle
          </span>

          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-800/40 text-emerald-300">
              <div className="font-bold text-[11px]">1. Authorized</div>
              <div className="text-[9px] text-zinc-400 mt-0.5">Sandbox Authorized</div>
            </div>

            <div className="p-2.5 rounded-xl bg-cyan-950/30 border border-cyan-800/40 text-cyan-300">
              <div className="font-bold text-[11px] flex items-center justify-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                2. Processing
              </div>
              <div className="text-[9px] text-zinc-400 mt-0.5">Simulation Processing</div>
            </div>

            <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300">
              <div className="font-bold text-[11px] flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                3. Finalized
              </div>
              <div className="text-[9px] text-emerald-400 mt-0.5">Sandbox Completed</div>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="pt-3 flex flex-col sm:flex-row items-center gap-3">
          <button
            type="button"
            onClick={handleDownloadReceipt}
            className="w-full sm:w-1/2 py-3 px-4 rounded-xl bg-zinc-800/90 hover:bg-zinc-700/90 border border-white/10 text-xs font-semibold text-zinc-200 hover:text-white transition-colors flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4 text-cyan-400" />
            <span>Download Invoice (TXT)</span>
          </button>

          <button
            type="button"
            onClick={onNewTask}
            className="w-full sm:w-1/2 py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-500 hover:brightness-110 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-900/30"
          >
            <Plus className="w-4 h-4" />
            <span>Start Next Task</span>
          </button>
        </div>

        {/* Security / Simulation footnote */}
        <div className="flex items-center justify-center gap-1.5 text-[10px] text-zinc-500 font-mono">
          <ShieldCheck className="w-3 h-3 text-emerald-400" />
          <span>Receipt ID: {receipt?.receiptId || 'REC-SIM'} • Safe Simulation Mode</span>
        </div>
      </div>
    </motion.div>
  );
};
