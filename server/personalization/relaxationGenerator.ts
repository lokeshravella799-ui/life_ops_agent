import type { EffectivePreferences, ProactiveRelaxationOption } from '../types/personalization';
import type { SearchRequirements } from '../types/agent';

export interface RelaxationAnalysisResult {
  reason: string;
  options: ProactiveRelaxationOption[];
  formattedMessage: string;
}

export class ProactiveRelaxationGenerator {
  /**
   * Generates grounded relaxation suggestions when zero verified and available results match strict constraints
   */
  generateRelaxations(
    requirements: SearchRequirements,
    effectivePrefs: EffectivePreferences,
    unfilteredCandidateCount: number = 0,
    closeMatches: any[] = []
  ): RelaxationAnalysisResult {
    const options: ProactiveRelaxationOption[] = [];
    const bulletPoints: string[] = [];

    const preferredBrands = effectivePrefs.shopping.preferredBrands || [];
    const excludedBrands = effectivePrefs.shopping.excludedBrands || [];
    const maxBudget = requirements.budget?.max || effectivePrefs.shopping.maxPrice;
    const isBus = requirements.category === 'bus' || Boolean((requirements as any).source && (requirements as any).destination);
    const category = requirements.category ? `${requirements.category} options` : 'options';

    let primaryReason = `No verified ${preferredBrands.length > 0 ? preferredBrands.join('/') + ' ' : ''}${category} were found`;
    if (isBus && (requirements as any).source && (requirements as any).destination) {
      primaryReason += ` from ${(requirements as any).source} to ${(requirements as any).destination}`;
    } else if ((requirements as any).destination) {
      primaryReason += ` in ${(requirements as any).destination}`;
    }
    if (maxBudget) {
      primaryReason += ` under ₹${maxBudget.toLocaleString('en-IN')}`;
    }
    primaryReason += ' satisfying all current constraints.';

    // 1. Suggest increasing budget if there are close matches just above the ceiling
    if (maxBudget) {
      const brandFilteredMatches = preferredBrands.length > 0
        ? closeMatches.filter((m: any) => preferredBrands.some((b) => b.toLowerCase() === (m.brand || '').toLowerCase()))
        : closeMatches;

      const candidates = brandFilteredMatches.length > 0 ? brandFilteredMatches : closeMatches;
      const candidatePrices = candidates
        .map((m: any) => (typeof m.price === 'object' ? m.price?.amount : m.price))
        .filter((amt: any) => typeof amt === 'number' && amt > maxBudget);

      const suggestedBudget = candidatePrices.length > 0
        ? Math.min(...candidatePrices)
        : Math.round((maxBudget * 1.3) / 5000) * 5000;

      options.push({
        id: 'relax_budget',
        label: `Increase budget to ₹${suggestedBudget.toLocaleString('en-IN')}`,
        type: 'INCREASE_BUDGET',
        description: `Expand the price ceiling to ₹${suggestedBudget.toLocaleString('en-IN')} to unlock verified options`,
        adjustment: {
          field: 'budget.max',
          oldValue: maxBudget,
          newValue: suggestedBudget,
        },
      });
      bulletPoints.push(`Increase budget to ₹${suggestedBudget.toLocaleString('en-IN')}`);
    }

    // 2. Suggest allowing other brands if constrained by preferred brands
    if (preferredBrands.length > 0) {
      options.push({
        id: 'relax_allow_brands',
        label: 'Allow other verified brands',
        type: 'ALLOW_OTHER_BRANDS',
        description: `Consider verified alternatives from other reputable manufacturers`,
        adjustment: {
          field: 'shopping.preferredBrands',
          oldValue: preferredBrands,
          newValue: [],
        },
      });
      bulletPoints.push('Allow other verified brands (e.g. Acer, Lenovo, HP)');
    }

    // 3. Suggest removing brand exclusion if active
    if (excludedBrands.length > 0) {
      options.push({
        id: 'relax_remove_exclusion',
        label: `Remove brand exclusion (${excludedBrands.join(', ')})`,
        type: 'REMOVE_BRAND_EXCLUSION',
        description: `Include previously excluded brands for this search`,
        adjustment: {
          field: 'shopping.excludedBrands',
          oldValue: excludedBrands,
          newValue: [],
        },
      });
      bulletPoints.push(`Remove brand exclusion for ${excludedBrands.join(', ')}`);
    }

    // 4. Suggest relaxing travel departure window if applicable
    const depWindow = effectivePrefs.travel.preferredDepartureTimeWindow;
    if (depWindow && depWindow !== 'any') {
      options.push({
        id: 'relax_departure_window',
        label: 'Expand departure time to any time of day',
        type: 'EXPAND_TIME_WINDOW',
        description: `Include departures across all hours instead of strictly ${depWindow}`,
        adjustment: {
          field: 'travel.preferredDepartureTimeWindow',
          oldValue: depWindow,
          newValue: 'any',
        },
      });
      bulletPoints.push('Expand departure time to any time of day');
    }

    // If no specific constraints were detected, offer standard relaxation
    if (options.length === 0) {
      options.push({
        id: 'relax_general',
        label: 'Broaden search criteria',
        type: 'RELAX_SPEC',
        description: 'Remove secondary filters and search across broader inventory',
        adjustment: {
          field: 'general',
          newValue: 'broaden',
        },
      });
      bulletPoints.push('Broaden search criteria across all available inventory');
    }

    const formattedMessage = `${primaryReason}\n\nYou can:\n${bulletPoints.map((b) => `• ${b}`).join('\n')}`;

    return {
      reason: primaryReason,
      options,
      formattedMessage,
    };
  }
}

export const proactiveRelaxationGenerator = new ProactiveRelaxationGenerator();
