import type { SearchRequirements } from '../types/agent';
import type { NormalizedProduct, NormalizedBusResult } from '../types/provider';
import type { ComparisonFactor, UserObjective, WorkloadProfile } from './types';
import type { UserPersonalizationProfile } from '../types/personalization';

export class RationaleGenerator {
  /**
   * Generates factual whyThisText for a product with personalization transparency
   */
  static generateProductWhyThis(
    product: NormalizedProduct,
    rank: number,
    requirements: SearchRequirements,
    objective: UserObjective,
    workload: WorkloadProfile | null,
    profile?: UserPersonalizationProfile,
    factors?: ComparisonFactor[]
  ): string {
    const userProfile = profile || requirements.profile;
    const effective = requirements.effectivePreferences;
    const maxBudget = requirements.budget?.max;
    const priceStr = `₹${product.price.amount.toLocaleString('en-IN')}`;
    const cpu = product.specifications?.['cpu'] || '';
    const gpu = product.specifications?.['gpu'] || '';
    const ram = product.specifications?.['ram'] || '';

    // 1. Session Overrides: Explicit Search Priority
    if (effective?.ignoredSavedPreferences && rank === 1) {
      return `Your saved brand preference was ignored for this search because you explicitly requested lowest price. Ranked higher as the most affordable verified option at ${priceStr}.`;
    }
    if (effective?.activeSessionOverrides && rank === 1) {
      if (effective.general.rankingPriority === 'lowest_price') {
        return `Ranked higher because you requested lowest price for this search, delivering the best value at ${priceStr}.`;
      }
      if (effective.general.rankingPriority === 'highest_quality') {
        return `Ranked higher because you requested performance for this search, offering top hardware at ${priceStr}.`;
      }
    }

    // 2. Personalization: Preferred Brand & Positive Feedback
    const prefBrandFactor = factors?.find((f) => f.name === 'preferred_brand');
    const posFeedbackFactor = factors?.find((f) => f.name === 'positive_feedback');

    if (posFeedbackFactor && rank === 1) {
      return `Ranked higher based on your previous positive feedback on ${product.brand}, delivering verified value at ${priceStr}.`;
    }

    if (prefBrandFactor) {
      const brandMatch = prefBrandFactor.reason.match(/\(([^)]+)\)/)?.[1] || product.brand;
      if (rank === 1) {
        return `Ranked higher because it matches your preferred ${brandMatch} brand preference while satisfying your specifications and budget constraints.`;
      }
      return `Matches your preferred ${brandMatch} brand preference at ${priceStr} from ${product.provider.name}.`;
    }

    // 3. Personalization: Priority Weight
    if (userProfile?.general.rankingPriority === 'lowest_price' && rank === 1) {
      return `Ranked higher because you prioritize lower prices, offering the most affordable option at ${priceStr}.`;
    }
    if (userProfile?.general.rankingPriority === 'highest_quality' && rank === 1) {
      return `Ranked higher because you prioritize highest quality, delivering top-tier performance (${[cpu, gpu].filter(Boolean).join(', ')}) at ${priceStr}.`;
    }

    if (rank === 1) {
      if (objective === 'CHEAPEST') {
        return `Top recommendation as the most affordable eligible option at ${priceStr}${maxBudget ? `, staying ₹${(maxBudget - product.price.amount).toLocaleString('en-IN')} below your budget` : ''}.`;
      }
      if (workload?.name === 'gaming') {
        return `Top recommendation for your gaming request because it delivers dedicated ${gpu || 'graphics'} performance and ${ram || 'memory'} while adhering to your ${maxBudget ? `₹${maxBudget.toLocaleString('en-IN')} ` : ''}budget.`;
      }
      if (objective === 'BEST_PERFORMANCE') {
        return `Top performance match featuring ${[cpu, gpu, ram].filter(Boolean).join(', ')} within your budget constraints.`;
      }
      return `Best balanced option offering reliable ${cpu || 'processing'} and ${ram || 'RAM'} at ${priceStr}.`;
    }

    if (rank === 2) {
      return `Strong secondary alternative offering competitive value at ${priceStr}${gpu ? ` with ${gpu}` : ''}.`;
    }

