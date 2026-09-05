import type {
  UserPersonalizationProfile,
  RankingPriority,
  DepartureTimeWindow,
  PreferenceUpdateCommand,
  PersonaId,
  RecommendationFeedbackEvent,
  StagedInference,
  ProfileEvolutionEntry,
} from '../types/personalization';
import { personaManager } from './personaManager';
import { adaptiveLearningEngine } from './adaptiveLearningEngine';
import { logger } from '../utils/logger';

export class PersonalizationProfileStore {
  private profiles: Map<string, UserPersonalizationProfile> = new Map();

  private isCardNumberPattern(str: string): boolean {
    const digitsOnly = str.replace(/[^0-9]/g, '');
    return digitsOnly.length >= 13 && digitsOnly.length <= 19 && /\b(?:\d[ -]*?){13,19}\b/.test(str);
  }

  /**
   * Safety sanitizer: Strictly prevents financial or sensitive credentials from entering profiles
   */
  private sanitize(input: any): any {
    if (!input) return input;
    if (typeof input === 'string') {
      if (this.isCardNumberPattern(input)) {
        logger.warn(`Security invariant: Stripped card number pattern from string value in profile`);
        return undefined;
      }
      return input;
    }
    if (Array.isArray(input)) {
      return input
        .filter((item) => {
          if (typeof item === 'string' && this.isCardNumberPattern(item)) {
            logger.warn(`Security invariant: Stripped card number pattern from array item in profile`);
            return false;
          }
          return true;
        })
        .map((i) => this.sanitize(i));
    }
    if (typeof input !== 'object') return input;

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
        logger.warn(`Security invariant: Rejected prohibited financial credential key "${k}" in profile data`);
        continue;
      }
      if (typeof v === 'string') {
        if (this.isCardNumberPattern(v)) {
          logger.warn(`Security invariant: Stripped card number pattern from string value in profile`);
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

  /**
   * Generates clean default profile for a given user
   */
  private createDefaultProfile(userId: string): UserPersonalizationProfile {
    const now = new Date().toISOString();
    const personas = personaManager.createDefaultPersonas();
    const activePersona = personas.personal;

    return {
      userId,
      activePersonaId: 'personal',
      personas,
      shopping: JSON.parse(JSON.stringify(activePersona.shopping)),
      travel: JSON.parse(JSON.stringify(activePersona.travel)),
      general: JSON.parse(JSON.stringify(activePersona.general)),
      stagedInferences: [],
      feedbackHistory: [],
      evolutionHistory: [],
      selectionHistory: [],
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Retrieves profile for user, creating a default one if not already initialized
   */
  getProfile(userId: string = 'default_user'): UserPersonalizationProfile {
    let profile = this.profiles.get(userId);
    if (!profile) {
      profile = this.createDefaultProfile(userId);
      this.profiles.set(userId, profile);
    }
    // Ensure personas map exists
    if (!profile.personas || Object.keys(profile.personas).length === 0) {
      profile.personas = personaManager.createDefaultPersonas();
      profile.activePersonaId = profile.activePersonaId || 'personal';
      personaManager.syncActivePersonaToRoot(profile);
    }
    if (!profile.evolutionHistory) profile.evolutionHistory = [];
    if (!profile.feedbackHistory) profile.feedbackHistory = [];
    if (!profile.stagedInferences) profile.stagedInferences = [];
    if (!profile.selectionHistory) profile.selectionHistory = [];

    return JSON.parse(JSON.stringify(profile));
  }

  /**
   * Records a profile evolution entry for auditability
   */
  recordEvolution(
    userId: string,
    entry: Omit<ProfileEvolutionEntry, 'id' | 'timestamp'>,
    targetProfile?: UserPersonalizationProfile
  ): void {
    const profile = targetProfile || this.getProfile(userId);
    const fullEntry: ProfileEvolutionEntry = {
      ...entry,
      id: `evo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    profile.evolutionHistory = profile.evolutionHistory || [];
    profile.evolutionHistory.push(fullEntry);
    this.profiles.set(userId, profile);
  }

  /**
   * Updates partial profile fields with strict sanitization
   */
  updateProfile(
    userId: string = 'default_user',
    updates: Partial<UserPersonalizationProfile>
  ): UserPersonalizationProfile {
    const existing = this.getProfile(userId);
    const sanitized = this.sanitize(updates);

    const merged: UserPersonalizationProfile = {
      ...existing,
      ...sanitized,
      shopping: {
        ...existing.shopping,
        ...(sanitized.shopping || {}),
        priorityWeights: {
          ...existing.shopping.priorityWeights,
          ...(sanitized.shopping?.priorityWeights || {}),
        },
      },
      travel: {
        ...existing.travel,
        ...(sanitized.travel || {}),
      },
      general: {
        ...existing.general,
        ...(sanitized.general || {}),
      },
      selectionHistory: updates.selectionHistory !== undefined ? updates.selectionHistory : (existing.selectionHistory || []),
      updatedAt: new Date().toISOString(),
    };

    // Keep active persona synchronized
    if (merged.personas && merged.personas[merged.activePersonaId]) {
      merged.personas[merged.activePersonaId].shopping = merged.shopping;
      merged.personas[merged.activePersonaId].travel = merged.travel;
      merged.personas[merged.activePersonaId].general = merged.general;
    }

    this.profiles.set(userId, merged);
    logger.info('Updated personalization profile', { userId });
    return JSON.parse(JSON.stringify(merged));
  }

  /**
   * Switch active persona
   */
  switchPersona(userId: string, personaId: PersonaId): UserPersonalizationProfile {
    const profile = this.getProfile(userId);
    const { updatedProfile, previousPersonaId } = personaManager.switchPersona(profile, personaId);

    this.recordEvolution(userId, {
      personaId: updatedProfile.activePersonaId,
      changeType: 'PERSONA_SWITCHED',
      source: 'EXPLICIT_USER',
      field: 'activePersonaId',
      oldValue: previousPersonaId,
      newValue: updatedProfile.activePersonaId,
      description: `Switched active persona from ${previousPersonaId} to ${updatedProfile.activePersonaId}`,
      revertible: true,
    }, updatedProfile);

    this.profiles.set(userId, updatedProfile);
    return JSON.parse(JSON.stringify(updatedProfile));
  }

  /**
   * Add a preferred brand (case-insensitively deduplicated)
   */
  addPreferredBrand(userId: string, brand: string, source: 'EXPLICIT_USER' | 'INFERRED_CONFIRMED' | 'FEEDBACK_DRIVEN' = 'EXPLICIT_USER'): UserPersonalizationProfile {
    const profile = this.getProfile(userId);
    const cleanBrand = brand.trim();
    if (!cleanBrand) return profile;
    if (this.isCardNumberPattern(cleanBrand)) {
      logger.warn('Security invariant: Refused to add brand containing card number pattern');
      return profile;
    }

    const oldBrands = [...(profile.shopping.preferredBrands || [])];

    // Remove from excluded if present
    profile.shopping.excludedBrands = profile.shopping.excludedBrands.filter(
      (b) => b.toLowerCase() !== cleanBrand.toLowerCase()
    );

    // Add to preferred if not present
    if (!profile.shopping.preferredBrands.some((b) => b.toLowerCase() === cleanBrand.toLowerCase())) {
      profile.shopping.preferredBrands.push(cleanBrand);
    }

    personaManager.updateActivePersonaPreferences(profile, { shopping: profile.shopping });

    this.recordEvolution(userId, {
      personaId: profile.activePersonaId,
      changeType: 'PREFERENCE_ADDED',
      source,
      field: 'shopping.preferredBrands',
      oldValue: oldBrands,
      newValue: profile.shopping.preferredBrands,
      description: `Added ${cleanBrand} to preferred brands`,
      revertible: true,
    }, profile);

    profile.updatedAt = new Date().toISOString();
    this.profiles.set(userId, profile);
    return JSON.parse(JSON.stringify(profile));
  }

  /**
   * Remove a preferred brand
   */
  removePreferredBrand(userId: string, brand: string): UserPersonalizationProfile {
    const profile = this.getProfile(userId);
    const cleanBrand = brand.trim().toLowerCase();
    const oldBrands = [...(profile.shopping.preferredBrands || [])];

    profile.shopping.preferredBrands = profile.shopping.preferredBrands.filter(
      (b) => b.toLowerCase() !== cleanBrand
    );

    personaManager.updateActivePersonaPreferences(profile, { shopping: profile.shopping });

    this.recordEvolution(userId, {
      personaId: profile.activePersonaId,
      changeType: 'PREFERENCE_REMOVED',
      source: 'EXPLICIT_USER',
      field: 'shopping.preferredBrands',
      oldValue: oldBrands,
      newValue: profile.shopping.preferredBrands,
      description: `Removed ${brand.trim()} from preferred brands`,
      revertible: true,
    }, profile);

    profile.updatedAt = new Date().toISOString();
    this.profiles.set(userId, profile);
    return JSON.parse(JSON.stringify(profile));
  }

  /**
   * Add an excluded brand (case-insensitively deduplicated)
   */
  addExcludedBrand(userId: string, brand: string, source: 'EXPLICIT_USER' | 'FEEDBACK_DRIVEN' = 'EXPLICIT_USER'): UserPersonalizationProfile {
    const profile = this.getProfile(userId);
    const cleanBrand = brand.trim();
    if (!cleanBrand) return profile;
    if (this.isCardNumberPattern(cleanBrand)) {
      logger.warn('Security invariant: Refused to add brand containing card number pattern');
      return profile;
    }

    const oldExcluded = [...(profile.shopping.excludedBrands || [])];

    // Remove from preferred if present
    profile.shopping.preferredBrands = profile.shopping.preferredBrands.filter(
      (b) => b.toLowerCase() !== cleanBrand.toLowerCase()
    );

    // Add to excluded if not present
    if (!profile.shopping.excludedBrands.some((b) => b.toLowerCase() === cleanBrand.toLowerCase())) {
      profile.shopping.excludedBrands.push(cleanBrand);
    }

    personaManager.updateActivePersonaPreferences(profile, { shopping: profile.shopping });

    this.recordEvolution(userId, {
      personaId: profile.activePersonaId,
      changeType: 'PREFERENCE_ADDED',
      source,
      field: 'shopping.excludedBrands',
      oldValue: oldExcluded,
      newValue: profile.shopping.excludedBrands,
      description: `Added ${cleanBrand} to excluded brands`,
      revertible: true,
    }, profile);

    profile.updatedAt = new Date().toISOString();
    this.profiles.set(userId, profile);
    return JSON.parse(JSON.stringify(profile));
  }

  /**
   * Remove an excluded brand
   */
  removeExcludedBrand(userId: string, brand: string): UserPersonalizationProfile {
    const profile = this.getProfile(userId);
    const cleanBrand = brand.trim().toLowerCase();
    const oldExcluded = [...(profile.shopping.excludedBrands || [])];

    profile.shopping.excludedBrands = profile.shopping.excludedBrands.filter(
      (b) => b.toLowerCase() !== cleanBrand
    );

    personaManager.updateActivePersonaPreferences(profile, { shopping: profile.shopping });

    this.recordEvolution(userId, {
      personaId: profile.activePersonaId,
      changeType: 'PREFERENCE_REMOVED',
      source: 'EXPLICIT_USER',
      field: 'shopping.excludedBrands',
      oldValue: oldExcluded,
      newValue: profile.shopping.excludedBrands,
      description: `Removed ${brand.trim()} from excluded brands`,
      revertible: true,
    }, profile);

    profile.updatedAt = new Date().toISOString();
    this.profiles.set(userId, profile);
    return JSON.parse(JSON.stringify(profile));
  }

  /**
   * Set ranking priority with appropriate baseline weights
   */
  setRankingPriority(userId: string, priority: RankingPriority): UserPersonalizationProfile {
    const profile = this.getProfile(userId);
    const oldPriority = profile.general.rankingPriority;
    profile.general.rankingPriority = priority;

    // Shift weights based on selected priority
    if (priority === 'lowest_price') {
      profile.shopping.priorityWeights = {
        price: 0.50,
        quality: 0.15,
        performance: 0.15,
        brand: 0.20,
      };
    } else if (priority === 'highest_quality') {
      profile.shopping.priorityWeights = {
        price: 0.15,
        quality: 0.40,
        performance: 0.30,
        brand: 0.15,
      };
    } else if (priority === 'fastest') {
      profile.shopping.priorityWeights = {
        price: 0.20,
        quality: 0.20,
        performance: 0.40,
        brand: 0.20,
      };
    } else {
      profile.shopping.priorityWeights = {
        price: 0.25,
        quality: 0.25,
        performance: 0.25,
        brand: 0.25,
      };
    }

    personaManager.updateActivePersonaPreferences(profile, {
      general: profile.general,
      shopping: profile.shopping,
    });

    this.recordEvolution(userId, {
      personaId: profile.activePersonaId,
      changeType: 'PRIORITY_CHANGED',
      source: 'EXPLICIT_USER',
      field: 'general.rankingPriority',
      oldValue: oldPriority,
      newValue: priority,
      description: `Changed ranking priority to ${priority}`,
      revertible: true,
    }, profile);

    profile.updatedAt = new Date().toISOString();
    this.profiles.set(userId, profile);
    return JSON.parse(JSON.stringify(profile));
  }

  /**
   * Set preferred departure time window for transit
   */
  setDepartureTimeWindow(userId: string, window: DepartureTimeWindow): UserPersonalizationProfile {
    const profile = this.getProfile(userId);
    const oldWindow = profile.travel.preferredDepartureTimeWindow;
    profile.travel.preferredDepartureTimeWindow = window;

    personaManager.updateActivePersonaPreferences(profile, { travel: profile.travel });

    this.recordEvolution(userId, {
      personaId: profile.activePersonaId,
      changeType: 'PREFERENCE_ADDED',
      source: 'EXPLICIT_USER',
      field: 'travel.preferredDepartureTimeWindow',
      oldValue: oldWindow,
      newValue: window,
      description: `Set departure time window to ${window}`,
      revertible: true,
    }, profile);

    profile.updatedAt = new Date().toISOString();
    this.profiles.set(userId, profile);
    return JSON.parse(JSON.stringify(profile));
  }

  /**
   * Record recommendation feedback (thumbs up/down)
   */
  recordFeedback(userId: string, feedback: RecommendationFeedbackEvent): UserPersonalizationProfile {
    const profile = this.getProfile(userId);
    const sanitizedFeedback = this.sanitize(feedback) as RecommendationFeedbackEvent;

    const { updatedProfile } = adaptiveLearningEngine.processFeedback(
      userId,
      profile,
      sanitizedFeedback
    );

    this.recordEvolution(userId, {
      personaId: profile.activePersonaId,
      changeType: 'FEEDBACK_APPLIED',
      source: 'FEEDBACK_DRIVEN',
      field: 'feedbackHistory',
      oldValue: null,
      newValue: sanitizedFeedback.rating,
      description: `Recorded ${sanitizedFeedback.rating} feedback for ${sanitizedFeedback.targetBrand || sanitizedFeedback.targetTitle || 'recommendation'} (${sanitizedFeedback.reason || 'no reason'})`,
      revertible: false,
    }, updatedProfile);

    this.profiles.set(userId, updatedProfile);
    return JSON.parse(JSON.stringify(updatedProfile));
  }

  /**
   * Stage an inferred preference
   */
  stageInference(userId: string, inference: Partial<StagedInference>): StagedInference {
    const profile = this.getProfile(userId);
    profile.stagedInferences = profile.stagedInferences || [];

    const staged: StagedInference = {
      id: inference.id || `inf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      field: (inference.field as any) || 'shopping.preferredBrands',
      inferredValue: inference.inferredValue,
      confidenceScore: inference.confidenceScore ?? inference.confidence ?? 0.85,
      confidence: inference.confidence ?? inference.confidenceScore ?? 0.85,
      observationCount: inference.observationCount ?? 3,
      proposalText:
        inference.proposalText ||
        inference.reason ||
        `LifeOps noticed you frequently select ${inference.inferredValue}. Would you like to add it to your preferences?`,
      reason: inference.reason,
      status: (inference.status as any) || 'STAGED',
      detectedAt: inference.detectedAt || new Date().toISOString(),
    };

    const existingIdx = profile.stagedInferences.findIndex(
      (inf) => inf.id === staged.id || (inf.field === staged.field && inf.inferredValue === staged.inferredValue)
    );

    if (existingIdx !== -1) {
      profile.stagedInferences[existingIdx] = staged;
    } else {
      profile.stagedInferences.push(staged);
    }

    profile.updatedAt = new Date().toISOString();
    this.profiles.set(userId, profile);
    return JSON.parse(JSON.stringify(staged));
  }

  /**
   * Accept and commit a staged inference to the user's active profile
   */
  acceptStagedInference(userId: string, inferenceId: string): UserPersonalizationProfile {
    const profile = this.getProfile(userId);
    const inf = (profile.stagedInferences || []).find((i) => i.id === inferenceId);
    if (!inf) return profile;

    inf.status = 'ACCEPTED';

    if (
      (inf.field === 'preferredBrand' || inf.field === 'shopping.preferredBrands') &&
      typeof inf.inferredValue === 'string'
    ) {
      const cleanBrand = inf.inferredValue.trim();
      const oldBrands = [...(profile.shopping.preferredBrands || [])];
      if (!profile.shopping.preferredBrands.some((b) => b.toLowerCase() === cleanBrand.toLowerCase())) {
        profile.shopping.preferredBrands.push(cleanBrand);
      }
      personaManager.updateActivePersonaPreferences(profile, { shopping: profile.shopping });

      this.recordEvolution(
        userId,
        {
          personaId: profile.activePersonaId,
          changeType: 'INFERENCE_CONFIRMED',
          source: 'ACCEPTED_INFERENCE' as any,
          field: 'shopping.preferredBrands',
          oldValue: oldBrands,
          newValue: profile.shopping.preferredBrands,
          description: `Accepted inferred preference for ${cleanBrand}`,
          revertible: true,
        },
        profile
      );

      profile.updatedAt = new Date().toISOString();
      this.profiles.set(userId, profile);
      return JSON.parse(JSON.stringify(profile));
    }

    profile.updatedAt = new Date().toISOString();
    this.profiles.set(userId, profile);
    return JSON.parse(JSON.stringify(profile));
  }

  /**
   * Dismiss/reject a staged inference
   */
  rejectStagedInference(userId: string, inferenceId: string): UserPersonalizationProfile {
    const profile = this.getProfile(userId);
    const inf = (profile.stagedInferences || []).find((i) => i.id === inferenceId);
    if (inf) {
      inf.status = 'REJECTED';
      profile.updatedAt = new Date().toISOString();
      this.profiles.set(userId, profile);
    }
    return JSON.parse(JSON.stringify(profile));
  }

  /**
   * Revert a specific evolution entry from history (one-click undo)
   */
  revertEvolutionEntry(userId: string, entryId: string): UserPersonalizationProfile {
    const profile = this.getProfile(userId);
    const entry = (profile.evolutionHistory || []).find((e) => e.id === entryId);
    if (!entry || !entry.revertible) return profile;

    logger.info('Reverting profile evolution entry', { userId, entryId, field: entry.field });

    if (entry.field === 'shopping.preferredBrands') {
      profile.shopping.preferredBrands = entry.oldValue || [];
      personaManager.updateActivePersonaPreferences(profile, { shopping: profile.shopping });
    } else if (entry.field === 'shopping.excludedBrands') {
      profile.shopping.excludedBrands = entry.oldValue || [];
      personaManager.updateActivePersonaPreferences(profile, { shopping: profile.shopping });
    } else if (entry.field === 'general.rankingPriority') {
      profile.general.rankingPriority = entry.oldValue || 'balanced';
      personaManager.updateActivePersonaPreferences(profile, { general: profile.general });
    } else if (entry.field === 'travel.preferredDepartureTimeWindow') {
      profile.travel.preferredDepartureTimeWindow = entry.oldValue || 'any';
      personaManager.updateActivePersonaPreferences(profile, { travel: profile.travel });
    } else if (entry.field === 'activePersonaId') {
      profile.activePersonaId = entry.oldValue || 'personal';
      personaManager.syncActivePersonaToRoot(profile);
    }

    this.recordEvolution(userId, {
      personaId: profile.activePersonaId,
      changeType: 'REVERTED',
      source: 'EXPLICIT_USER',
      field: entry.field,
      oldValue: entry.newValue,
      newValue: entry.oldValue,
      description: `Reverted change to ${entry.field}`,
      revertible: false,
    }, profile);

    profile.updatedAt = new Date().toISOString();
    this.profiles.set(userId, profile);
    return JSON.parse(JSON.stringify(profile));
  }

  /**
   * Resets profile back to clean initial state
   */
  clearProfile(userId: string = 'default_user'): UserPersonalizationProfile {
    const fresh = this.createDefaultProfile(userId);
    this.profiles.set(userId, fresh);
    logger.info('Cleared personalization profile to defaults', { userId });
    return JSON.parse(JSON.stringify(fresh));
  }

  /**
   * Safe serialization
   */
  serialize(userId: string = 'default_user'): string {
    const profile = this.getProfile(userId);
    return JSON.stringify(profile, null, 2);
  }

  /**
   * Safe restoration from JSON
   */
  restore(userId: string, json: string): UserPersonalizationProfile {
    try {
      const parsed = JSON.parse(json);
      const sanitized = this.sanitize(parsed);
      const restored = {
        ...this.createDefaultProfile(userId),
        ...sanitized,
        userId,
        updatedAt: new Date().toISOString(),
      };
      this.profiles.set(userId, restored);
      return JSON.parse(JSON.stringify(restored));
    } catch (err: any) {
      logger.error('Failed to restore personalization profile from JSON', { error: err?.message });
      return this.getProfile(userId);
    }
  }

  /**
   * Apply an explicit preference command
   */
  applyCommand(userId: string, command: PreferenceUpdateCommand): UserPersonalizationProfile {
    switch (command.action) {
      case 'ADD_PREFERRED_BRAND':
        if (command.brand) return this.addPreferredBrand(userId, command.brand);
        break;
      case 'REMOVE_PREFERRED_BRAND':
        if (command.brand) return this.removePreferredBrand(userId, command.brand);
        break;
      case 'ADD_EXCLUDED_BRAND':
        if (command.brand) return this.addExcludedBrand(userId, command.brand);
        break;
      case 'REMOVE_EXCLUDED_BRAND':
        if (command.brand) return this.removeExcludedBrand(userId, command.brand);
        break;
      case 'SET_RANKING_PRIORITY':
        if (command.priority) return this.setRankingPriority(userId, command.priority);
        break;
      case 'SET_DEPARTURE_WINDOW':
        if (command.departureWindow) return this.setDepartureTimeWindow(userId, command.departureWindow);
        break;
      case 'SWITCH_PERSONA':
        if (command.personaId) return this.switchPersona(userId, command.personaId);
        break;
      case 'SUBMIT_FEEDBACK':
        if (command.feedback) {
          const fullFeedback: RecommendationFeedbackEvent = {
            id: `fb_${Date.now()}`,
            userId,
            recommendationId: command.feedback.recommendationId || 'rec_general',
            rating: command.feedback.rating || 'positive',
            reason: command.feedback.reason,
            targetBrand: command.feedback.targetBrand,
            targetTitle: command.feedback.targetTitle,
            comments: command.feedback.comments,
            timestamp: new Date().toISOString(),
          };
          return this.recordFeedback(userId, fullFeedback);
        }
        break;
      case 'ACCEPT_INFERENCE':
        if (command.inferenceId) return this.acceptStagedInference(userId, command.inferenceId);
        break;
      case 'REJECT_INFERENCE':
        if (command.inferenceId) return this.rejectStagedInference(userId, command.inferenceId);
        break;
      case 'REVERT_EVOLUTION':
        if (command.evolutionEntryId) return this.revertEvolutionEntry(userId, command.evolutionEntryId);
        break;
      case 'SET_BUDGET_RANGE': {
        const profile = this.getProfile(userId);
        if (command.minPrice !== undefined) profile.shopping.minPrice = command.minPrice;
        if (command.maxPrice !== undefined) profile.shopping.maxPrice = command.maxPrice;
        profile.updatedAt = new Date().toISOString();
        this.profiles.set(userId, profile);
        return JSON.parse(JSON.stringify(profile));
      }
      case 'CLEAR_ALL':
        return this.clearProfile(userId);
    }
    return this.getProfile(userId);
  }
}

export const profileStore = new PersonalizationProfileStore();
