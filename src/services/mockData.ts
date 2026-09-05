/**
 * LifeOps Client Mock & Scaffold Definitions
 *
 * In production autonomous flows, all recommendations and preparations
 * are strictly fetched from the live backend API (/api/agent/message).
 * Prefilled demo catalogs and hardcoded conversations have been removed.
 */

import type { ProductItem, HistoryItem, AgentThought } from '../types/agent';

export const mockLaptopResults: ProductItem[] = [];

export const mockInitialHistory: HistoryItem[] = [];

export const mockAgentThoughts: Record<string, AgentThought[]> = {
  laptop: [
    {
      id: 't-1',
      step: 'Requirement Analysis',
      message: 'Extracting structured search constraints',
      detail: 'Budget and category parsed.',
      time: '0.2s',
      status: 'completed',
    },
    {
      id: 't-2',
      step: 'Provider Inquiry',
      message: 'Querying verified inventory adapters',
      detail: 'Catalog scanned for matching entries.',
      time: '0.6s',
      status: 'completed',
    },
    {
      id: 't-3',
      step: 'Comparison Engine',
      message: 'Scoring multi-factor weighting model',
      detail: 'Ranking trade-offs evaluated.',
      time: '1.0s',
      status: 'completed',
    },
    {
      id: 't-4',
      step: 'Real-time Verification',
      message: 'Verifying availability and pricing integrity',
      detail: 'Provider verification confirmed.',
      time: '1.4s',
      status: 'completed',
    },
    {
      id: 't-5',
      step: 'Recommendations Formulated',
      message: 'Synthesizing verified options for review',
      detail: 'Ready for user interaction.',
      time: '1.8s',
      status: 'completed',
    },
  ],
};
