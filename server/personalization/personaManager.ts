import type {
  PersonaId,
  PersonaProfileData,
  UserPersonalizationProfile,
  ShoppingPreferences,
  TravelPreferences,
  GeneralPreferences,
} from '../types/personalization';
import { logger } from '../utils/logger';

export class PersonaManager {
  /**
   * Generates standard default personas for a user
   */
  createDefaultPersonas(): Record<string, PersonaProfileData> {
    const now = new Date().toISOString();

    const defaultShopping: ShoppingPreferences = {
      preferredBrands: [],
      excludedBrands: [],
      preferredCategories: [],
      priorityWeights: {
        price: 0.25,
        quality: 0.25,
        performance: 0.25,
        brand: 0.25,
      },
    };

    const defaultTravel: TravelPreferences = {
      preferredDepartureTimeWindow: 'any',
      preferredTransportTypes: ['bus', 'flight'],
      preferredAirlines: [],
      excludedAirlines: [],
      preferredOperators: [],
      excludedOperators: [],
    };

    const defaultGeneral: GeneralPreferences = {
      rankingPriority: 'balanced',
      preferredProviders: [],
    };

    const workShopping: ShoppingPreferences = {
      preferredBrands: [],
      excludedBrands: [],
      preferredCategories: [],
      priorityWeights: {
        price: 0.15,
        quality: 0.35,
        performance: 0.40,
        brand: 0.10,
      },
    };

    const workTravel: TravelPreferences = {
      preferredDepartureTimeWindow: 'morning',
      preferredTransportTypes: ['flight', 'bus'],
      preferredAirlines: [],
      excludedAirlines: [],
      preferredOperators: [],
      excludedOperators: [],
    };

    const workGeneral: GeneralPreferences = {
      rankingPriority: 'highest_quality',
      preferredProviders: [],
    };

    return {
      personal: {
        personaId: 'personal',
        name: 'Personal',
        description: 'Personal lifestyle, entertainment, leisure travel, and everyday shopping.',
        shopping: defaultShopping,
        travel: defaultTravel,
        general: defaultGeneral,
        createdAt: now,
        updatedAt: now,
      },
      work: {
        personaId: 'work',
        name: 'Work / Business',
        description: 'Professional hardware, engineering-grade performance, and business transit schedules.',
        shopping: workShopping,
        travel: workTravel,
        general: workGeneral,
        createdAt: now,
        updatedAt: now,
      },
    };
  }

  /**
   * Retrieves specific persona from profile, defaulting to activePersona or 'personal'
   */
  getPersona(profile: UserPersonalizationProfile, personaId?: PersonaId): PersonaProfileData {
    const targetId = personaId || profile.activePersonaId || 'personal';
    if (!profile.personas) {
      profile.personas = this.createDefaultPersonas();
    }
    if (!profile.personas[targetId]) {
      // Initialize if missing
      const defaults = this.createDefaultPersonas();
      profile.personas[targetId] = defaults[targetId] || {
        personaId: targetId,
        name: targetId.charAt(0).toUpperCase() + targetId.slice(1),
        shopping: JSON.parse(JSON.stringify(profile.shopping || defaults.personal.shopping)),
        travel: JSON.parse(JSON.stringify(profile.travel || defaults.personal.travel)),
        general: JSON.parse(JSON.stringify(profile.general || defaults.personal.general)),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
    return profile.personas[targetId];
  }

  /**
   * Switches the active persona on a profile and synchronizes root shortcut fields
   */
  switchPersona(
    profile: UserPersonalizationProfile,
    targetPersonaId: PersonaId
  ): { updatedProfile: UserPersonalizationProfile; previousPersonaId: string } {
    const previous = profile.activePersonaId || 'personal';
    const cleanTarget = targetPersonaId.toLowerCase();

    // Ensure personas are initialized
    if (!profile.personas || Object.keys(profile.personas).length === 0) {
      profile.personas = this.createDefaultPersonas();
    }

    if (!profile.personas[cleanTarget]) {
      // Create new persona record
      profile.personas[cleanTarget] = {
        personaId: cleanTarget,
        name: cleanTarget.charAt(0).toUpperCase() + cleanTarget.slice(1),
        shopping: JSON.parse(JSON.stringify(profile.shopping)),
        travel: JSON.parse(JSON.stringify(profile.travel)),
        general: JSON.parse(JSON.stringify(profile.general)),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    profile.activePersonaId = cleanTarget;
    this.syncActivePersonaToRoot(profile);
    profile.updatedAt = new Date().toISOString();

    logger.info('Switched active persona', {
      userId: profile.userId,
      from: previous,
      to: cleanTarget,
    });

    return { updatedProfile: profile, previousPersonaId: previous };
  }

  /**
   * Synchronizes active persona preferences to profile root fields for backwards compatibility
   */
  syncActivePersonaToRoot(profile: UserPersonalizationProfile): void {
    const active = this.getPersona(profile);
    profile.shopping = active.shopping;
    profile.travel = active.travel;
    profile.general = active.general;
  }

  /**
   * Updates preferences within the active persona and mirrors to root
   */
  updateActivePersonaPreferences(
    profile: UserPersonalizationProfile,
    updates: {
      shopping?: Partial<ShoppingPreferences>;
      travel?: Partial<TravelPreferences>;
      general?: Partial<GeneralPreferences>;
    }
  ): UserPersonalizationProfile {
    const active = this.getPersona(profile);

    if (updates.shopping) {
      active.shopping = {
        ...active.shopping,
        ...updates.shopping,
        priorityWeights: {
          ...active.shopping.priorityWeights,
          ...(updates.shopping.priorityWeights || {}),
        },
      };
    }

    if (updates.travel) {
      active.travel = {
        ...active.travel,
        ...updates.travel,
      };
    }

    if (updates.general) {
      active.general = {
        ...active.general,
        ...updates.general,
      };
    }

    active.updatedAt = new Date().toISOString();
    profile.personas[profile.activePersonaId] = active;
    this.syncActivePersonaToRoot(profile);
    profile.updatedAt = new Date().toISOString();

    return profile;
  }
}

export const personaManager = new PersonaManager();
