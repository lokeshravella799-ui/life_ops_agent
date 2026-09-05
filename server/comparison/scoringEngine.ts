import type { SearchRequirements } from '../types/agent';
import type { NormalizedProduct, NormalizedBusResult } from '../types/provider';
import type { ComparisonFactor, UserObjective, WorkloadProfile } from './types';
import type { UserPersonalizationProfile } from '../types/personalization';
import { adaptiveLearningEngine } from '../personalization/adaptiveLearningEngine';
import { detectObjective, detectWorkload, getDynamicWeights } from './workloadProfiles';

export class ScoringEngine {
  /**
   * Evaluates and scores a single normalized product
   */
  static scoreProduct(
    product: NormalizedProduct,
    allProducts: NormalizedProduct[],
    requirements: SearchRequirements,
    rawText: string = '',
    profile?: UserPersonalizationProfile
  ): { overallScore: number; factors: ComparisonFactor[] } {
    const objective = detectObjective(requirements, rawText);
    const workload = detectWorkload(requirements, rawText);
    const weights = getDynamicWeights(objective, 'product', workload);

    const userProfile = profile || requirements.profile;

    // Apply ranking priorities from profile
    if (userProfile?.general.rankingPriority === 'lowest_price') {
      weights['price'] = (weights['price'] || 0.25) * 1.8;
      weights['gpu'] = (weights['gpu'] || 0.25) * 0.7;
      weights['cpu'] = (weights['cpu'] || 0.20) * 0.7;
    } else if (userProfile?.general.rankingPriority === 'highest_quality') {
      weights['price'] = (weights['price'] || 0.25) * 0.5;
      weights['gpu'] = (weights['gpu'] || 0.25) * 1.4;
      weights['cpu'] = (weights['cpu'] || 0.20) * 1.4;
      weights['rating'] = (weights['rating'] || 0.15) * 1.4;
    }

    const factors: ComparisonFactor[] = [];

    // Currency check: Ensure currency matches request or default
    const expectedCurrency = requirements.currency || 'INR';
    if (product.price.currency !== expectedCurrency) {
      return {
        overallScore: 0,
        factors: [
          {
            name: 'currency_mismatch',
            label: 'Currency',
            score: 0,
            weight: 1.0,
            reason: `Product currency (${product.price.currency}) does not match requested currency (${expectedCurrency}).`,
            isAvailable: false,
          },
        ],
      };
    }

    // 1. Price Factor
    const maxBudget = requirements.budget?.max;
    let priceScore = 50;
    let priceReason = `Price ₹${product.price.amount.toLocaleString('en-IN')}`;

    if (maxBudget && maxBudget > 0) {
      if (product.price.amount <= maxBudget) {
        // Higher score the further under budget (reward headroom up to 30%)
        const headroomPct = (maxBudget - product.price.amount) / maxBudget;
        priceScore = Math.min(100, Math.round(70 + headroomPct * 100));
        priceReason = `₹${product.price.amount.toLocaleString('en-IN')} is within your ₹${maxBudget.toLocaleString('en-IN')} budget`;
      } else {
        priceScore = 0;
        priceReason = `Exceeds budget of ₹${maxBudget.toLocaleString('en-IN')}`;
      }
    } else {
      // Relative price ranking among available options
      const minPrice = Math.min(...allProducts.map((p) => p.price.amount));
      const maxPrice = Math.max(...allProducts.map((p) => p.price.amount));
      if (maxPrice > minPrice) {
        priceScore = Math.round(100 - ((product.price.amount - minPrice) / (maxPrice - minPrice)) * 50);
      } else {
        priceScore = 85;
      }
      priceReason = `Competitive marketplace pricing at ₹${product.price.amount.toLocaleString('en-IN')}`;
    }

    factors.push({
      name: 'price',
      label: 'Price & Value',
      score: priceScore,
      weight: weights['price'] || 0.25,
      reason: priceReason,
      isAvailable: true,
    });

    // 2. Performance / CPU & GPU Factors
    const gpuSpec = product.specifications?.['gpu'] || this.extractGpu(product.title);
    if (gpuSpec) {
      const gpuScore = this.scoreGpu(gpuSpec);
      factors.push({
        name: 'gpu',
        label: 'Graphics Processing',
        score: gpuScore.score,
        weight: weights['gpu'] || 0.25,
        reason: `${gpuSpec} (${gpuScore.tier})`,
        isAvailable: true,
      });
    } else {
      // Missing specification: Mark as unavailable, neutral score
      factors.push({
        name: 'gpu',
        label: 'Graphics Processing',
        score: 50,
        weight: 0.05, // reduced weight so missing data doesn't skew
        reason: 'Dedicated GPU specification not specified by provider',
        isAvailable: false,
      });
    }

    const cpuSpec = product.specifications?.['cpu'] || this.extractCpu(product.title);
    if (cpuSpec) {
      const cpuScore = this.scoreCpu(cpuSpec);
      factors.push({
        name: 'cpu',
        label: 'Processor Performance',
        score: cpuScore.score,
        weight: weights['cpu'] || 0.20,
        reason: `${cpuSpec} (${cpuScore.tier})`,
        isAvailable: true,
      });
    } else {
      factors.push({
        name: 'cpu',
        label: 'Processor Performance',
        score: 50,
        weight: 0.05,
        reason: 'Processor specification not specified',
        isAvailable: false,
      });
    }

    // 3. RAM Factor
    const ramSpec = product.specifications?.['ram'] || this.extractRam(product.title);
    if (ramSpec) {
      const match = ramSpec.match(/([0-9]+)\s*gb/i);
      const ramGb = match ? parseInt(match[1], 10) : parseInt(ramSpec, 10) || 8;
      const ramScore = ramGb >= 32 ? 100 : ramGb >= 16 ? 90 : ramGb >= 8 ? 70 : 40;
      factors.push({
        name: 'ram',
        label: 'Memory (RAM)',
        score: ramScore,
        weight: weights['ram'] || 0.15,
        reason: `${ramGb}GB RAM installed`,
        isAvailable: true,
      });
    } else {
      factors.push({
        name: 'ram',
        label: 'Memory (RAM)',
        score: 50,
        weight: 0.05,
        reason: 'RAM capacity not detailed',
        isAvailable: false,
      });
    }

    // 4. Rating & Reputation Factor
    if (typeof product.rating === 'number' && product.rating > 0) {
      const ratingScore = Math.min(100, Math.round((product.rating / 5) * 100));
      factors.push({
        name: 'rating',
        label: 'Customer Rating',
        score: ratingScore,
        weight: weights['rating'] || 0.15,
        reason: `Rated ${product.rating.toFixed(1)}/5 stars (${product.reviewCount || 0} reviews)`,
        isAvailable: true,
      });
    } else {
      factors.push({
        name: 'rating',
        label: 'Customer Rating',
        score: 60,
        weight: 0.05,
        reason: 'Rating data currently unrated',
        isAvailable: false,
      });
    }

    // 5. Personalization Factors (Brand Preferences & Exclusions)
    if (userProfile?.shopping.preferredBrands && userProfile.shopping.preferredBrands.length > 0) {
      const prodBrand = (product.brand || '').toLowerCase();
      const prodTitle = product.title.toLowerCase();
      const matchedPrefBrand = userProfile.shopping.preferredBrands.find(
        (b) => prodBrand.includes(b.toLowerCase()) || prodTitle.includes(b.toLowerCase())
      );
      if (matchedPrefBrand) {
        factors.push({
          name: 'preferred_brand',
          label: 'Preferred Brand',
          score: 100,
          weight: 0.22,
          reason: `Matches your preferred brand (${matchedPrefBrand})`,
          isAvailable: true,
        });
      }
    }

    if (userProfile?.shopping.excludedBrands && userProfile.shopping.excludedBrands.length > 0) {
      const prodBrand = (product.brand || '').toLowerCase();
      const prodTitle = product.title.toLowerCase();
      const matchedExcludedBrand = userProfile.shopping.excludedBrands.find(
        (b) => prodBrand.includes(b.toLowerCase()) || prodTitle.includes(b.toLowerCase())
      );
      if (matchedExcludedBrand) {
        factors.push({
          name: 'excluded_brand',
          label: 'Brand Exclusion',
          score: 5,
          weight: 0.40,
          reason: `Brand (${matchedExcludedBrand}) is on your exclusion list`,
          isAvailable: true,
        });
      }
    }

    // 5b. Feedback-driven Score Adjustments
    const brandKey = (product.brand || '').toLowerCase();
    const feedbackBoosts =
      (userProfile as any)?.feedbackBoosts ||
      ((userProfile as any)?.feedbackHistory
        ? adaptiveLearningEngine.computeFeedbackBoosts(userProfile as any)
        : {});

    if (brandKey && feedbackBoosts[brandKey]) {
      const delta = feedbackBoosts[brandKey];
      if (delta > 0) {
        factors.push({
          name: 'positive_feedback',
          label: 'Positive Feedback History',
          score: 95,
          weight: 0.18,
          reason: `Upvoted in past interactions (${product.brand})`,
          isAvailable: true,
        });
      } else if (delta < 0) {
        factors.push({
          name: 'negative_feedback',
          label: 'Negative Feedback History',
          score: 15,
          weight: 0.28,
          reason: `Downvoted in past interactions (${product.brand})`,
          isAvailable: true,
        });
      }
    }

    // Compute normalized overall score: weighted sum
    const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
    const weightedScoreSum = factors.reduce((sum, f) => sum + f.score * f.weight, 0);
    const overallScore = totalWeight > 0 ? Math.round((weightedScoreSum / totalWeight) * 10) / 10 : 50;

    return {
      overallScore,
      factors,
    };
  }