    return `Eligible option available at ${priceStr} from ${product.provider.name}.`;
  }

  /**
   * Generates evidence-based pros and cons for a product
   */
  static generateProductProsCons(
    product: NormalizedProduct,
    requirements: SearchRequirements,
    factors: ComparisonFactor[]
  ): { pros: string[]; cons: string[] } {
    const pros: string[] = [];
    const cons: string[] = [];

    const maxBudget = requirements.budget?.max;
    if (maxBudget && product.price.amount < maxBudget) {
      const savings = maxBudget - product.price.amount;
      if (savings > 0) {
        pros.push(`₹${product.price.amount.toLocaleString('en-IN')} (₹${savings.toLocaleString('en-IN')} under budget)`);
      }
    }

    const gpu = product.specifications?.['gpu'];
    if (gpu) {
      pros.push(`Dedicated graphics: ${gpu}`);
    }

    const ram = product.specifications?.['ram'];
    if (ram) {
      const match = ram.match(/([0-9]+)\s*gb/i);
      const ramGb = match ? parseInt(match[1], 10) : parseInt(ram, 10);
      if (ramGb >= 16) {
        pros.push(`Generous memory: ${ram}`);
      } else if (ramGb <= 8) {
        cons.push(`Limited memory: only ${ram}`);
      }
    }

    if (product.rating && product.rating >= 4.5) {
      pros.push(`High customer rating: ${product.rating.toFixed(1)}/5 stars`);
    } else if (product.rating && product.rating < 4.0) {
      cons.push(`Lower customer rating: ${product.rating.toFixed(1)}/5 stars`);
    }

    // Check discount
    if (product.discount && product.discount >= 15) {
      pros.push(`${product.discount}% discount from original listing`);
    }

    // Personalization factors
    const prefBrandFactor = factors.find((f) => f.name === 'preferred_brand');
    if (prefBrandFactor) {
      pros.unshift(prefBrandFactor.reason);
    }
    const posFbFactor = factors.find((f) => f.name === 'positive_feedback');
    if (posFbFactor) {
      pros.unshift(posFbFactor.reason);
    }
    const excludedBrandFactor = factors.find((f) => f.name === 'excluded_brand');
    if (excludedBrandFactor) {
      cons.unshift(excludedBrandFactor.reason);
    }
    const negFbFactor = factors.find((f) => f.name === 'negative_feedback');
    if (negFbFactor) {
      cons.unshift(negFbFactor.reason);
    }

    return { pros, cons };
  }

  /**
   * Generates factual whyThisText for a bus route with personalization transparency
   */
  static generateBusWhyThis(
    bus: NormalizedBusResult,
    rank: number,
    requirements: SearchRequirements,
    objective: UserObjective,
    profile?: UserPersonalizationProfile,
    factors?: ComparisonFactor[]
  ): string {
    const userProfile = profile || requirements.profile;
    const fareStr = `₹${bus.price.amount.toLocaleString('en-IN')}`;

    // 1. Personalization: Schedule Window
    const timingFactor = factors?.find((f) => f.name === 'departureTime');
    if (timingFactor && timingFactor.score >= 90 && userProfile?.travel.preferredDepartureTimeWindow && userProfile.travel.preferredDepartureTimeWindow !== 'any') {
      const window = userProfile.travel.preferredDepartureTimeWindow;
      if (rank === 1) {
        return `Preferred because it matches your ${window} departure preference, departing at ${bus.departureTime} with ${bus.operator} (${fareStr}).`;
      }
    }

    // 2. Personalization: Priority Weight
    if (userProfile?.general.rankingPriority === 'lowest_price' && rank === 1) {
      return `Ranked higher because you prioritize lower prices, offering the lowest ticket fare at ${fareStr}.`;
    }
    if (userProfile?.general.rankingPriority === 'fastest' && rank === 1) {
      return `Ranked higher because you prioritize fastest travel time (${bus.duration || 'fastest scheduled journey'}).`;
    }

    if (rank === 1) {
      if (objective === 'CHEAPEST') {
        return `Lowest ticket fare at ${fareStr} for ${bus.busType} with ${bus.operator}.`;
      }
      if (objective === 'FASTEST') {
        return `Fastest scheduled journey at ${bus.duration || 'optimal duration'} departing at ${bus.departureTime}.`;
      }
      return `Recommended ${bus.busType} departure at ${bus.departureTime} by ${bus.operator} (${fareStr}).`;
    }

    return `Alternative option departing at ${bus.departureTime} with ${bus.operator} (${fareStr}).`;
  }

  /**
   * Generates evidence-based pros and cons for a bus route
   */
  static generateBusProsCons(
    bus: NormalizedBusResult,
    factors?: ComparisonFactor[]
  ): { pros: string[]; cons: string[] } {
    const pros: string[] = [];
    const cons: string[] = [];

    // Personalization factors
    const timingFactor = factors?.find((f) => f.name === 'departureTime');
    if (timingFactor && timingFactor.reason.includes('Matches your preferred')) {
      pros.push(timingFactor.reason);
    }
    const prefOp = factors?.find((f) => f.name === 'preferred_operator');
    if (prefOp) {
      pros.push(prefOp.reason);
    }
    const exclOp = factors?.find((f) => f.name === 'excluded_operator');
    if (exclOp) {
      cons.unshift(exclOp.reason);
    }

    pros.push(`${bus.busType} service by ${bus.operator}`);

    if (bus.rating && bus.rating >= 4.5) {
      pros.push(`Rated ${bus.rating.toFixed(1)}/5 stars by passengers`);
    }

    if (bus.cancellationPolicy?.toLowerCase().includes('free')) {
      pros.push('Free cancellation option available');
    }

    if (bus.seatsAvailable && bus.seatsAvailable < 5) {
      cons.push(`Fast filling: only ${bus.seatsAvailable} seat(s) remaining`);
    }

    return { pros, cons };
  }
}
