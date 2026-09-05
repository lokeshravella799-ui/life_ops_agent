import type {
  UserPersonalizationProfile,
  SessionPreferences,
  EffectivePreferences,
  PreferenceUpdateCommand,
} from '../types/personalization';
import type { SearchRequirements } from '../types/agent';
import { adaptiveLearningEngine } from './adaptiveLearningEngine';
import { logger } from '../utils/logger';

export class SessionPreferenceStore {
  private sessions: Map<string, SessionPreferences> = new Map();

  /**
   * Safety sanitizer: Strictly prevents financial or sensitive credentials from entering session preferences
   */
  private sanitize(input: any): any {
    if (!input || typeof input !== 'object') return input;
    if (Array.isArray(input)) return input.map((i) => this.sanitize(i));

    const clean: Record<string, any> = {};
    const prohibitedKeywords = [
      'card_number',
      'cardnumber',
      'card_num',
      'credit_card',
      'debit_card',
      'cvv',
      'cvc',
      'pin',
      'upi_pin',
      'upipin',
      'atm_pin',
      'atmpin',
      'banking_password',
      'bankpassword',
      'netbanking',
      'password',
      'token',
      'secret',
      'otp',
      'one_time_password',
      'account_number',
    ];

    for (const [k, v] of Object.entries(input)) {
      const kLower = k.toLowerCase();
      const isProhibited = prohibitedKeywords.some((p) => {
        if (kLower === p) return true;
        if (p.length <= 4) {
          return (
            kLower.startsWith(`${p}_`) ||
            kLower.endsWith(`_${p}`) ||
            kLower.includes(`_${p}_`)
          );
        }
        return kLower.includes(p);
      });

      if (isProhibited) {
        logger.warn(`Security invariant: Stripped prohibited financial credential key "${k}" from session preference`);
        continue;
      }
      if (typeof v === 'string') {
        const digitsOnly = v.replace(/[^0-9]/g, '');
        if (digitsOnly.length >= 13 && digitsOnly.length <= 19 && /\b(?:\d[ -]*?){13,19}\b/.test(v)) {
          logger.warn(`Security invariant: Stripped card number pattern from string value in session preference`);
          continue;
        }
      }
      if (typeof v === 'object' && v !== null) {
        clean[k] = this.sanitize(v);
      } else {
        clean[k] = v;
      }
    }
    return clean;
  }

  private createDefaultSession(conversationId: string): SessionPreferences {
    return {
      conversationId,
      ignoreSavedPreferences: false,
      preferredBrands: undefined,
      excludedBrands: undefined,
      rankingPriority: undefined,
      preferredDepartureTimeWindow: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      appliedOverrides: [],
      activeNotes: [],
      updatedAt: new Date().toISOString(),
    };
  }

  getSessionPreferences(conversationId: string): SessionPreferences {
    let session = this.sessions.get(conversationId);
    if (!session) {
      session = this.createDefaultSession(conversationId);
      this.sessions.set(conversationId, session);
    }
    return JSON.parse(JSON.stringify(session));
  }

  getPreferences(conversationId: string): SessionPreferences {
    return this.getSessionPreferences(conversationId);
  }

  updateSession(
    conversationId: string,
    updates: Partial<SessionPreferences>
  ): SessionPreferences {
    return this.updateSessionPreferences(conversationId, updates);
  }

  updateSessionPreferences(
    conversationId: string,
    updates: Partial<SessionPreferences>
  ): SessionPreferences {
    const existing = this.getSessionPreferences(conversationId);
    const sanitized = this.sanitize(updates);

    const merged: SessionPreferences = {
      ...existing,
      ...sanitized,
      conversationId,
      updatedAt: new Date().toISOString(),
    };

    this.sessions.set(conversationId, merged);
    logger.info('Updated session-scoped preferences', { conversationId });
    return JSON.parse(JSON.stringify(merged));
  }

  clearSessionPreferences(conversationId: string): SessionPreferences {
    const fresh = this.createDefaultSession(conversationId);
    this.sessions.set(conversationId, fresh);
    logger.info('Cleared session-scoped preferences', { conversationId });
    return fresh;
  }

  setIgnoreSavedPreferences(conversationId: string, ignore: boolean): SessionPreferences {
    const session = this.getSessionPreferences(conversationId);
    session.ignoreSavedPreferences = ignore;
    if (ignore) {
      session.appliedOverrides = session.appliedOverrides || [];
      session.appliedOverrides.push('Temporarily ignored saved global preferences for this session');
    }
    session.updatedAt = new Date().toISOString();
    this.sessions.set(conversationId, session);
    return JSON.parse(JSON.stringify(session));
  }