  /**
   * Evaluates and scores a single normalized bus route
   */
  static scoreBus(
    bus: NormalizedBusResult,
    allBuses: NormalizedBusResult[],
    requirements: SearchRequirements,
    rawText: string = '',
    profile?: UserPersonalizationProfile
  ): { overallScore: number; factors: ComparisonFactor[] } {
    const objective = detectObjective(requirements, rawText);
    const weights = getDynamicWeights(objective, 'bus');
    const userProfile = profile || requirements.profile;

    // Apply ranking priorities
    if (userProfile?.general.rankingPriority === 'lowest_price') {
      weights['price'] = (weights['price'] || 0.35) * 1.8;
      weights['duration'] = (weights['duration'] || 0.25) * 0.7;
    } else if (userProfile?.general.rankingPriority === 'fastest') {
      weights['duration'] = (weights['duration'] || 0.25) * 1.8;
      weights['price'] = (weights['price'] || 0.35) * 0.7;
    }

    const factors: ComparisonFactor[] = [];

    // Currency verification
    if (bus.price.currency !== 'INR') {
      return {
        overallScore: 0,
        factors: [
          {
            name: 'currency_mismatch',
            label: 'Currency',
            score: 0,
            weight: 1.0,
            reason: `Bus fare currency (${bus.price.currency}) mismatch`,
            isAvailable: false,
          },
        ],
      };
    }

    // 1. Price Factor
    const allPrices = allBuses.map((b) => b.price.amount);
    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);
    let priceScore = 75;
    if (maxPrice > minPrice) {
      priceScore = Math.round(100 - ((bus.price.amount - minPrice) / (maxPrice - minPrice)) * 40);
    }
    factors.push({
      name: 'price',
      label: 'Ticket Fare',
      score: priceScore,
      weight: weights['price'] || 0.35,
      reason: `Ticket price ₹${bus.price.amount.toLocaleString('en-IN')}`,
      isAvailable: true,
    });

