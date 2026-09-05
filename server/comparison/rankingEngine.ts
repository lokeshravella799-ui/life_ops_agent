import type { SearchRequirements } from '../types/agent';
import type { NormalizedProduct, NormalizedBusResult } from '../types/provider';
import type { RecommendationResult } from './types';
import type { UserPersonalizationProfile } from '../types/personalization';
import { ScoringEngine } from './scoringEngine';
import { RationaleGenerator } from './rationaleGenerator';
import { detectObjective, detectWorkload } from './workloadProfiles';

export class RankingEngine {
  /**
   * Deterministically scores, ranks, and annotates products
   */
  static rankProducts(
    products: NormalizedProduct[],
    requirements: SearchRequirements,
    rawText: string = '',
    profile?: UserPersonalizationProfile
  ): RecommendationResult<NormalizedProduct>[] {
    const objective = detectObjective(requirements, rawText);
    const workload = detectWorkload(requirements, rawText);
    const userProfile = profile || requirements.profile;

    // 1. Calculate deterministic scores for each product
    const scoredList = products.map((product) => {
      const { overallScore, factors } = ScoringEngine.scoreProduct(
        product,
        products,
        requirements,
        rawText,
        userProfile
      );
      return {
        product,
        overallScore,
        factors,
      };
    });

    // 2. Deterministic sort: Primary by overallScore descending, secondary by price ascending, tertiary by ID
    scoredList.sort((a, b) => {
      if (b.overallScore !== a.overallScore) {
        return b.overallScore - a.overallScore;
      }
      if (a.product.price.amount !== b.product.price.amount) {
        return a.product.price.amount - b.product.price.amount;
      }
      return a.product.id.localeCompare(b.product.id);
    });

    // 3. Assemble RecommendationResult items without altering the original product
    return scoredList.map((entry, idx) => {
      const rank = idx + 1;
      const whyThisText = RationaleGenerator.generateProductWhyThis(
        entry.product,
        rank,
        requirements,
        objective,
        workload,
        userProfile,
        entry.factors
      );
      const { pros, cons } = RationaleGenerator.generateProductProsCons(
        entry.product,
        requirements,
        entry.factors
      );

      const matchedRequirements: string[] = [];
      if (requirements.budget?.max && entry.product.price.amount <= requirements.budget.max) {
        matchedRequirements.push(`Within ₹${requirements.budget.max.toLocaleString('en-IN')} budget`);
      }
      if (workload?.name === 'gaming' && entry.product.specifications['gpu']) {
        matchedRequirements.push(`Meets gaming GPU priority (${entry.product.specifications['gpu']})`);
      }

      // Check if personalization impacted this item
      const prefBrandFactor = entry.factors.find((f) => f.name === 'preferred_brand');
      let personalizationApplied = false;
      let personalizationReason: string | undefined = undefined;

      const effective = userProfile as any;
      if (effective?.activeSessionOverrides?.rankingPriority === 'lowest_price') {
        personalizationApplied = true;
        personalizationReason = 'Ranked higher because you requested lowest price for this search';
      } else if (effective?.activeSessionOverrides?.preferredBrands?.includes(entry.product.brand)) {
        personalizationApplied = true;
        personalizationReason = `Ranked higher because it matches your session preference for ${entry.product.brand}`;
      } else if (prefBrandFactor) {
        personalizationApplied = true;
        personalizationReason = prefBrandFactor.reason;
        matchedRequirements.push(prefBrandFactor.reason);
      } else if (userProfile?.general.rankingPriority === 'lowest_price') {
        personalizationApplied = true;
        personalizationReason = 'Lower price priority applied from your personalization profile';
      } else if (userProfile?.general.rankingPriority === 'highest_quality') {
        personalizationApplied = true;
        personalizationReason = 'Quality & performance priority applied from your personalization profile';
      }

      return {
        resultId: entry.product.id,
        rank,
        overallScore: entry.overallScore,
        item: entry.product,
        whyThisText,
        pros,
        cons,
        matchedRequirements,
        unmetPreferences: [],
        scoreBreakdown: entry.factors,
        personalizationApplied,
        personalizationReason,
      };
    });
  }

  /**
   * Deterministically scores, ranks, and annotates buses
   */
  static rankBuses(
    buses: NormalizedBusResult[],
    requirements: SearchRequirements,
    rawText: string = '',
    profile?: UserPersonalizationProfile
  ): RecommendationResult<NormalizedBusResult>[] {
    const objective = detectObjective(requirements, rawText);
    const userProfile = profile || requirements.profile;

    const scoredList = buses.map((bus) => {
      const { overallScore, factors } = ScoringEngine.scoreBus(
        bus,
        buses,
        requirements,
        rawText,
        userProfile
      );
      return {
        bus,
        overallScore,
        factors,
      };
    });

    // Sort by overallScore descending, secondary by price ascending, tertiary by ID
    scoredList.sort((a, b) => {
      if (b.overallScore !== a.overallScore) {
        return b.overallScore - a.overallScore;
      }
      if (a.bus.price.amount !== b.bus.price.amount) {
        return a.bus.price.amount - b.bus.price.amount;
      }
      return a.bus.id.localeCompare(b.bus.id);
    });

    return scoredList.map((entry, idx) => {
      const rank = idx + 1;
      const whyThisText = RationaleGenerator.generateBusWhyThis(
        entry.bus,
        rank,
        requirements,
        objective,
        userProfile,
        entry.factors
      );
      const { pros, cons } = RationaleGenerator.generateBusProsCons(entry.bus, entry.factors);

      const timingFactor = entry.factors.find(
        (f) => f.name === 'departureTime' && f.reason.includes('Matches your preferred')
      );
      const prefOpFactor = entry.factors.find((f) => f.name === 'preferred_operator');
      let personalizationApplied = false;
      let personalizationReason: string | undefined = undefined;

      const effectiveBus = userProfile as any;
      if (effectiveBus?.activeSessionOverrides?.preferredDepartureTimeWindow) {
        personalizationApplied = true;
        personalizationReason = `Prioritized for your session departure window (${effectiveBus.activeSessionOverrides.preferredDepartureTimeWindow})`;
      } else if (timingFactor) {
        personalizationApplied = true;
        personalizationReason = timingFactor.reason;
      } else if (prefOpFactor) {
        personalizationApplied = true;
        personalizationReason = prefOpFactor.reason;
      }

      return {
        resultId: entry.bus.id,
        rank,
        overallScore: entry.overallScore,
        item: entry.bus,
        whyThisText,
        pros,
        cons,
        matchedRequirements: [`Route: ${entry.bus.source} -> ${entry.bus.destination}`],
        unmetPreferences: [],
        scoreBreakdown: entry.factors,
        personalizationApplied,
        personalizationReason,
      };
    });
  }
}
