import type {
  UserPersonalizationProfile,
  SessionPreferences,
  PreferenceConflict,
  ConflictOption,
} from '../types/personalization';
import type { SearchRequirements } from '../types/agent';
import { logger } from '../utils/logger';

export class PreferenceConflictDetector {
  /**
   * Detects material conflicts between saved user preferences and current search requirements
   */
  detectConflicts(
    requirements: SearchRequirements,
    profile: UserPersonalizationProfile,
    sessionPrefs?: SessionPreferences,
    turnCount: number = 1
  ): PreferenceConflict[] {
    const conflicts: PreferenceConflict[] = [];

    // If saved preferences are explicitly ignored for this session, no active conflict blocks execution
    if (sessionPrefs?.ignoreSavedPreferences) {
      return conflicts;
    }

    const savedPreferredBrands = profile.shopping.preferredBrands || [];
    const savedPriority = profile.general.rankingPriority;
    const savedDeparture = profile.travel.preferredDepartureTimeWindow;
    const savedMaxPrice = profile.shopping.maxPrice;

    // 1. BRAND CONFLICT: Direct Brand Contradiction (e.g. Saved ASUS, but current query says "No ASUS" or excludes ASUS)
    const rawQuery = (requirements.keywords?.join(' ') || '').toLowerCase();
    const isNegativeBrand = rawQuery.match(/(?:no|don'?t\s+show|exclude|without|avoid)\s+([a-zA-Z0-9]+)/i);
    if (isNegativeBrand) {
      const excludedBrand = isNegativeBrand[1].toLowerCase();
      const matchedSaved = savedPreferredBrands.find((b) => b.toLowerCase() === excludedBrand);
      if (matchedSaved) {
        conflicts.push({
          id: `conflict_brand_contradiction_${Date.now()}`,
          field: 'brand',
          existingValue: matchedSaved,
          newValue: `Exclude ${matchedSaved}`,
          sourceTurn: turnCount,
          severity: 'high',
          resolutionRequired: true,
          description: `Direct contradiction: You have ${matchedSaved} saved as a preferred brand, but requested to exclude ${matchedSaved} in this search.`,
          suggestedClarification: `Your saved preference prioritizes ${matchedSaved}, but your current request asks to exclude ${matchedSaved}. Should I exclude ${matchedSaved} for this search, or keep your saved preference?`,
          options: [
            {
              id: 'opt_exclude_for_search',
              label: `Exclude ${matchedSaved} for this search`,
              description: `Temporarily bypass ${matchedSaved} without changing your global profile`,
              resolutionAction: 'USE_CURRENT_REQUIREMENT',
              scope: 'session',
              value: { excludedBrand: matchedSaved },
            },
            {
              id: 'opt_keep_saved_brand',
              label: `Keep ${matchedSaved} as priority`,
              description: `Retain your saved ${matchedSaved} preference for this search`,
              resolutionAction: 'KEEP_SAVED_PREFERENCE',
              scope: 'session',
              value: { preferredBrand: matchedSaved },
            },
          ],
        });
      }
    }

    // 2. LUXURY / NON-GAMING BRAND VS CHEAPEST GAMING REQUIREMENT
    // e.g. "I prefer Apple" + "Find me the cheapest gaming laptop"
    const isCheapestGaming =
      (rawQuery.includes('gaming') || requirements.category?.includes('gaming')) &&
      (requirements.sortPreference === 'cheapest' || rawQuery.includes('cheap') || (requirements.budget?.max && requirements.budget.max <= 80000));

    const hasAppleSaved = savedPreferredBrands.some((b) => b.toLowerCase() === 'apple');
    if (hasAppleSaved && isCheapestGaming) {
      conflicts.push({
        id: `conflict_apple_cheapest_gaming_${Date.now()}`,
        field: 'brand',
        existingValue: 'Apple',
        newValue: 'Cheapest Gaming Laptop',
        sourceTurn: turnCount,
        severity: 'high',
        resolutionRequired: true,
        description: 'Apple laptops do not cater to budget gaming categories under ₹80,000 and conflict with lowest-price gaming hardware.',
        suggestedClarification:
          'Your current request prioritizes the lowest price for a gaming laptop, while your saved preference prioritizes Apple. Should I prioritize price and gaming performance for this search, or keep Apple as the priority?',
        options: [
          {
            id: 'opt_prioritize_price',
            label: 'Prioritize price for this search',
            description: 'Show top budget gaming laptops from brands like ASUS, Acer, and Lenovo',
            resolutionAction: 'USE_CURRENT_REQUIREMENT',
            scope: 'session',
            value: { rankingPriority: 'lowest_price', bypassBrand: 'Apple' },
          },
          {
            id: 'opt_keep_apple',
            label: 'Keep Apple as the priority',
            description: 'Focus exclusively on Apple MacBooks within or nearest to your budget',
            resolutionAction: 'KEEP_SAVED_PREFERENCE',
            scope: 'session',
            value: { preferredBrand: 'Apple' },
          },
        ],
      });
    }

    // 3. BUDGET CONFLICT: Explicit query budget diverges materially from profile budget
    // e.g. Saved limit ₹50,000 vs current turn "I am willing to spend ₹80,000"
    if (savedMaxPrice && requirements.budget?.max) {
      const budgetDiff = Math.abs(requirements.budget.max - savedMaxPrice);
      if (budgetDiff >= 20000) {
        // Current-turn hard constraint takes precedence, but we record non-blocking conflict notice
        conflicts.push({
          id: `conflict_budget_${Date.now()}`,
          field: 'price',
          existingValue: savedMaxPrice,
          newValue: requirements.budget.max,
          sourceTurn: turnCount,
          severity: 'medium',
          resolutionRequired: false, // Auto-resolved in favor of current-turn hard constraint
          description: `Current search budget cap of ₹${requirements.budget.max.toLocaleString('en-IN')} diverges from saved budget limit of ₹${savedMaxPrice.toLocaleString('en-IN')}.`,
          suggestedClarification: `Using current search budget of ₹${requirements.budget.max.toLocaleString('en-IN')} (overriding saved ₹${savedMaxPrice.toLocaleString('en-IN')}).`,
          options: [
            {
              id: 'opt_use_current_budget',
              label: `Use ₹${requirements.budget.max.toLocaleString('en-IN')}`,
              description: 'Apply current search budget',
              resolutionAction: 'USE_CURRENT_REQUIREMENT',
              scope: 'session',
              value: requirements.budget.max,
            },
          ],
        });
      }
    }

    // 4. DEPARTURE TIME WINDOW CONFLICT: Travel query specifies conflicting schedule
    // e.g. Saved "morning" vs current turn "after 6 PM" / "evening"
    if (savedDeparture && savedDeparture !== 'any' && requirements.departureAfter) {
      const hour = parseInt(requirements.departureAfter.split(':')[0], 10);
      const queryIsEvening = !isNaN(hour) && hour >= 18;
      if (savedDeparture === 'morning' && queryIsEvening) {
        conflicts.push({
          id: `conflict_departure_${Date.now()}`,
          field: 'departure_window',
          existingValue: 'morning',
          newValue: 'evening',
          sourceTurn: turnCount,
          severity: 'medium',
          resolutionRequired: false, // Auto-resolved in favor of current-turn hard schedule constraint
          description: 'Current search schedule (after 6 PM) diverges from saved morning departure preference.',
          suggestedClarification: 'Prioritizing evening departures (after 6 PM) for this specific trip.',
          options: [
            {
              id: 'opt_use_evening',
              label: 'Evening departures (Current search)',
              description: 'Filter departures after 6 PM',
              resolutionAction: 'USE_CURRENT_REQUIREMENT',
              scope: 'session',
              value: 'evening',
            },
          ],
        });
      }
    }

    if (conflicts.length > 0) {
      logger.info('Detected preference conflicts', {
        count: conflicts.length,
        requiresResolution: conflicts.some((c) => c.resolutionRequired),
      });
    }

    return conflicts;
  }

  /**
   * Evaluates if a user's conversational response resolves an active conflict
   */
  resolveConflictFromInput(
    text: string,
    activeConflicts: PreferenceConflict[]
  ): { resolvedConflict: PreferenceConflict; chosenOption: ConflictOption } | null {
    if (!activeConflicts || activeConflicts.length === 0) return null;

    const clean = text.trim().toLowerCase();

    for (const conflict of activeConflicts) {
      // Check for choice matching option 1 or 2
      if (clean.match(/^(1|one|first(\s+one)?|option\s+1)$/i)) {
        return { resolvedConflict: conflict, chosenOption: conflict.options[0] };
      }
      if (clean.match(/^(2|two|second(\s+one)?|option\s+2)$/i) && conflict.options.length > 1) {
        return { resolvedConflict: conflict, chosenOption: conflict.options[1] };
      }

      // Check for semantic keywords matching options
      for (const opt of conflict.options) {
        const optKeywords = opt.label.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
        if (optKeywords.some((k) => clean.includes(k))) {
          return { resolvedConflict: conflict, chosenOption: opt };
        }
      }

      // Explicit pattern matching for common trade-offs
      if (clean.includes('price') || clean.includes('cheapest') || clean.includes('lowest')) {
        const priceOpt = conflict.options.find((o) => o.resolutionAction === 'USE_CURRENT_REQUIREMENT');
        if (priceOpt) return { resolvedConflict: conflict, chosenOption: priceOpt };
      }

      if (clean.includes('apple') || clean.includes('asus') || clean.includes('keep') || clean.includes('saved')) {
        const keepOpt = conflict.options.find((o) => o.resolutionAction === 'KEEP_SAVED_PREFERENCE');
        if (keepOpt) return { resolvedConflict: conflict, chosenOption: keepOpt };
      }
    }

    return null;
  }
}

export const preferenceConflictDetector = new PreferenceConflictDetector();