    // 2. Duration Factor
    const durationMinutes = this.parseDurationMinutes(bus.duration);
    let durationScore = 75;
    if (durationMinutes) {
      durationScore = durationMinutes <= 600 ? 95 : durationMinutes <= 720 ? 80 : 65;
    }
    factors.push({
      name: 'duration',
      label: 'Travel Duration',
      score: durationScore,
      weight: weights['duration'] || 0.25,
      reason: bus.duration ? `Journey duration of ${bus.duration}` : 'Duration not specified',
      isAvailable: Boolean(bus.duration),
    });

    // 3. Departure Window Factor (with personalization)
    const departureWindow = userProfile?.travel.preferredDepartureTimeWindow;
    let timingScore = 85;
    let timingReason = `Departs at ${bus.departureTime}`;
    let timingWeight = weights['departureTime'] || 0.20;

    if (departureWindow && departureWindow !== 'any' && bus.departureTime) {
      const hourMatch = bus.departureTime.match(/(\d{1,2}):(\d{2})/);
      if (hourMatch) {
        const hour = parseInt(hourMatch[1], 10);
        const isMorning = hour >= 6 && hour < 12;
        const isAfternoon = hour >= 12 && hour < 17;
        const isEvening = hour >= 17 && hour < 21;
        const isNight = hour >= 21 || hour < 6;

        const isMatch =
          (departureWindow === 'morning' && isMorning) ||
          (departureWindow === 'afternoon' && isAfternoon) ||
          (departureWindow === 'evening' && isEvening) ||
          (departureWindow === 'night' && isNight);

        if (isMatch) {
          timingScore = 100;
          timingWeight = 0.30;
          timingReason = `Departs at ${bus.departureTime} (Matches your preferred ${departureWindow} schedule)`;
        } else {
          timingScore = 40;
          timingWeight = 0.25;
          timingReason = `Departs at ${bus.departureTime} (Outside your preferred ${departureWindow} window)`;
        }
      }
    }

