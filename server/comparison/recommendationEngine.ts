import type { SearchRequirements } from '../types/agent';
import type { NormalizedProduct, NormalizedBusResult } from '../types/provider';
import type { RecommendationResult, ComparisonSummary } from './types';
import type { UserPersonalizationProfile } from '../types/personalization';
import { ConstraintFilter } from './constraintFilter';
import { RankingEngine } from './rankingEngine';
import { ComparisonEngine } from './comparisonEngine';
import { logger } from '../utils/logger';

export interface RecommendationEngineOutput<T> {
  hasMatches: boolean;
  recommendations: RecommendationResult<T>[];
  totalEligible: number;
  excludedCount: number;
  closeMatches: T[];
  suggestedRelaxations?: string[];
  comparisonSummary?: ComparisonSummary;
  noMatchReason?: string;
}

export class RecommendationEngine {
  /**
   * Process products through Constraint Filter -> Ranking -> Recommendation Pipeline
   */
  static processProducts(
    products: NormalizedProduct[],
    requirements: SearchRequirements,
    rawText: string = '',
    profile?: UserPersonalizationProfile
  ): RecommendationEngineOutput<NormalizedProduct> {
    logger.info(`RecommendationEngine processing ${products.length} product(s)`);

    // 1. Constraint Filtering
    const filterResult = ConstraintFilter.filterProducts(products, requirements);

    if (!filterResult.hasMatches) {
      const maxBudget = requirements.budget?.max;
      const reason = maxBudget
        ? `No available products satisfy both the ₹${maxBudget.toLocaleString('en-IN')} budget and specified constraints.`
        : 'No products meet the required criteria.';

      logger.info('No exact matches found for requirements', { reason, relaxations: filterResult.suggestedRelaxations });

      return {
        hasMatches: false,
        recommendations: [],
        totalEligible: 0,
        excludedCount: filterResult.excluded.length,
        closeMatches:
          filterResult.partialMatches.length > 0
            ? filterResult.partialMatches.map((p) => p.item)
            : filterResult.excluded.map((e) => e.item),
        suggestedRelaxations: filterResult.suggestedRelaxations,
        noMatchReason: reason,
      };
    }

    // 2. Ranking & Scoring of Eligible Items
    const recommendations = RankingEngine.rankProducts(filterResult.eligible, requirements, rawText, profile);

    // 3. Comparison Summary
    const comparisonSummary = ComparisonEngine.summarizeProducts(filterResult.eligible);

    return {
      hasMatches: true,
      recommendations,
      totalEligible: filterResult.eligible.length,
      excludedCount: filterResult.excluded.length,
      closeMatches: filterResult.partialMatches.map((p) => p.item),
      comparisonSummary,
    };
  }

  /**
   * Process buses through Constraint Filter -> Ranking -> Recommendation Pipeline
   */
  static processBuses(
    buses: NormalizedBusResult[],
    requirements: SearchRequirements,
    rawText: string = '',
    profile?: UserPersonalizationProfile
  ): RecommendationEngineOutput<NormalizedBusResult> {
    logger.info(`RecommendationEngine processing ${buses.length} bus route(s)`);

    // 1. Constraint Filtering
    const filterResult = ConstraintFilter.filterBuses(buses, requirements);

    if (!filterResult.hasMatches) {
      const reason = `No buses found matching ${requirements.source || ''} to ${requirements.destination || ''}${
        requirements.departureAfter ? ` after ${requirements.departureAfter}` : ''
      }.`;

      return {
        hasMatches: false,
        recommendations: [],
        totalEligible: 0,
        excludedCount: filterResult.excluded.length,
        closeMatches: filterResult.partialMatches.map((p) => p.item),
        suggestedRelaxations: filterResult.suggestedRelaxations,
        noMatchReason: reason,
      };
    }

    // 2. Ranking & Scoring
    const recommendations = RankingEngine.rankBuses(filterResult.eligible, requirements, rawText, profile);

    return {
      hasMatches: true,
      recommendations,
      totalEligible: filterResult.eligible.length,
      excludedCount: filterResult.excluded.length,
      closeMatches: filterResult.partialMatches.map((p) => p.item),
    };
  }
}