  applyCommand(conversationId: string, command: PreferenceUpdateCommand): SessionPreferences {
    const session = this.getSessionPreferences(conversationId);
    const overrides = session.appliedOverrides || [];

    switch (command.action) {
      case 'IGNORE_SAVED_PREFERENCES':
        return this.setIgnoreSavedPreferences(conversationId, true);

      case 'RESTORE_SAVED_PREFERENCES':
        return this.setIgnoreSavedPreferences(conversationId, false);

      case 'ADD_PREFERRED_BRAND':
        if (command.brand) {
          const current = session.preferredBrands || [];
          if (!current.some((b) => b.toLowerCase() === command.brand!.toLowerCase())) {
            session.preferredBrands = [...current, command.brand];
          }
          // Remove from excluded
          if (session.excludedBrands) {
            session.excludedBrands = session.excludedBrands.filter(
              (b) => b.toLowerCase() !== command.brand!.toLowerCase()
            );
          }
          overrides.push(`Applied session preferred brand: ${command.brand}`);
        }
        break;

      case 'REMOVE_PREFERRED_BRAND':
        if (command.brand && session.preferredBrands) {
          session.preferredBrands = session.preferredBrands.filter(
            (b) => b.toLowerCase() !== command.brand!.toLowerCase()
          );
        }
        break;

      case 'ADD_EXCLUDED_BRAND':
        if (command.brand) {
          const current = session.excludedBrands || [];
          if (!current.some((b) => b.toLowerCase() === command.brand!.toLowerCase())) {
            session.excludedBrands = [...current, command.brand];
          }
          if (session.preferredBrands) {
            session.preferredBrands = session.preferredBrands.filter(
              (b) => b.toLowerCase() !== command.brand!.toLowerCase()
            );
          }
          overrides.push(`Applied session brand exclusion: ${command.brand}`);
        }
        break;

      case 'SET_RANKING_PRIORITY':
        if (command.priority) {
          session.rankingPriority = command.priority;
          overrides.push(`Applied session ranking priority: ${command.priority.replace('_', ' ')}`);
        }
        break;

      case 'SET_DEPARTURE_WINDOW':
        if (command.departureWindow) {
          session.preferredDepartureTimeWindow = command.departureWindow;
          overrides.push(`Applied session departure window: ${command.departureWindow}`);
        }
        break;

      case 'CLEAR_ALL':
        return this.clearSessionPreferences(conversationId);
    }

    session.appliedOverrides = overrides;
    session.updatedAt = new Date().toISOString();
    this.sessions.set(conversationId, session);
    return JSON.parse(JSON.stringify(session));
  }