    factors.push({
      name: 'departureTime',
      label: 'Departure Timing',
      score: timingScore,
      weight: timingWeight,
      reason: timingReason,
      isAvailable: true,
    });

    // 4. Rating Factor
    if (bus.rating) {
      factors.push({
        name: 'rating',
        label: 'Operator Rating',
        score: Math.min(100, Math.round((bus.rating / 5) * 100)),
        weight: weights['rating'] || 0.20,
        reason: `${bus.operator} rated ${bus.rating}/5`,
        isAvailable: true,
      });
    }

    // 5. Operator Preferences
    if (userProfile?.travel.preferredOperators && userProfile.travel.preferredOperators.length > 0) {
      const op = (bus.operator || '').toLowerCase();
      const matchedOp = userProfile.travel.preferredOperators.find((o) => op.includes(o.toLowerCase()));
      if (matchedOp) {
        factors.push({
          name: 'preferred_operator',
          label: 'Preferred Operator',
          score: 100,
          weight: 0.20,
          reason: `Operator (${bus.operator}) matches your preference`,
          isAvailable: true,
        });
      }
    }

    if (userProfile?.travel.excludedOperators && userProfile.travel.excludedOperators.length > 0) {
      const op = (bus.operator || '').toLowerCase();
      const matchedExcluded = userProfile.travel.excludedOperators.find((o) => op.includes(o.toLowerCase()));
      if (matchedExcluded) {
        factors.push({
          name: 'excluded_operator',
          label: 'Operator Exclusion',
          score: 10,
          weight: 0.35,
          reason: `Operator (${bus.operator}) is on your exclusion list`,
          isAvailable: true,
        });
      }
    }

    const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
    const weightedScoreSum = factors.reduce((sum, f) => sum + f.score * f.weight, 0);
    const overallScore = totalWeight > 0 ? Math.round((weightedScoreSum / totalWeight) * 10) / 10 : 70;

    return {
      overallScore,
      factors,
    };
  }

  // --- Domain spec helpers ---
  private static extractGpu(title: string): string | null {
    const match = title.match(/rtx\s*[0-9]{4}(?:\s*ti)?|gtx\s*[0-9]{4}|radeon\s*rx\s*[0-9]{4}/i);
    return match ? match[0].toUpperCase() : null;
  }

  private static extractCpu(title: string): string | null {
    const match = title.match(/ryzen\s*[0-9]\s*[0-9]{4}[a-z]*|core\s*i[0-9]-[0-9]{4,5}[a-z]*/i);
    return match ? match[0] : null;
  }

  private static extractRam(title: string): string | null {
    const match = title.match(/([0-9]+)\s*gb(?:\s*ddr[0-9])?/i);
    return match ? match[0] : null;
  }

  private static scoreGpu(gpu: string): { score: number; tier: string } {
    const g = gpu.toLowerCase();
    if (g.includes('4080') || g.includes('4090')) return { score: 100, tier: 'Enthusiast Flagship' };
    if (g.includes('4070')) return { score: 90, tier: 'High-End Gaming' };
    if (g.includes('4060')) return { score: 85, tier: 'Mainstream Gaming' };
    if (g.includes('4050') || g.includes('3060')) return { score: 75, tier: 'Entry Gaming' };
    if (g.includes('3050') || g.includes('2050')) return { score: 60, tier: 'Budget Gaming' };
    return { score: 50, tier: 'Standard Discrete' };
  }

  private static scoreCpu(cpu: string): { score: number; tier: string } {
    const c = cpu.toLowerCase();
    if (c.includes('i9') || c.includes('ryzen 9')) return { score: 95, tier: 'Top-tier Multithreaded' };
    if (c.includes('i7') || c.includes('ryzen 7')) return { score: 88, tier: 'High Performance' };
    if (c.includes('i5') || c.includes('ryzen 5')) return { score: 78, tier: 'Balanced Workload' };
    return { score: 65, tier: 'Standard Multi-core' };
  }

  private static parseDurationMinutes(duration?: string): number | null {
    if (!duration) return null;
    let mins = 0;
    const hMatch = duration.match(/([0-9]+)\s*h/i);
    const mMatch = duration.match(/([0-9]+)\s*m/i);
    if (hMatch) mins += parseInt(hMatch[1], 10) * 60;
    if (mMatch) mins += parseInt(mMatch[1], 10);
    return mins > 0 ? mins : null;
  }
}
