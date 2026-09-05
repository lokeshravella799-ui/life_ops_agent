import React from 'react';
import type { ProductItem, ExecutionPreparation } from '../../types/agent';
import {
  ShieldAlert,
  ShieldCheck,
  Truck,
  ArrowLeft,
  Lock,
  MapPin,
  Calendar,
  Hash,
  AlertTriangle,
  Loader2,
  CreditCard,
} from 'lucide-react';
import { motion } from 'framer-motion';

interface ConfirmationPanelProps {
  product: ProductItem;
  preparation?: ExecutionPreparation | null;
  executionStatus?: string;
  onConfirm: () => void;
  onCancel: () => void;
  onPayWithRazorpay?: () => void;
  isProcessing?: boolean;
}

export const ConfirmationPanel: React.FC<ConfirmationPanelProps> = ({
  product,
  preparation,
  executionStatus = 'AWAITING_CONFIRMATION',
  onConfirm,
  onCancel,
  onPayWithRazorpay,
  isProcessing = false,
}) => {
  // Financial itemization deterministic from backend execution preparation
  const cost = preparation?.costBreakdown;
  const basePrice = cost ? cost.basePrice : product.price;
  const taxes = cost?.taxes ?? 0;
  const deliveryFee = cost?.deliveryFee ?? 0;
  const convenienceFee = cost?.convenienceFee ?? 0;
  const totalPayable = cost ? cost.total : product.price;
  const currencySymbol = cost?.currency === 'USD' ? '$' : '₹';

  const providerName = preparation?.provider?.name || preparation?.item?.provider?.name || product.provider;
  const executionId = preparation?.executionId || 'Pending Registration';
  const verificationStatus = preparation?.verification?.status || product.verificationStatus || 'VERIFIED';
  const availability = preparation?.item?.availability || product.availability || 'In Stock (Verified)';

  const isUnavailable =
    verificationStatus === 'UNAVAILABLE' ||
    verificationStatus === 'FAILED' ||
    availability === 'UNAVAILABLE' ||
    product.verificationStatus === 'UNAVAILABLE';

  // Delivery destination display from backend preparation or profile fallback
  const deliveryInfo = preparation?.delivery;
  const destinationCity = deliveryInfo?.city
    ? `${deliveryInfo.city}${deliveryInfo.state ? `, ${deliveryInfo.state}` : ''}`
    : 'Designated Delivery Destination';
  const destinationAddress = deliveryInfo?.addressLine1 || 'Default User Profile Address';

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-2xl mx-auto space-y-5"
    >
      {/* 1. CRITICAL SAFETY UX NOTICE */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/80 via-zinc-950/90 to-amber-950/60 border-2 border-amber-500/40 shadow-xl flex items-start gap-3.5">
        <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0 mt-0.5">
          <ShieldAlert className="w-5 h-5 text-amber-400" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-amber-300 tracking-wide flex items-center gap-1.5">
            <span>Explicit Confirmation Gate Active</span>
            <span className="text-[10px] font-mono bg-amber-900/60 px-2 py-0.5 rounded text-amber-200">
              AWAITING EXPLICIT CONFIRMATION
            </span>
          </h4>
          <p className="text-xs text-zinc-300 leading-relaxed font-light">
            LifeOps Agent operates on an explicit consent model. <strong>No transaction or simulation will occur</strong> until you tap the confirm button below. No financial credentials are ever collected or stored.
          </p>
        </div>
      </div>

      {/* 2. ORDER SUMMARY CARD */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#0a0a14]/90 border border-slate-200 dark:border-white/10 backdrop-blur-2xl shadow-xl dark:shadow-2xl space-y-5">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-white/10">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-600 dark:text-cyan-400 font-semibold">
              Step 2 of 2 • Awaiting Confirmation
            </span>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mt-0.5">
              Review Prepared Execution Details
            </h3>
          </div>

          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 transition-colors p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800/50"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Cancel & Change item</span>
          </button>
        </div>

        {/* Selected Product Specs Review */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-black/50 border border-slate-200 dark:border-white/5">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-purple-600 dark:text-purple-400 uppercase font-semibold">
                {product.brand}
              </span>
              <span className="text-[10px] font-mono text-slate-500 dark:text-zinc-500 flex items-center gap-0.5">
                <Hash className="w-3 h-3 text-slate-400 dark:text-zinc-600" />
                {executionId}
              </span>
            </div>
            <h4 className="text-base font-bold text-slate-900 dark:text-zinc-100 truncate">{product.name}</h4>
            <p className="text-xs text-slate-600 dark:text-zinc-400 font-light truncate">
              {product.specs.cpu} • {product.specs.gpu} • {product.specs.ram}
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              <span className="flex items-center gap-1">
                <Truck className="w-3.5 h-3.5" />
                <span>Fulfilled by: {providerName}</span>
              </span>
              <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 px-1.5 py-0.5 rounded font-mono">
                {availability}
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono border ${
                verificationStatus === 'VERIFIED'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/40'
                  : verificationStatus === 'CHANGED'
                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-500/40'
                  : 'bg-slate-100 dark:bg-zinc-800/80 text-slate-700 dark:text-zinc-300 border-slate-300 dark:border-zinc-700'
              }`}>
                {verificationStatus}
              </span>
            </div>
          </div>

          <div className="text-right shrink-0">
            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
              {currencySymbol}{totalPayable.toLocaleString('en-IN')}
            </div>
            {product.priceChanged && product.originalPrice && (
              <div className="text-[11px] text-amber-600 dark:text-amber-400 font-mono flex items-center justify-end gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-500 dark:text-amber-400" />
                <span>Verified Price (was {currencySymbol}{product.originalPrice.toLocaleString('en-IN')})</span>
              </div>
            )}
            <div className="text-[11px] text-slate-500 dark:text-zinc-500 font-mono">Inclusive of itemized charges</div>
          </div>
        </div>

        {/* Delivery / Destination Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/40 border border-slate-200 dark:border-white/5 space-y-1">
            <span className="text-slate-500 dark:text-zinc-500 font-mono text-[10px] uppercase flex items-center gap-1">
              <MapPin className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
              Delivery Destination
            </span>
            <p className="text-slate-800 dark:text-zinc-200 font-medium">{destinationAddress}</p>
            <p className="text-slate-500 dark:text-zinc-400 text-[11px]">{destinationCity}</p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/40 border border-slate-200 dark:border-white/5 space-y-1">
            <span className="text-slate-500 dark:text-zinc-500 font-mono text-[10px] uppercase flex items-center gap-1">
              <Calendar className="w-3 h-3 text-purple-600 dark:text-purple-400" />
              Estimated Delivery / Schedule
            </span>
            <p className="text-emerald-700 dark:text-emerald-300 font-medium">{product.deliveryDays}</p>
            <p className="text-slate-500 dark:text-zinc-400 text-[11px]">Provider Standard Dispatch</p>
          </div>
        </div>

        {/* Itemized Financial Breakdown from Real Backend */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-950/60 border border-slate-200 dark:border-white/5 space-y-2 font-mono text-xs">
          <div className="flex items-center justify-between text-slate-600 dark:text-zinc-400">
            <span>Item Base Subtotal:</span>
            <span className="text-slate-900 dark:text-zinc-200">{currencySymbol}{basePrice.toLocaleString('en-IN')}</span>
          </div>

          {taxes > 0 && (
            <div className="flex items-center justify-between text-slate-600 dark:text-zinc-400">
              <span>Taxes / Regulatory Surcharges:</span>
              <span className="text-slate-900 dark:text-zinc-200">{currencySymbol}{taxes.toLocaleString('en-IN')}</span>
            </div>
          )}

          <div className="flex items-center justify-between text-slate-600 dark:text-zinc-400">
            <span>Courier & Delivery:</span>
            <span className={deliveryFee === 0 ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-900 dark:text-zinc-200'}>
              {deliveryFee === 0 ? 'FREE' : `${currencySymbol}${deliveryFee.toLocaleString('en-IN')}`}
            </span>
          </div>

          {convenienceFee > 0 && (
            <div className="flex items-center justify-between text-slate-600 dark:text-zinc-400">
              <span>Convenience Fee:</span>
              <span className="text-slate-900 dark:text-zinc-200">{currencySymbol}{convenienceFee.toLocaleString('en-IN')}</span>
            </div>
          )}

          <div className="h-px bg-slate-200 dark:bg-white/10 my-2" />

          <div className="flex items-center justify-between text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
            <span className="font-sans">Total Authorized Amount:</span>
            <span className="text-cyan-600 dark:text-cyan-300 text-xl font-mono">
              {currencySymbol}{totalPayable.toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="w-full sm:w-1/3 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800/80 dark:hover:bg-zinc-700/80 border border-slate-300 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white transition-colors disabled:opacity-50"
          >
            Cancel & Go Back
          </button>

          {onPayWithRazorpay ? (
            <button
              type="button"
              onClick={onPayWithRazorpay}
              disabled={isProcessing || isUnavailable}
              className="w-full sm:w-2/3 py-3.5 px-6 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 hover:brightness-110 active:scale-[0.98] text-white font-bold text-sm sm:text-base tracking-wide transition-all shadow-xl shadow-cyan-900/40 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <CreditCard className="w-5 h-5 text-cyan-200" />
              <span>Pay with Razorpay ({currencySymbol}{totalPayable.toLocaleString('en-IN')})</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onConfirm}
              disabled={isProcessing || isUnavailable}
              className="w-full sm:w-2/3 py-3.5 px-6 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-500 hover:brightness-110 active:scale-[0.98] text-white font-bold text-sm sm:text-base tracking-wide transition-all shadow-xl shadow-purple-900/40 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 text-cyan-200 animate-spin" />
                  <span>Simulating Sandbox Execution...</span>
                </>
              ) : isUnavailable ? (
                <>
                  <AlertTriangle className="w-4 h-4 text-amber-300" />
                  <span>Cannot Confirm: Item Unavailable or Unverified</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 text-cyan-200" />
                  <span>Confirm & Authorize Simulation ({currencySymbol}{totalPayable.toLocaleString('en-IN')})</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Security badge */}
        <div className="flex items-center justify-center gap-2 text-[11px] text-zinc-500 pt-1 font-light">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Status: {executionStatus} • Explicit Confirmation Required • Zero Auto-Charge</span>
        </div>
      </div>
    </motion.div>
  );
};
