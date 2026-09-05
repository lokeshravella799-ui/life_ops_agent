import React from 'react';
import type { AgentState, AgentThought } from '../../types/agent';
import {
  CheckCircle2,
  Clock,
  Sparkles,
  Terminal,
} from 'lucide-react';

interface AgentStatusPanelProps {
  state: AgentState;
  thoughts: AgentThought[];
  activeQuery: string;
}

export const AgentStatusPanel: React.FC<AgentStatusPanelProps> = ({
  state,
  thoughts,
  activeQuery,
}) => {
  const steps = [
    {
      id: 'step-1',
      name: 'Intent Understanding',
      description: 'Extracting requirements, constraints & budget limits',
      stateMatch: ['thinking', 'searching', 'comparing', 'verifying', 'results', 'confirmation', 'processing', 'success'],
    },
    {
      id: 'step-2',
      name: 'Querying Live Provider Adapters',
      description: 'Executing generic multi-provider search across registered adapters',
      stateMatch: ['searching', 'comparing', 'verifying', 'results', 'confirmation', 'processing', 'success'],
    },
    {
      id: 'step-3',
      name: 'Multi-Factor Evaluation & Comparison',
      description: 'Evaluating constraints, scoring weights & trade-offs',
      stateMatch: ['comparing', 'verifying', 'results', 'confirmation', 'processing', 'success'],
    },
    {
      id: 'step-4',
      name: 'Verification & Trust Engine',
      description: 'Validating real-time availability and provider verified prices',
      stateMatch: ['verifying', 'results', 'confirmation', 'processing', 'success'],
    },
    {
      id: 'step-5',
      name: 'Recommendation Ready',
      description: 'Synthesizing top verified match & structured rationale',
      stateMatch: ['results', 'confirmation', 'processing', 'success'],
    },
  ];

  return (
    <div className="w-full max-w-xl mx-auto my-4 p-5 rounded-2xl bg-[#090912]/90 border border-white/10 backdrop-blur-xl shadow-2xl space-y-4">
      {/* Query Banner */}
      {activeQuery && (
        <div className="flex items-center justify-between pb-3 border-b border-white/5 text-xs">
          <span className="text-zinc-500 font-mono flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            Active Objective:
          </span>
          <span className="font-medium text-zinc-200 truncate max-w-xs sm:max-w-sm">
            "{activeQuery}"
          </span>
        </div>
      )}

      {/* Multi-Step Agentic Pipeline */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          Autonomous Pipeline Execution
        </h3>

        <div className="space-y-2">
          {steps.map((step, idx) => {
            const isCompleted =
              step.stateMatch.includes(state) &&
              state !== 'thinking' &&
              (idx < steps.length - 1 || state === 'results' || state === 'confirmation' || state === 'processing' || state === 'success');
            const isActive =
              (idx === 0 && state === 'thinking') ||
              (idx === 1 && state === 'searching') ||
              (idx === 2 && state === 'comparing') ||
              (idx === 3 && state === 'verifying') ||
              (idx === 4 && state === 'results');

            return (
              <div
                key={step.id}
                className={`p-2.5 rounded-xl border transition-all duration-300 flex items-center justify-between gap-3 ${
                  isActive
                    ? 'bg-purple-950/40 border-cyan-400/50 shadow-md shadow-cyan-950/30'
                    : isCompleted
                    ? 'bg-zinc-900/40 border-white/5 text-zinc-400'
                    : 'bg-zinc-950/20 border-transparent text-zinc-600'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="shrink-0">
                    {isCompleted ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : isActive ? (
                      <span className="relative flex h-3.5 w-3.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-cyan-500"></span>
                      </span>
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-zinc-600" />
                    )}
                  </div>
                  <div className="truncate">
                    <p
                      className={`text-xs font-medium truncate ${
                        isActive ? 'text-cyan-300 font-semibold' : isCompleted ? 'text-zinc-300' : 'text-zinc-500'
                      }`}
                    >
                      {step.name}
                    </p>
                    <p className="text-[10px] text-zinc-500 truncate">{step.description}</p>
                  </div>
                </div>

                {isActive && (
                  <span className="text-[10px] font-mono text-cyan-400 animate-pulse uppercase tracking-wider shrink-0 bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-800/40">
                    Running...
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Live Agent Reasoning Console */}
      {thoughts.length > 0 && (
        <div className="pt-2 border-t border-white/5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 flex items-center gap-1">
              <Terminal className="w-3 h-3 text-purple-400" />
              Live Agent Execution Stream
            </span>
            <span className="text-[9px] font-mono text-cyan-400/80">PIPELINE ACTIVE</span>
          </div>

          <div className="max-h-28 overflow-y-auto space-y-1.5 p-2 rounded-xl bg-black/60 border border-white/5 font-mono text-[11px]">
            {thoughts.map((t) => (
              <div key={t.id} className="flex items-start gap-2 leading-tight">
                <span className="text-zinc-600 shrink-0">[{t.time}]</span>
                <span className="text-purple-400 font-medium shrink-0">{t.step}:</span>
                <span className="text-zinc-300">{t.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
