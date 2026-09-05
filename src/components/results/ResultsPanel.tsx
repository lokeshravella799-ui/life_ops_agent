import React, { useState } from 'react';
import type {
  ProductItem,
  ComparisonSummary,
  PreferenceConflict,
  ProactiveRelaxationOption,
  SessionPreferences,
  EffectivePreferences,
} from '../../types/agent';
import { ResultCard } from './ResultCard';
import { ComparisonModal } from './ComparisonModal';
import {
  Sparkles,
  SlidersHorizontal,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Zap,
  TrendingUp,
  Tag,
  Clock,
  RotateCcw,
  Scale,
  Bot,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ResultsPanelProps {
  products: ProductItem[];
  onSelectProduct: (product: ProductItem) => void;
  onBackToSearch?: () => void;
  selectedProduct?: ProductItem | null;
  comparisonSummary?: ComparisonSummary;
  hasMatches?: boolean;
  suggestedRelaxations?: string[];
  activeQuery?: string;
  onApplyRelaxation?: (relaxation: string) => void;
  errorMessage?: string;
  selectingProductId?: string;
  preferenceConflicts?: PreferenceConflict[];
  relaxationOptions?: ProactiveRelaxationOption[];
  activeSessionPreferences?: SessionPreferences | null;
  effectivePreferences?: EffectivePreferences | null;
  activePersonaId?: string;
  stagedInferences?: import('../../types/agent').StagedInference[];
  onSelectConflictOption?: (label: string) => void;
  onRejectRelaxation?: () => void;
  onSwitchPersona?: (personaId: 'personal' | 'work') => void;
  onAcceptInference?: (inferenceId: string) => void;
  onRejectInference?: (inferenceId: string) => void;
  onFeedback?: (product: ProductItem, rating: 'positive' | 'negative', reason?: string) => void;
  aiAnalysisSummary?: string | null;
}

export const ResultsPanel: React.FC<ResultsPanelProps> = ({
  products,
  onSelectProduct,
  selectedProduct,
  comparisonSummary,
  hasMatches = true,
  suggestedRelaxations = [],
  activeQuery,
  onApplyRelaxation,
  errorMessage,
  selectingProductId,
  preferenceConflicts = [],
  relaxationOptions = [],
  activeSessionPreferences,
  effectivePreferences,
  activePersonaId = 'personal',
  stagedInferences = [],
  onSelectConflictOption,
  onRejectRelaxation,
  onSwitchPersona,
  onAcceptInference,
  onRejectInference,
  onFeedback,
  aiAnalysisSummary,
}) => {
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [isAiSummaryExpanded, setIsAiSummaryExpanded] = useState(true);
  const [copiedSummary, setCopiedSummary] = useState(false);

  const handleCopySummary = async () => {
    if (!aiAnalysisSummary) return;
    try {
      await navigator.clipboard.writeText(aiAnalysisSummary);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2000);
    } catch (err) {
      console.warn('Failed to copy AI summary:', err);
    }
  };

  const renderFormattedParagraph = (text: string, pIdx: number) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return (
      <p key={pIdx} className="text-slate-700 dark:text-zinc-200 text-xs sm:text-sm leading-relaxed font-normal">
        {parts.map((part, idx) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <strong key={idx} className="font-semibold text-cyan-700 dark:text-cyan-300">
                {part.slice(2, -2)}
              </strong>
            );
          }
          return part;
        })}
      </p>
    );
  };

  // Dynamic header subtitle based on backend data
  const comparedCount = comparisonSummary?.comparedCount ?? products.length;
  const subtitle =
    comparedCount > 0
      ? `Evaluated ${comparedCount} live option(s) across provider adapters • Top ${products.length} ranked match(es)`
      : `Live multi-provider evaluation complete`;

  // 1. Preference Conflict Clarification UI (Pauses execution, presents explicit choices)
  if (preferenceConflicts.length > 0 && products.length === 0) {
    const conflict = preferenceConflicts[0];
    return (
      <div className="w-full flex flex-col space-y-6 pb-8">
        <div className="p-6 rounded-2xl bg-gradient-to-b from-[#141026]/95 to-[#0c0a18]/95 border border-purple-500/40 backdrop-blur-xl shadow-2xl space-y-5">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-300 shrink-0">
              <Scale className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-purple-400 bg-purple-950/80 border border-purple-500/40 px-2 py-0.5 rounded-full">
                  Clarification Required
                </span>
                <span className="text-[11px] font-mono text-zinc-400">
                  Zero execution until clarified
                </span>
              </div>
              <h3 className="text-lg font-bold text-white tracking-tight">
                Preference Conflict Detected
              </h3>
              <p className="text-xs sm:text-sm text-zinc-300 font-light leading-relaxed">
                {conflict.suggestedClarification}
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 text-xs text-zinc-400">
            <span className="font-medium text-zinc-300">Context: </span>
            {conflict.description}
          </div>

          {/* Explicit Choice Buttons */}
          <div className="space-y-3 pt-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              Choose how you want to proceed for this search:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {conflict.options.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onSelectConflictOption?.(opt.label)}
                  className="p-4 rounded-xl text-left bg-zinc-900/80 hover:bg-purple-950/40 border border-white/10 hover:border-cyan-400/50 transition-all duration-200 group flex flex-col justify-between space-y-2 shadow-md hover:shadow-cyan-950/30"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors">
                      {opt.label}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500 uppercase">
                      {opt.scope}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 font-light leading-normal">
                    {opt.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. Zero-Result Proactive Relaxation UI
  if (!hasMatches && products.length === 0) {
    return (
      <div className="w-full flex flex-col space-y-6 pb-8">
        <div className="p-6 rounded-2xl bg-[#0e0e1a]/95 border border-amber-500/40 backdrop-blur-xl shadow-2xl space-y-5">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-400 bg-amber-950/80 border border-amber-500/40 px-2 py-0.5 rounded-full">
                  Zero Verified Matches
                </span>
              </div>
              <h3 className="text-lg font-bold text-white">
                No Verified Inventory Matches Current Constraints
              </h3>
              <p className="text-xs sm:text-sm text-zinc-300 font-light leading-relaxed">
                None of the catalog entries satisfied all strict constraints for: "{activeQuery || 'your search'}".
                Constraints are <strong className="text-white">never automatically relaxed</strong>.
              </p>
            </div>
          </div>

          {/* Proactive Relaxation Options */}
          {relaxationOptions.length > 0 ? (
            <div className="space-y-3 pt-2 border-t border-white/5">
              <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-cyan-400" />
                Select an option to proactively adjust criteria:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {relaxationOptions.map((opt) => {
                  const Icon =
                    opt.type === 'INCREASE_BUDGET'
                      ? TrendingUp
                      : opt.type === 'ALLOW_OTHER_BRANDS' || opt.type === 'REMOVE_BRAND_EXCLUSION'
                      ? Tag
                      : opt.type === 'EXPAND_TIME_WINDOW'
                      ? Clock
                      : Sparkles;

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onApplyRelaxation?.(opt.label)}
                      className="p-4 rounded-xl text-left bg-zinc-900/80 hover:bg-cyan-950/40 border border-white/10 hover:border-cyan-500/40 transition-all duration-200 group flex flex-col justify-between space-y-2 shadow-md hover:shadow-cyan-950/30"
                    >
                      <div className="flex items-center gap-2 text-cyan-300 font-semibold text-xs">
                        <Icon className="w-4 h-4 text-cyan-400" />
                        <span>{opt.label}</span>
                      </div>
                      <p className="text-[11px] text-zinc-400 font-light leading-normal">
                        {opt.description}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Explicit Reject Button */}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => onRejectRelaxation?.()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-xs text-zinc-400 hover:text-white transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Keep Constraints (Do Not Relax)</span>
                </button>
              </div>
            </div>
          ) : suggestedRelaxations.length > 0 ? (
            <div className="space-y-2 pt-2 border-t border-white/5">
              <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-cyan-400" />
                Suggested Constraint Relaxations:
              </span>
              <div className="flex flex-wrap gap-2">
                {suggestedRelaxations.map((relaxation, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onApplyRelaxation?.(relaxation)}
                    className="px-3 py-1.5 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 border border-white/10 hover:border-cyan-500/40 text-xs text-cyan-300 font-medium transition-colors"
                  >
                    + {relaxation}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  // Check if active session overrides exist
  const hasSessionOverrides = Boolean(
    activeSessionPreferences &&
      (activeSessionPreferences.rankingPriority ||
        activeSessionPreferences.bypassBrandPreferences ||
        activeSessionPreferences.preferredBrands?.length ||
        activeSessionPreferences.excludedBrands?.length ||
        activeSessionPreferences.preferredDepartureTimeWindow ||
        activeSessionPreferences.ignoreSavedPreferences)
  );

  return (
    <div className="w-full flex flex-col space-y-6 pb-8">
      {/* Active Session Overrides Banner */}
      {hasSessionOverrides && (
        <div className="p-3.5 rounded-xl bg-gradient-to-r from-cyan-950/60 via-purple-950/50 to-zinc-900/80 border border-cyan-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs shadow-lg">
          <div className="flex items-center gap-2 text-cyan-300 font-medium">
            <Zap className="w-4 h-4 text-cyan-400 shrink-0 animate-pulse" />
            <span>Active Session Overrides Applied:</span>
            <div className="flex flex-wrap gap-1.5">
              {activeSessionPreferences?.rankingPriority && (
                <span className="px-2 py-0.5 rounded-md bg-cyan-900/60 border border-cyan-400/40 font-mono text-[11px] text-white">
                  Priority: {activeSessionPreferences.rankingPriority.replace('_', ' ')}
                </span>
              )}
              {activeSessionPreferences?.bypassBrandPreferences && (
                <span className="px-2 py-0.5 rounded-md bg-purple-900/60 border border-purple-400/40 font-mono text-[11px] text-white">
                  Brand Priority Bypassed
                </span>
              )}
              {activeSessionPreferences?.preferredDepartureTimeWindow && (
                <span className="px-2 py-0.5 rounded-md bg-indigo-900/60 border border-indigo-400/40 font-mono text-[11px] text-white">
                  Departure: {activeSessionPreferences.preferredDepartureTimeWindow}
                </span>
              )}
              {effectivePreferences?.ignoredPreferences && effectivePreferences.ignoredPreferences.length > 0 && (
                <span className="px-2 py-0.5 rounded-md bg-amber-950/60 border border-amber-500/30 font-mono text-[11px] text-amber-300">
                  Ignored: {effectivePreferences.ignoredPreferences.join(', ')}
                </span>
              )}
            </div>
          </div>
          <span className="text-[11px] font-mono text-zinc-400">
            Session only • Global profile intact
          </span>
        </div>
      )}

      {/* Top Results Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
            <Sparkles className="w-3.5 h-3.5 text-pink-400" />
            <span>Multi-Factor Synthesis Complete</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight mt-1">
            Recommended Options for You
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 font-light mt-0.5">
            {subtitle}
          </p>
          <div className="flex items-center gap-2 mt-2.5">
            <span className="text-xs text-zinc-400">Active Persona:</span>
            <button
              type="button"
              onClick={() => onSwitchPersona?.('personal')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                activePersonaId === 'personal'
                  ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/60 shadow-sm shadow-cyan-950/40'
                  : 'bg-zinc-900/40 text-zinc-400 border-white/5 hover:border-white/15'
              }`}
            >
              Personal
            </button>
            <button
              type="button"
              onClick={() => onSwitchPersona?.('work')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                activePersonaId === 'work'
                  ? 'bg-purple-950/80 text-purple-300 border-purple-500/60 shadow-sm shadow-purple-950/40'
                  : 'bg-zinc-900/40 text-zinc-400 border-white/5 hover:border-white/15'
              }`}
            >
              Work
            </button>
          </div>
        </div>

        {/* Action Controls: Compare All Specs */}
        {products.length > 1 && (
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsComparisonOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-gradient-to-r dark:from-purple-950/80 dark:to-cyan-950/80 dark:hover:from-purple-900/90 dark:hover:to-cyan-900/90 border border-purple-200 dark:border-cyan-500/40 text-xs font-semibold text-purple-900 dark:text-cyan-200 hover:text-purple-950 dark:hover:text-white transition-all shadow-sm group"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-purple-600 dark:text-cyan-400 group-hover:rotate-90 transition-transform duration-300" />
              <span>Compare Specs Side-by-Side</span>
            </button>
          </div>
        )}
      </div>

      {/* AI Agent Executive Briefing & Market Synthesis */}
      {aiAnalysisSummary && (
        <div className="rounded-2xl bg-white dark:bg-gradient-to-b dark:from-[#0b0c1b]/95 dark:via-[#080814]/95 dark:to-[#05050d]/95 border border-slate-200 dark:border-cyan-500/30 shadow-md dark:shadow-2xl backdrop-blur-xl overflow-hidden">
          <div className="p-4 sm:p-5 flex items-center justify-between gap-3 border-b border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-600 dark:text-cyan-300 shadow-sm">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white tracking-wide">
                    Agent Market Synthesis & Reasoning
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-950/80 border border-cyan-200 dark:border-cyan-500/40 text-cyan-700 dark:text-cyan-300">
                    Live Evaluation
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-light">
                  Direct evaluation summary and comparative advice across live providers
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopySummary}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 rounded-lg border border-slate-200 dark:border-white/10 transition-colors cursor-pointer"
                title="Copy AI analysis"
              >
                {copiedSummary ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                    <span className="text-emerald-600 dark:text-emerald-400 text-[11px]">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-400" />
                    <span className="text-[11px]">Copy</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setIsAiSummaryExpanded(!isAiSummaryExpanded)}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 rounded-lg border border-slate-200 dark:border-white/10 transition-colors cursor-pointer"
              >
                <span className="text-[11px]">{isAiSummaryExpanded ? 'Collapse' : 'Expand'}</span>
                {isAiSummaryExpanded ? (
                  <ChevronUp className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-400" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-400" />
                )}
              </button>
            </div>
          </div>

          {isAiSummaryExpanded && (
            <div className="p-4 sm:p-5 space-y-3">
              {aiAnalysisSummary
                .split('\n\n')
                .filter((p) => p.trim().length > 0)
                .map((para, idx) => renderFormattedParagraph(para, idx))}
            </div>
          )}
        </div>
      )}

      {/* Staged Inferences Banner */}
      {stagedInferences && stagedInferences.filter((s) => s.status === 'STAGED').length > 0 && (
        <div className="space-y-2">
          {stagedInferences
            .filter((s) => s.status === 'STAGED')
            .map((inference) => (
              <div
                key={inference.id}
                className="p-4 rounded-xl bg-purple-50/70 dark:bg-gradient-to-r dark:from-purple-950/80 dark:via-cyan-950/60 dark:to-zinc-900/80 border border-purple-200 dark:border-purple-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm dark:shadow-lg"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 dark:bg-purple-500/20 border border-purple-300 dark:border-purple-400/40 flex items-center justify-center text-purple-600 dark:text-purple-300 shrink-0">
                    <Sparkles className="w-4 h-4 text-cyan-600 dark:text-cyan-300" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-700 dark:text-cyan-300 bg-cyan-100/70 dark:bg-cyan-950/70 border border-cyan-300 dark:border-cyan-500/30 px-1.5 py-0.5 rounded">
                        Learned Preference
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 dark:text-zinc-400">
                        {Math.round(inference.confidence * 100)}% Confidence
                      </span>
                    </div>
                    <p className="text-xs text-slate-900 dark:text-white font-medium mt-1">
                      {inference.reason}
                    </p>
                    <p className="text-[11px] text-slate-600 dark:text-zinc-400 mt-0.5">
                      Would you like to save <strong className="text-slate-900 dark:text-zinc-200">{inference.inferredValue}</strong> to your preferred brands in your {activePersonaId} profile?
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onAcceptInference?.(inference.id)}
                    className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-500 hover:brightness-110 text-white text-xs font-semibold shadow-sm transition-all"
                  >
                    Add to Profile
                  </button>
                  <button
                    type="button"
                    onClick={() => onRejectInference?.(inference.id)}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 text-xs font-medium border border-slate-200 dark:border-white/10 transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Notice / Alert Banner */}
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-500/40 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2.5 shadow-sm dark:shadow-lg">
          <AlertCircle className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Product Match Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {products.map((product, idx) => (
          <ResultCard
            key={product.id}
            product={product}
            rank={product.rank || idx + 1}
            isSelected={selectedProduct?.id === product.id}
            isSelecting={selectingProductId === product.id}
            onSelect={onSelectProduct}
            onOpenDetails={() => setIsComparisonOpen(true)}
            onFeedback={onFeedback}
          />
        ))}
      </div>

      {/* Bottom helper prompt */}
      <div className="p-4 rounded-xl bg-slate-100 dark:bg-zinc-900/40 border border-slate-200 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600 dark:text-zinc-400">
        <div className="flex items-center gap-2 text-slate-700 dark:text-zinc-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
          <span>
            Click <strong className="text-slate-900 dark:text-white">"Select Option"</strong> on any card to review transparent pricing and proceed safely.
          </span>
        </div>
        <span className="text-[11px] font-mono text-slate-500 dark:text-zinc-500">
          No charges will occur without explicit confirmation
        </span>
      </div>

      {/* Comparison Modal */}
      <ComparisonModal
        isOpen={isComparisonOpen}
        onClose={() => setIsComparisonOpen(false)}
        products={products}
        onSelectProduct={onSelectProduct}
      />
    </div>
  );
};
