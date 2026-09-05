import React, { useState } from 'react';
import { Sparkles, Volume2, VolumeX, Copy, Check, ArrowLeft, Lightbulb, MessageSquare } from 'lucide-react';
import { motion } from 'framer-motion';

interface ConversationalAnswerPanelProps {
  answer: string;
  activeQuery?: string;
  recommendations?: string[];
  isSpeaking?: boolean;
  onSpeakAgain?: () => void;
  onStopSpeaking?: () => void;
  onNewSearch?: () => void;
  onSelectSuggestion?: (query: string) => void;
}

export const ConversationalAnswerPanel: React.FC<ConversationalAnswerPanelProps> = ({
  answer,
  activeQuery,
  recommendations,
  isSpeaking = false,
  onSpeakAgain,
  onStopSpeaking,
  onNewSearch,
  onSelectSuggestion,
}) => {
  const [copied, setCopied] = useState(false);

  // Derive EXACTLY 3 contextual recommendations
  const get3Recommendations = (): string[] => {
    if (recommendations && recommendations.length >= 3) {
      return recommendations.slice(0, 3);
    }

    const q = (activeQuery || '').toLowerCase();
    const ans = (answer || '').toLowerCase();

    if (q.includes('bus') || q.includes('ticket') || q.includes('travel') || ans.includes('bus') || ans.includes('departure')) {
      return ['Find buses to Chennai', 'Show cheaper options', 'Book the selected bus'];
    }
    if (q.includes('laptop') || q.includes('computer') || q.includes('macbook') || ans.includes('laptop') || ans.includes('processor')) {
      return ['Compare these laptops', 'Show the best option', 'Find one under ₹80,000'];
    }
    if (q.includes('c++') || q.includes('code') || q.includes('python') || q.includes('programming') || ans.includes('type conversion') || ans.includes('c++')) {
      return ['Explain with an example', 'Show a simpler version', 'Give me practice questions'];
    }
    if (q.includes('location') || ans.includes('hyderabad') || ans.includes('location')) {
      return ['Find services near me', 'Book a bus from here', 'Explore nearby places'];
    }

    return ['Explain with an example', 'Show a simpler version', 'Give me practice questions'];
  };

  const suggestions = get3Recommendations();


  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(answer);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Failed to copy to clipboard:', err);
    }
  };

  // Helper to parse inline markdown (bold, code)
  const renderInlineText = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={idx} className="font-semibold text-cyan-700 dark:text-cyan-300">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={idx} className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-pink-600 dark:text-pink-300 font-mono text-xs">
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  // Rich markdown block renderer
  const renderMarkdownBlock = (block: string, bIdx: number) => {
    const trimmed = block.trim();
    if (!trimmed) return null;

    // Code block
    if (trimmed.startsWith('```')) {
      const lines = trimmed.split('\n');
      const lang = lines[0].replace(/```/g, '').trim();
      const code = lines.slice(1, lines[lines.length - 1].startsWith('```') ? -1 : undefined).join('\n');
      return (
        <div key={bIdx} className="my-3 rounded-xl overflow-hidden border border-slate-300 dark:border-white/10 bg-slate-900 text-slate-100 font-mono text-xs sm:text-sm shadow-sm">
          {lang && (
            <div className="px-3 py-1 bg-slate-800 text-[11px] text-slate-400 uppercase font-semibold border-b border-slate-700">
              {lang}
            </div>
          )}
          <pre className="p-3.5 overflow-x-auto leading-relaxed">
            <code>{code}</code>
          </pre>
        </div>
      );
    }

    // Markdown Table
    if (trimmed.includes('|') && trimmed.split('\n').filter((l) => l.trim().startsWith('|')).length >= 2) {
      const rows = trimmed.split('\n').filter((l) => l.trim().startsWith('|'));
      const headerRow = rows[0].split('|').map((c) => c.trim()).filter(Boolean);
      const isDivider = (r: string) => r.replace(/[\s|:-]/g, '').length === 0;
      const dataRows = rows.slice(1).filter((r) => !isDivider(r)).map((r) => r.split('|').map((c) => c.trim()).filter(Boolean));

      return (
        <div key={bIdx} className="my-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10 shadow-xs">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-white/[0.04] border-b border-slate-200 dark:border-white/10">
                {headerRow.map((h, i) => (
                  <th key={i} className="p-2.5 font-bold text-slate-900 dark:text-zinc-100 font-mono text-[11px] uppercase">
                    {renderInlineText(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-white/5">
              {dataRows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-slate-50/80 dark:hover:bg-white/[0.02]">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="p-2.5 text-slate-800 dark:text-zinc-300">
                      {renderInlineText(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    // Headings (###, ##, #)
    if (trimmed.startsWith('### ')) {
      return (
        <h4 key={bIdx} className="text-sm sm:text-base font-bold text-slate-900 dark:text-white mt-3 mb-1.5 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
          {renderInlineText(trimmed.replace(/^###\s+/, ''))}
        </h4>
      );
    }
    if (trimmed.startsWith('## ')) {
      return (
        <h3 key={bIdx} className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-4 mb-2 border-b border-slate-200 dark:border-white/10 pb-1">
          {renderInlineText(trimmed.replace(/^##\s+/, ''))}
        </h3>
      );
    }
    if (trimmed.startsWith('# ')) {
      return (
        <h2 key={bIdx} className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mt-4 mb-2 border-b border-slate-200 dark:border-white/10 pb-1">
          {renderInlineText(trimmed.replace(/^#\s+/, ''))}
        </h2>
      );
    }

    // Bullet List / Numbered List
    const lines = trimmed.split('\n');
    const isBulletList = lines.length > 1 && lines.every((l) => l.trim().match(/^([*•-]|\d+\.)\s+/));
    if (isBulletList) {
      return (
        <ul key={bIdx} className="space-y-1.5 my-2 pl-4 list-disc text-slate-800 dark:text-zinc-200 text-sm sm:text-base leading-relaxed">
          {lines.map((line, lIdx) => (
            <li key={lIdx} className="pl-1">
              {renderInlineText(line.replace(/^([*•-]|\d+\.)\s+/, ''))}
            </li>
          ))}
        </ul>
      );
    }

    // Standard Paragraph
    return (
      <p key={bIdx} className="text-slate-800 dark:text-zinc-100 text-sm sm:text-base leading-relaxed font-normal">
        {renderInlineText(trimmed)}
      </p>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3 }}
      className="max-w-4xl mx-auto space-y-6 pb-8"
    >
      {/* 1. Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-300 shadow-md shadow-cyan-900/10">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              LifeOps AI Response
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-100 dark:bg-cyan-950/60 border border-cyan-300 dark:border-cyan-500/30 text-cyan-800 dark:text-cyan-300">
                Live English Output
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 font-light">
              Conversational intelligence & verified agent reasoning
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onNewSearch && (
            <button
              onClick={onNewSearch}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 rounded-xl border border-slate-200 dark:border-white/10 transition-colors cursor-pointer shadow-sm"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span>New Search</span>
            </button>
          )}

          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:text-slate-950 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 rounded-xl border border-slate-200 dark:border-white/10 transition-colors cursor-pointer shadow-sm"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-400" />
                <span>Copy</span>
              </>
            )}
          </button>

          {isSpeaking ? (
            <button
              onClick={onStopSpeaking}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-red-600 dark:bg-red-950/80 hover:bg-red-700 dark:hover:bg-red-900/80 rounded-xl border border-red-500/40 transition-colors shadow-sm cursor-pointer"
            >
              <VolumeX className="w-3.5 h-3.5 text-white dark:text-red-400" />
              <span>Stop Speaking</span>
            </button>
          ) : (
            onSpeakAgain && (
              <button
                onClick={onSpeakAgain}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-cyan-800 dark:text-cyan-200 hover:text-cyan-950 dark:hover:text-white bg-cyan-100 hover:bg-cyan-200 dark:bg-cyan-950/60 dark:hover:bg-cyan-900/60 rounded-xl border border-cyan-300 dark:border-cyan-500/40 transition-colors shadow-sm cursor-pointer"
              >
                <Volume2 className="w-3.5 h-3.5 text-cyan-700 dark:text-cyan-400" />
                <span>Listen Again</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* 2. Active Query Reference Card */}
      {activeQuery && (
        <div className="p-3 sm:p-4 rounded-xl bg-slate-100 dark:bg-[#080811] border border-slate-200 dark:border-white/5 flex items-start gap-3 shadow-sm">
          <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800/30 shrink-0 mt-0.5">
            <MessageSquare className="w-3.5 h-3.5" />
          </span>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-zinc-500 block mb-0.5">
              Your Directive
            </span>
            <p className="text-sm font-medium text-slate-800 dark:text-zinc-200 italic">
              "{activeQuery}"
            </p>
          </div>
        </div>
      )}

      {/* 3. Speaking Live Status Pill */}
      {isSpeaking && (
        <div className="p-3 rounded-xl bg-gradient-to-r from-cyan-100 via-purple-100 to-pink-100 dark:from-cyan-950/60 dark:via-purple-950/50 dark:to-pink-950/50 border border-cyan-300 dark:border-cyan-500/40 flex items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-700 dark:text-cyan-400">
              <Volume2 className="w-3 h-3 animate-pulse" />
            </span>
            <span className="text-xs font-medium text-cyan-900 dark:text-cyan-200">
              LifeOps is speaking aloud in natural English. Tap the AI Orb or "Stop Speaking" to interrupt.
            </span>
          </div>
        </div>
      )}

      {/* 4. Main Conversational Response Card */}
      <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#090914]/90 border border-slate-200 dark:border-white/10 shadow-xl shadow-slate-900/5 dark:shadow-2xl backdrop-blur-xl relative overflow-hidden space-y-4">
        {/* Subtle accent corner glow */}
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-cyan-500/5 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-purple-500/5 blur-3xl pointer-events-none" />

        <div className="space-y-4 relative z-10">
          {answer
            .split('\n\n')
            .filter((p) => p.trim().length > 0)
            .map((block, idx) => renderMarkdownBlock(block, idx))}
        </div>
      </div>

      {/* 5. Helpful Contextual Recommendations — EXACTLY 3 HORIZONTALLY IN ONE ROW ON DESKTOP */}
      {onSelectSuggestion && (
        <div className="pt-2 space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-mono text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
            <Lightbulb className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
            <span>Recommended Actions (3 Contextual Steps)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full">
            {suggestions.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectSuggestion(prompt)}
                className="w-full text-xs p-3 rounded-xl bg-white dark:bg-zinc-900/70 hover:bg-purple-50 dark:hover:bg-zinc-800/80 border border-slate-200 dark:border-cyan-500/20 hover:border-cyan-500 dark:hover:border-cyan-400 text-slate-700 dark:text-zinc-200 hover:text-cyan-700 dark:hover:text-cyan-300 transition-all text-center font-medium cursor-pointer shadow-sm flex items-center justify-center gap-2 group truncate"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 group-hover:scale-125 transition-transform shrink-0" />
                <span className="truncate">{prompt}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};