  /**
   * Computes Effective Preferences according to the Strict Precedence Rule:
   * 1. Safety / verification / availability (enforced at verification/gate layer)
   * 2. Explicit current-turn hard constraints
   * 3. Explicit current-turn preferences (session-scoped)
   * 4. Persisted user preferences (global profile)
   * 5. Default ranking behavior
   */
  computeEffectivePreferences(
    profile: UserPersonalizationProfile,
    sessionPrefs?: SessionPreferences,
    currentRequirements?: SearchRequirements
  ): EffectivePreferences {
    const overrides: string[] = [];
    const ignoreSaved = Boolean(sessionPrefs?.ignoreSavedPreferences);

    // Baseline: clone saved global profile or start from defaults if ignored
    const effectiveShopping = ignoreSaved
      ? {
          preferredBrands: [],
          excludedBrands: [],
          preferredCategories: [],
          priorityWeights: { price: 0.25, quality: 0.25, performance: 0.25, brand: 0.25 },
        }
      : JSON.parse(JSON.stringify(profile.shopping));

    const effectiveTravel = ignoreSaved
      ? {
          preferredDepartureTimeWindow: 'any' as const,
          preferredTransportTypes: ['bus' as const, 'flight' as const],
          preferredAirlines: [],
          excludedAirlines: [],
          preferredOperators: [],
          excludedOperators: [],
        }
      : JSON.parse(JSON.stringify(profile.travel));

    let effectivePriority = ignoreSaved ? 'balanced' : profile.general.rankingPriority;

    if (ignoreSaved) {
      overrides.push('Saved profile preferences temporarily ignored for this search context');
    }

    // Layer 3: Explicit Session Preferences
    if (sessionPrefs) {
      if (sessionPrefs.preferredBrands && sessionPrefs.preferredBrands.length > 0) {
        effectiveShopping.preferredBrands = [...sessionPrefs.preferredBrands];
        overrides.push(`Session preferred brand(s): ${sessionPrefs.preferredBrands.join(', ')}`);
      }
      if (sessionPrefs.excludedBrands && sessionPrefs.excludedBrands.length > 0) {
        effectiveShopping.excludedBrands = [...sessionPrefs.excludedBrands];
        overrides.push(`Session excluded brand(s): ${sessionPrefs.excludedBrands.join(', ')}`);
      }
      if (sessionPrefs.rankingPriority) {
        effectivePriority = sessionPrefs.rankingPriority;
        overrides.push(`Session priority: ${sessionPrefs.rankingPriority.replace('_', ' ')}`);
      }
      if (sessionPrefs.preferredDepartureTimeWindow) {
        effectiveTravel.preferredDepartureTimeWindow = sessionPrefs.preferredDepartureTimeWindow;
        overrides.push(`Session departure window: ${sessionPrefs.preferredDepartureTimeWindow}`);
      }
    }

    // Layer 2: Explicit Current-Turn Hard Constraints / Preferences
    if (currentRequirements) {
      // 2a. Current turn budget constraint
      if (currentRequirements.budget?.max) {
        effectiveShopping.maxPrice = currentRequirements.budget.max;
        if (profile.shopping.maxPrice && profile.shopping.maxPrice !== currentRequirements.budget.max) {
          overrides.push(
            `Current search budget cap (₹${currentRequirements.budget.max.toLocaleString('en-IN')}) overrides saved budget limit (₹${profile.shopping.maxPrice.toLocaleString('en-IN')})`
          );
        }
      }

      // 2b. Current turn priority indicators (e.g. sortPreference === 'cheapest' or keywords)
      if (currentRequirements.sortPreference === 'cheapest') {
        effectivePriority = 'lowest_price';
        overrides.push('Current search requested lowest price');
      }

      // 2c. Current turn departure constraints
      if (currentRequirements.departureAfter) {
        const hour = parseInt(currentRequirements.departureAfter.split(':')[0], 10);
        if (!isNaN(hour)) {
          if (hour >= 18) {
            effectiveTravel.preferredDepartureTimeWindow = 'evening';
            overrides.push('Current turn schedule constraint: evening departures (after 6 PM)');
          } else if (hour >= 12) {
            effectiveTravel.preferredDepartureTimeWindow = 'afternoon';
            overrides.push('Current turn schedule constraint: afternoon departures');
          } else if (hour >= 6) {
            effectiveTravel.preferredDepartureTimeWindow = 'morning';
            overrides.push('Current turn schedule constraint: morning departures');
          }
        }
      }
    }

    // Update weights for the resolved priority
    if (effectivePriority === 'lowest_price') {
      effectiveShopping.priorityWeights = {
        price: 0.50,
        quality: 0.15,
        performance: 0.15,
        brand: 0.20,
      };
    } else if (effectivePriority === 'highest_quality') {
      effectiveShopping.priorityWeights = {
        price: 0.15,
        quality: 0.40,
        performance: 0.30,
        brand: 0.15,
      };
    }

    const feedbackBoosts = adaptiveLearningEngine.computeFeedbackBoosts(profile);

    return {
      userId: profile.userId,
      conversationId: sessionPrefs?.conversationId,
      activePersonaId: sessionPrefs?.activePersonaId || profile.activePersonaId || 'personal',
      shopping: effectiveShopping,
      travel: effectiveTravel,
      general: {
        rankingPriority: effectivePriority,
        preferredProviders: profile.general.preferredProviders,
      },
      appliedOverrides: overrides,
      ignoredSavedPreferences: ignoreSaved,
      activeSessionOverrides: Boolean(sessionPrefs && (
        sessionPrefs.preferredBrands ||
        sessionPrefs.excludedBrands ||
        sessionPrefs.rankingPriority ||
        sessionPrefs.preferredDepartureTimeWindow ||
        sessionPrefs.ignoreSavedPreferences
      )),
      feedbackBoosts,
    };
  }
}

export const sessionPreferenceStore = new SessionPreferenceStore();
