import React, { useState } from 'react';
import type { ProductItem } from '../../types/agent';
import {
  Sparkles,
  Star,
  ShieldCheck,
  Layers,
  ArrowRight,
  ExternalLink,
  AlertTriangle,
  Loader2,
  Laptop,
  Bus,
  Plane,
  Building,
  ChevronDown,
  ChevronUp,
  Cpu,
  HardDrive,
  Truck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ResultCardProps {
  product: ProductItem;
  isSelected?: boolean;
  isSelecting?: boolean;
  onSelect: (product: ProductItem) => void;
  onOpenDetails: (product: ProductItem) => void;
  onFeedback?: (product: ProductItem, rating: 'positive' | 'negative', reason?: string) => void;
  rank: number;
}

export const ResultCard: React.FC<ResultCardProps> = ({
  product,
  isSelected = false,
  isSelecting = false,
  onSelect,
  onOpenDetails,
  onFeedback,
  rank,
}) => {
  const [feedbackRating, setFeedbackRating] = useState<'positive' | 'negative' | null>(null);
  const [imgError, setImgError] = useState(false);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);

  const isTopMatch = product.isRecommended || rank === 1;
  const verStatus = product.verificationStatus || product.verification?.status || 'UNVERIFIED';

  const discountPercent =
    product.originalPrice && product.originalPrice > product.price
      ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
      : null;

  const renderFallbackIcon = () => {
    const titleLower = (product.name || '').toLowerCase();
    if (titleLower.includes('bus') || product.provider?.toLowerCase().includes('bus') || product.provider?.toLowerCase().includes('transit')) {
      return <Bus className="w-8 h-8 text-cyan-500/70" />;
    }
    if (titleLower.includes('flight') || product.provider?.toLowerCase().includes('flight') || product.provider?.toLowerCase().includes('air')) {
      return <Plane className="w-8 h-8 text-cyan-500/70" />;
    }
    if (titleLower.includes('hotel') || product.provider?.toLowerCase().includes('hotel') || product.provider?.toLowerCase().includes('stay')) {
      return <Building className="w-8 h-8 text-cyan-500/70" />;
    }
    return <Laptop className="w-8 h-8 text-purple-500/70" />;
  };

  const renderVerificationBadge = () => {
    switch (verStatus) {
      case 'VERIFIED':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-emerald-100 text-emerald-800 dark:bg-emerald-950/90 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/50 px-1.5 py-0.5 rounded shadow-xs">
            <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Verified</span>
          </span>
        );
      case 'CHANGED':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-amber-100 text-amber-800 dark:bg-amber-950/90 dark:text-amber-300 border border-amber-300 dark:border-amber-500/50 px-1.5 py-0.5 rounded shadow-xs">
            <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>Price Updated</span>
          </span>
        );
      case 'UNAVAILABLE':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-red-100 text-red-800 dark:bg-red-950/90 dark:text-red-300 border border-red-300 dark:border-red-500/50 px-1.5 py-0.5 rounded shadow-xs">
            <span>Unavailable</span>
          </span>
        );
      default:
        return null;
    }
  };

  const sourceName = product.source?.toLowerCase().includes('flipkart')
    ? 'Flipkart'
    : product.source?.toLowerCase().includes('amazon')
    ? 'Amazon India'
    : product.provider || 'Verified Store';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: rank * 0.04 }}
      className={`relative rounded-xl transition-all duration-200 overflow-hidden flex flex-col ${
        isTopMatch
          ? 'bg-white dark:bg-[#0c0b16] border-2 border-purple-400 dark:border-purple-500/70 shadow-md dark:shadow-purple-950/30'
          : 'bg-white dark:bg-[#0a0a14] border border-slate-200 dark:border-white/10 hover:border-cyan-500/60 dark:hover:border-cyan-500/40 shadow-xs hover:shadow-md'
      } ${isSelected ? 'ring-2 ring-cyan-500 border-cyan-500' : ''}`}
    >
      {/* 1. Compact Top Match Header */}
      {isTopMatch && (
        <div className="bg-purple-100/80 dark:bg-purple-900/40 px-3 py-1 border-b border-purple-200 dark:border-purple-500/30 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1.5 font-bold tracking-wide text-purple-900 dark:text-purple-200">
            <Sparkles className="w-3 h-3 text-pink-500 dark:text-pink-400 shrink-0" />
            <span>TOP RECOMMENDATION</span>
          </div>
          <span className="font-mono font-bold text-[10px] text-purple-800 dark:text-cyan-300 bg-purple-200/70 dark:bg-purple-950/80 px-1.5 py-0.5 rounded border border-purple-300 dark:border-purple-400/30">
            {product.scores.aiMatch}% Match
          </span>
        </div>
      )}

      {/* 2. Compact Showcase Image Container */}
      <div className="relative w-full h-28 sm:h-32 bg-slate-50 dark:bg-black/40 border-b border-slate-200 dark:border-white/5 flex items-center justify-center p-2 overflow-hidden group">
        {(product.imageUrl || product.image) && !imgError ? (
          <img
            src={product.imageUrl || product.image}
            alt={product.name}
            className="w-full h-full object-contain transition-transform duration-200 group-hover:scale-105"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-white/5 rounded-lg">
            {renderFallbackIcon()}
          </div>
        )}

        {/* Floating Top-Left Badges: Rank & Brand */}
        <div className="absolute top-2 left-2 flex items-center gap-1 z-10">
          <span
            className={`inline-flex items-center text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shadow-xs ${
              isTopMatch
                ? 'bg-purple-600 text-white'
                : 'bg-slate-900/80 dark:bg-zinc-800/90 text-white border border-slate-700 dark:border-white/10'
            }`}
          >
            #{rank}
          </span>
          {product.brand && (
            <span className="text-[10px] font-medium text-slate-700 dark:text-zinc-300 bg-white/90 dark:bg-zinc-900/90 border border-slate-200 dark:border-white/10 px-1.5 py-0.5 rounded shadow-xs">
              {product.brand}
            </span>
          )}
        </div>

        {/* Floating Top-Right Verification Status Badge */}
        <div className="absolute top-2 right-2 z-10">
          {renderVerificationBadge()}
        </div>

        {/* Floating Bottom-Left Verified Merchant Badge */}
        <div className="absolute bottom-1.5 left-2 z-10">
          <span
            className={`inline-flex items-center text-[9px] font-mono px-1.5 py-0.5 rounded border shadow-xs ${
              sourceName.includes('Amazon')
                ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-600/40'
                : sourceName.includes('Flipkart')
                ? 'bg-blue-100 dark:bg-blue-950/80 text-blue-900 dark:text-blue-200 border-blue-300 dark:border-blue-600/40'
                : 'bg-white/90 dark:bg-zinc-900/90 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-white/10'
            }`}
          >
            {sourceName}
          </span>
        </div>
      </div>

      {/* 3. Compact Card Body */}
      <div className="p-3 sm:p-3.5 flex-1 flex flex-col justify-between space-y-2">
        <div className="space-y-1.5">
          {/* Product Title: 1-2 lines */}
          <h3
            className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-zinc-100 leading-snug line-clamp-2"
            title={product.name}
          >
            {product.name}
          </h3>

          {/* Pricing & Rating in Compact Single Row */}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-mono tracking-tight">
                ₹{product.price.toLocaleString('en-IN')}
              </span>
              {product.originalPrice && product.originalPrice > product.price && (
                <span className="text-[10px] text-slate-400 dark:text-zinc-500 line-through font-mono">
                  ₹{product.originalPrice.toLocaleString('en-IN')}
                </span>
              )}
              {discountPercent !== null && discountPercent > 0 && (
                <span className="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-400">
                  {discountPercent}% OFF
                </span>
              )}
            </div>

            {/* Rating / Review */}
            {product.rating !== null && product.rating !== undefined ? (
              <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-500/30 px-1.5 py-0.5 rounded">
                <Star className="w-3 h-3 fill-amber-400 text-amber-500 shrink-0" />
                <span>{product.rating}</span>
                {product.reviewCount !== null && product.reviewCount !== undefined && (
                  <span className="text-slate-400 dark:text-zinc-500 text-[10px] font-normal">
                    ({product.reviewCount.toLocaleString('en-IN')})
                  </span>
                )}
              </div>
            ) : product.deliveryDays ? (
              <div className="flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-400">
                <Truck className="w-3 h-3 shrink-0" />
                <span className="truncate max-w-[120px]">{product.deliveryDays}</span>
              </div>
            ) : null}
          </div>

          {/* Compact Important Specs (2 prominent inline tags) */}
          <div className="flex flex-wrap gap-1 pt-0.5 text-[10px]">
            {product.specs.cpu && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/5 text-slate-700 dark:text-zinc-300 truncate max-w-[180px]">
                <Cpu className="w-3 h-3 text-purple-600 dark:text-purple-400 shrink-0" />
                <span className="truncate" title={product.specs.cpu}>{product.specs.cpu}</span>
              </div>
            )}
            {product.specs.ram && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/5 text-slate-700 dark:text-zinc-300 truncate">
                <HardDrive className="w-3 h-3 text-pink-600 dark:text-pink-400 shrink-0" />
                <span className="truncate">{product.specs.ram}</span>
              </div>
            )}
            {product.specs.gpu && !product.specs.ram && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/5 text-slate-700 dark:text-zinc-300 truncate max-w-[180px]">
                <Sparkles className="w-3 h-3 text-cyan-600 dark:text-cyan-400 shrink-0" />
                <span className="truncate" title={product.specs.gpu}>{product.specs.gpu}</span>
              </div>
            )}
          </div>
        </div>

        {/* 4. Action Row */}
        <div className="pt-2 border-t border-slate-200 dark:border-white/10 space-y-1.5">
          <div className="flex items-center gap-1.5 w-full">
            {product.productUrl ? (
              <a
                href={product.productUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shadow-xs ${
                  sourceName.includes('Amazon')
                    ? 'bg-amber-600 hover:bg-amber-500 text-white'
                    : sourceName.includes('Flipkart')
                    ? 'bg-blue-600 hover:bg-blue-500 text-white'
                    : 'bg-slate-900 hover:bg-slate-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900'
                }`}
              >
                <span>View on {sourceName}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <button
                type="button"
                onClick={() => onSelect(product)}
                disabled={isSelecting || verStatus === 'UNAVAILABLE'}
                className="flex-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 transition-all flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {isSelecting ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Preparing...</span>
                  </>
                ) : (
                  <>
                    <span>Select Option</span>
                    <ArrowRight className="w-3 h-3" />
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => onOpenDetails(product)}
              className="py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-slate-200 dark:border-white/10 text-xs font-medium text-slate-700 dark:text-zinc-300 transition-colors flex items-center gap-1 cursor-pointer shrink-0"
              title="Compare all specs side-by-side"
            >
              <Layers className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
              <span className="hidden sm:inline text-[11px]">Compare</span>
            </button>

            <button
              type="button"
              onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
              className="py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-slate-200 dark:border-white/10 text-xs text-slate-600 dark:text-zinc-400 transition-colors cursor-pointer shrink-0"
              title={isDetailsExpanded ? 'Hide Specs' : 'More Specs'}
            >
              {isDetailsExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>

          {/* Expandable Full Specs & AI Reasoning */}
          <AnimatePresence>
            {isDetailsExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden space-y-2 pt-1.5 text-[11px]"
              >
                {product.whyThisText && (
                  <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-500/20 text-slate-700 dark:text-zinc-300">
                    <span className="font-semibold text-purple-700 dark:text-cyan-300 block mb-0.5">AI Match Reasoning:</span>
                    <p className="text-[10px] leading-relaxed text-slate-600 dark:text-zinc-300">{product.whyThisText}</p>
                  </div>
                )}

                <div className="p-2 rounded-lg bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/5 space-y-1">
                  <span className="font-semibold text-slate-800 dark:text-zinc-300 text-[10px] uppercase tracking-wider block">Full Specifications</span>
                  <div className="grid grid-cols-2 gap-1 text-[10px]">
                    {product.specs.cpu && <div><span className="text-slate-400 dark:text-zinc-500">CPU: </span><span className="font-medium text-slate-700 dark:text-zinc-200">{product.specs.cpu}</span></div>}
                    {product.specs.gpu && <div><span className="text-slate-400 dark:text-zinc-500">GPU: </span><span className="font-medium text-slate-700 dark:text-zinc-200">{product.specs.gpu}</span></div>}
                    {product.specs.ram && <div><span className="text-slate-400 dark:text-zinc-500">RAM: </span><span className="font-medium text-slate-700 dark:text-zinc-200">{product.specs.ram}</span></div>}
                    {product.specs.storage && <div><span className="text-slate-400 dark:text-zinc-500">Storage: </span><span className="font-medium text-slate-700 dark:text-zinc-200">{product.specs.storage}</span></div>}
                    {product.specs.display && <div className="col-span-2"><span className="text-slate-400 dark:text-zinc-500">Display: </span><span className="font-medium text-slate-700 dark:text-zinc-200">{product.specs.display}</span></div>}
                  </div>
                </div>

                {/* Micro Feedback */}
                <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-zinc-500 pt-0.5">
                  <span>Helpful recommendation?</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setFeedbackRating('positive');
                        onFeedback?.(product, 'positive');
                      }}
                      className={`px-1.5 py-0.5 rounded text-[10px] ${feedbackRating === 'positive' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'hover:bg-slate-100 dark:hover:bg-white/5'}`}
                    >
                      👍 Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFeedbackRating('negative');
                        onFeedback?.(product, 'negative');
                      }}
                      className={`px-1.5 py-0.5 rounded text-[10px] ${feedbackRating === 'negative' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' : 'hover:bg-slate-100 dark:hover:bg-white/5'}`}
                    >
                      👎 No
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};
