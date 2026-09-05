import type { VerificationMetadata } from '../types/provider';

export type UserObjective =
  | 'CHEAPEST'
  | 'BEST_VALUE'
  | 'BEST_PERFORMANCE'
  | 'HIGHEST_RATED'
  | 'FASTEST'
  | 'MOST_SUITABLE'
  | 'BALANCED'
  | 'USER_DEFINED';

export interface WorkloadProfile {
  name: string;
  description: string;
  priorities: string[];
  weightOverrides?: Record<string, number>;
}

export interface ComparisonFactor {
  name: string;
  label: string;
  score: number; // 0 to 100
  weight: number; // 0 to 1
  reason: string;
  isAvailable?: boolean; // false if data was missing from source
}

export interface ConstraintEvaluation<T> {
  eligible: T[];
  excluded: Array<{
    item: T;
    violatedConstraint: string;
    reason: string;
  }>;
  partialMatches: Array<{
    item: T;
    matchedConstraints: string[];
    unmetConstraints: string[];
    matchRatio: number;
  }>;
  hasMatches: boolean;
  suggestedRelaxations?: string[];
}

export interface RecommendationResult<T = any> {
  resultId: string;
  rank: number;
  overallScore: number;
  item: T;
  whyThisText: string;
  pros: string[];
  cons: string[];
  matchedRequirements: string[];
  unmetPreferences: string[];
  scoreBreakdown: ComparisonFactor[];
  personalizationApplied?: boolean;
  personalizationReason?: string;
  verification?: VerificationMetadata;
  priceChanged?: boolean;
  originalPrice?: number;
  verifiedPrice?: number;
  priceDifference?: number;
  unavailableReason?: string;
}

export interface NoMatchResult {
  hasMatches: false;
  reason: string;
  suggestedRelaxations: string[];
  closeMatches: any[];
}

export interface ComparisonSummary {
  comparedCount: number;
  bestOverallId: string;
  keyDifferentiators: string[];
  pairwiseComparisons?: Array<{
    itemAId: string;
    itemBId: string;
    summary: string;
  }>;
}
