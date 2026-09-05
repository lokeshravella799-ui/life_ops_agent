import type {
  RecommendationFeedbackEvent,
  StagedInference,
  UserPersonalizationProfile,
} from '../types/personalization';
import { logger } from '../utils/logger';
import { profileStore } from './profileStore';

export class AdaptiveLearningEngine {
  // In-memory behavioral counters per user: userId -> { brandSelections: Map<brand, count>, brandRejections: Map<brand, count> }
  private userCounters: Map<
    string,
    {
      brandSelections: Map<string, number>;
      brandRejections: Map<string, number>;
      departureSelections: Map<string, number>;
    }
  > = new Map();

  private getUserCounters(userId: string) {
    let counters = this.userCounters.get(userId);
    if (!counters) {
      counters = {
        brandSelections: new Map(),
        brandRejections: new Map(),
        departureSelections: new Map(),
      };
      this.userCounters.set(userId, counters);
    }
    return counters;
  }

  /**
   * Records a user item selection or confirmation and checks for reveal-preference patterns
   */
  recordItemSelection(
    arg1: any,
    arg2: any,
    item: { brand?: string; title?: string; operator?: string; departureTime?: string; price?: any }
  ): StagedInference | null {
    if (!item) return null;

    const profile: UserPersonalizationProfile | null =
      typeof arg1 === 'object' && arg1 !== null
        ? arg1
        : typeof arg2 === 'object' && arg2 !== null
        ? arg2
        : null;

    const userId: string =
      typeof arg1 === 'string'
        ? arg1
        : typeof arg2 === 'string'
        ? arg2
        : profile?.userId || 'default_user';

    const counters = this.getUserCounters(userId);

    // Track item in profile selection history
    const itemRecord = {
      brand: item.brand,
      title: item.title,
      operator: item.operator,
      departureTime: item.departureTime,
      price: item.price,
      selectedAt: new Date().toISOString(),
    };

    if (profile) {
      profile.selectionHistory = profile.selectionHistory || [];
      profile.selectionHistory.push(itemRecord);
      profileStore.updateProfile(userId, { selectionHistory: profile.selectionHistory });
    }

    // 1. Track Brand Selections
    const brand = item.brand?.trim();
    if (brand) {
      const currentCount = (counters.brandSelections.get(brand.toLowerCase()) || 0) + 1;
      counters.brandSelections.set(brand.toLowerCase(), currentCount);

      // Check if this brand is already explicitly saved in preferred brands
      const preferredBrands = profile?.shopping?.preferredBrands || [];
      const excludedBrands = profile?.shopping?.excludedBrands || [];

      const alreadyPreferred = preferredBrands.some(
        (b) => b.toLowerCase() === brand.toLowerCase()
      );
      const alreadyExcluded = excludedBrands.some(
        (b) => b.toLowerCase() === brand.toLowerCase()
      );

      // Confidence reaches threshold after 3 selections
      const confidence = Math.min(1.0, currentCount / 3.0);

      if (currentCount >= 3 && !alreadyPreferred && !alreadyExcluded) {
        // Check if inference already staged or accepted
        const existingInference = (profile?.stagedInferences || []).find(
          (inf) =>
            (inf.field === 'preferredBrand' || inf.field === 'shopping.preferredBrands') &&
            inf.inferredValue?.toLowerCase() === brand.toLowerCase()
        );

        if (!existingInference || existingInference.status === 'DISMISSED') {
          const staged: StagedInference = {
            id: `inf_brand_${brand.toLowerCase()}_${Date.now()}`,
            field: 'shopping.preferredBrands',
            inferredValue: brand,
            confidenceScore: confidence,
            confidence: confidence,
            observationCount: currentCount,
            proposalText: `LifeOps noticed you frequently select ${brand} products across multiple searches. Would you like to add ${brand} to your preferred brands?`,
            reason: `User frequently selected ${brand} products across ${currentCount} searches`,
            status: 'STAGED',
            detectedAt: new Date().toISOString(),
          };

          logger.info('Generated staged preference inference from user behavior', {
            userId,
            field: staged.field,
            value: staged.inferredValue,
            confidence,
          });

          return staged;
        }
      }
    }

    return null;
  }

  /**
   * Ingests explicit recommendation feedback (thumbs up / thumbs down with tags)
   */
  processFeedback(
    userId: string,
    profile: UserPersonalizationProfile,
    feedback: RecommendationFeedbackEvent
  ): {
    updatedProfile: UserPersonalizationProfile;
    impactDescription: string;
    stagedInference?: StagedInference;
  } {
    profile.feedbackHistory = profile.feedbackHistory || [];
    profile.feedbackHistory.push(feedback);

    const brand = feedback.targetBrand?.trim();
    let impactDescription = '';
    let stagedInference: StagedInference | undefined = undefined;

    if (feedback.rating === 'positive') {
      impactDescription = `Recorded positive feedback for ${feedback.targetTitle || brand || 'recommendation'}.`;
      if (brand) {
        const counters = this.getUserCounters(userId);
        const count = (counters.brandSelections.get(brand.toLowerCase()) || 0) + 1;
        counters.brandSelections.set(brand.toLowerCase(), count);
        impactDescription += ` Prioritizing ${brand} in future recommendations.`;
      }
    } else {
      // Negative feedback
      impactDescription = `Recorded feedback for ${feedback.targetTitle || brand || 'recommendation'}.`;
      if (feedback.reason === 'DISLIKED_BRAND' && brand) {
        impactDescription += ` Applying penalty to ${brand} recommendations.`;
        const counters = this.getUserCounters(userId);
        const count = (counters.brandRejections.get(brand.toLowerCase()) || 0) + 1;
        counters.brandRejections.set(brand.toLowerCase(), count);
      } else if (feedback.reason === 'PRICE_TOO_HIGH') {
        impactDescription += ` Emphasizing budget and competitive pricing.`;
      }
    }

    profile.updatedAt = new Date().toISOString();
    return { updatedProfile: profile, impactDescription, stagedInference };
  }

  /**
   * Computes dynamic score boosts/penalties based on accumulated user feedback
   */
  computeFeedbackBoosts(profile: UserPersonalizationProfile): Record<string, number> {
    const boosts: Record<string, number> = {};
    if (!profile.feedbackHistory || profile.feedbackHistory.length === 0) {
      return boosts;
    }

    for (const fb of profile.feedbackHistory) {
      const brandKey = fb.targetBrand?.toLowerCase();
      if (!brandKey) continue;

      const current = boosts[brandKey] || 0;
      if (fb.rating === 'positive') {
        // Boost up to +15 pts
        boosts[brandKey] = Math.min(15, current + 10);
      } else if (fb.rating === 'negative') {
        if (fb.reason === 'DISLIKED_BRAND') {
          // Strong brand penalty -20 pts
          boosts[brandKey] = Math.max(-25, current - 20);
        } else {
          // General negative penalty -10 pts
          boosts[brandKey] = Math.max(-15, current - 10);
        }
      }
    }

    return boosts;
  }
}

export const adaptiveLearningEngine = new AdaptiveLearningEngine();
