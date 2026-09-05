import React from 'react';
import type { ProductItem } from '../../types/agent';
import { X, Sparkles, CheckCircle2, AlertCircle, ArrowRight, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: ProductItem[];
  onSelectProduct: (product: ProductItem) => void;
}

export const ComparisonModal: React.FC<ComparisonModalProps> = ({
  isOpen,
  onClose,
  products,
  onSelectProduct,
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/85 backdrop-blur-md"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 260 }}
          className="relative w-full max-w-5xl max-h-[90vh] bg-white dark:bg-[#090912] border border-slate-200 dark:border-white/15 rounded-2xl shadow-2xl overflow-hidden flex flex-col z-10"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-slate-50 dark:bg-[#0e0e1a]/80">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-cyan-400 p-[1.5px]">
                <div className="w-full h-full bg-slate-900 dark:bg-black rounded-[6.5px] flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                </div>
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  LifeOps Technical Matrix & Comparison
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 font-light">
                  Direct evaluation of top recommendations against multi-criteria requirements
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800/80 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto flex-1 p-4 sm:p-6">
            <table className="w-full text-left text-xs border-collapse min-w-[650px]">
              <thead>
                <tr className="border-b border-slate-200 dark:border-white/10">
                  <th className="p-3 font-mono text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-[11px] w-36">
                    Criteria
                  </th>
                  {products.map((p) => (
                    <th key={p.id} className="p-3 w-1/3">
                      <div className="space-y-1">
                        {p.isRecommended && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-cyan-800 dark:text-cyan-300 bg-purple-100 dark:bg-purple-950/80 px-2 py-0.5 rounded-full border border-purple-300 dark:border-purple-500/40">
                            <Sparkles className="w-3 h-3 text-pink-500 dark:text-pink-400" />
                            Top Choice
                          </span>
                        )}
                        <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100 line-clamp-1">{p.name}</h4>
                        <div className="text-base font-extrabold text-cyan-700 dark:text-cyan-300 font-mono">
                          ₹{p.price.toLocaleString('en-IN')}
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200 dark:divide-white/5 font-light">
                {/* AI Affinity Score */}
                <tr className="bg-purple-50/60 dark:bg-purple-950/20">
                  <td className="p-3 font-semibold text-purple-900 dark:text-purple-300 font-mono">Overall Score</td>
                  {products.map((p) => (
                    <td key={p.id} className="p-3">
                      <span className="text-sm font-bold text-purple-950 dark:text-white font-mono bg-purple-100 dark:bg-purple-900/40 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-500/30">
                        {p.scores.aiMatch}% Affinity
                      </span>
                    </td>
                  ))}
                </tr>

                {/* Primary Specs */}
                <tr>
                  <td className="p-3 font-medium text-slate-500 dark:text-zinc-400 font-mono">Primary Spec</td>
                  {products.map((p) => (
                    <td key={p.id} className="p-3 text-slate-800 dark:text-zinc-200 font-medium">
                      {p.specs.cpu}
                    </td>
                  ))}
                </tr>

                {/* Secondary Specs */}
                <tr>
                  <td className="p-3 font-medium text-slate-500 dark:text-zinc-400 font-mono">Secondary Spec</td>
                  {products.map((p) => (
                    <td key={p.id} className="p-3 text-slate-800 dark:text-zinc-200 font-medium">
                      {p.specs.gpu}
                    </td>
                  ))}
                </tr>

                {/* Memory / Capacity */}
                <tr>
                  <td className="p-3 font-medium text-slate-500 dark:text-zinc-400 font-mono">Memory / Capacity</td>
                  {products.map((p) => (
                    <td key={p.id} className="p-3 text-slate-800 dark:text-zinc-200">
                      {p.specs.ram}
                    </td>
                  ))}
                </tr>

                {/* Storage / Details */}
                <tr>
                  <td className="p-3 font-medium text-slate-500 dark:text-zinc-400 font-mono">Storage / Details</td>
                  {products.map((p) => (
                    <td key={p.id} className="p-3 text-slate-800 dark:text-zinc-200">
                      {p.specs.storage}
                    </td>
                  ))}
                </tr>

                {/* Display / Features */}
                <tr>
                  <td className="p-3 font-medium text-slate-500 dark:text-zinc-400 font-mono">Display / Features</td>
                  {products.map((p) => (
                    <td key={p.id} className="p-3 text-slate-800 dark:text-zinc-200">
                      {p.specs.display}
                    </td>
                  ))}
                </tr>

                {/* Battery / Efficiency */}
                <tr>
                  <td className="p-3 font-medium text-slate-500 dark:text-zinc-400 font-mono">Efficiency / Duration</td>
                  {products.map((p) => (
                    <td key={p.id} className="p-3 text-slate-800 dark:text-zinc-200">
                      {p.specs.batteryLife}
                    </td>
                  ))}
                </tr>

                {/* Provider */}
                <tr>
                  <td className="p-3 font-medium text-slate-500 dark:text-zinc-400 font-mono">Provider</td>
                  {products.map((p) => (
                    <td key={p.id} className="p-3 text-slate-800 dark:text-zinc-200 font-medium">
                      {p.provider}
                    </td>
                  ))}
                </tr>

                {/* Pros */}
                <tr>
                  <td className="p-3 font-medium text-emerald-600 dark:text-emerald-400 font-mono">Top Advantages</td>
                  {products.map((p) => (
                    <td key={p.id} className="p-3">
                      <ul className="space-y-1 text-slate-700 dark:text-zinc-300">
                        {p.pros.slice(0, 2).map((pro, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 shrink-0 mt-0.5" />
                            <span>{pro}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                  ))}
                </tr>

                {/* Cons */}
                <tr>
                  <td className="p-3 font-medium text-amber-600 dark:text-amber-400 font-mono">Trade-offs</td>
                  {products.map((p) => (
                    <td key={p.id} className="p-3">
                      <ul className="space-y-1 text-slate-600 dark:text-zinc-400">
                        {p.cons.map((con, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400/80 shrink-0 mt-0.5" />
                            <span>{con}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                  ))}
                </tr>
              </tbody>

              {/* Action Buttons in footer row */}
              <tfoot>
                <tr>
                  <td className="p-3"></td>
                  {products.map((p) => (
                    <td key={p.id} className="p-3">
                      {p.productUrl ? (
                        <a
                          href={p.productUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`w-full py-2.5 px-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-1.5 shadow-sm ${
                            p.source?.toLowerCase().includes('amazon')
                              ? 'bg-gradient-to-r from-amber-600 to-orange-500 text-white hover:brightness-110'
                              : p.source?.toLowerCase().includes('flipkart')
                              ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:brightness-110'
                              : p.isRecommended
                              ? 'bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-500 text-white hover:brightness-110'
                              : 'bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 hover:text-slate-950 dark:hover:text-white border border-slate-200 dark:border-transparent'
                          }`}
                        >
                          <span>
                            {p.source?.toLowerCase().includes('flipkart')
                              ? 'View on Flipkart'
                              : p.source?.toLowerCase().includes('amazon')
                              ? 'View on Amazon'
                              : 'View on Store'}
                          </span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      ) : (
                        <button
                          onClick={() => {
                            onSelectProduct(p);
                            onClose();
                          }}
                          className={`w-full py-2.5 px-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-1.5 shadow-sm ${
                            p.isRecommended
                              ? 'bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-500 text-white hover:brightness-110'
                              : 'bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 hover:text-slate-950 dark:hover:text-white border border-slate-200 dark:border-transparent'
                          }`}
                        >
                          <span>Select Option</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
