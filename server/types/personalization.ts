/**
 * Phase 3: Personalization Profile Data Models
 * 
 * Step 1: Baseline Profiles & Weights
 * Step 2: Multi-Turn Memory & Preference Conflict Resolution
 * Step 3: Adaptive Preference Learning, Explicit Feedback Loops & Explainable Profile Evolution
 * 
 * Strictly decoupled from financial credentials and payment systems.
 */

export type RankingPriority =
  | 'lowest_price'
  | 'highest_quality'
  | 'best_overall'
  | 'fastest'
  | 'balanced';

export type DepartureTimeWindow =
  | 'morning'    // 06:00 - 12:00
  | 'afternoon'  // 12:00 - 17:00
  | 'evening'    // 17:00 - 21:00
  | 'night'      // 21:00 - 06:00
  | 'any';

export interface PriorityWeights {
  price?: number;       // 0 to 1
  quality?: number;     // 0 to 1
  performance?: number; // 0 to 1
  brand?: number;       // 0 to 1
}

export interface ShoppingPreferences {
  preferredBrands: string[];
  excludedBrands: string[];
  preferredCategories: string[];
  minPrice?: number;
  maxPrice?: number;
  priorityWeights?: PriorityWeights;
}

export interface TravelPreferences {
  preferredDepartureTimeWindow?: DepartureTimeWindow;
  preferredArrivalWindow?: string;
  preferredTransportTypes: ('bus' | 'flight' | 'train')[];
  preferredAirlines: string[];
  excludedAirlines: string[];
  preferredOperators: string[];
  excludedOperators: string[];
  preferredHotelAmenities?: string[];
}

export interface GeneralPreferences {
  rankingPriority: RankingPriority;
  preferredProviders: string[];
}

export type PersonaId = 'personal' | 'work' | string;

export interface PersonaProfileData {
  personaId: PersonaId;
  name: string;
  description?: string;
  shopping: ShoppingPreferences;
  travel: TravelPreferences;
  general: GeneralPreferences;
  createdAt: string;
  updatedAt: string;
}

export type RecommendationFeedbackRating = 'positive' | 'negative';

export type RecommendationFeedbackReason =
  | 'PRICE_TOO_HIGH'
  | 'PRICE_ATTRACTIVE'
  | 'DISLIKED_BRAND'
  | 'PREFERRED_BRAND'
  | 'POOR_SPECS'
  | 'IDEAL_SPECS'
  | 'INCONVENIENT_SCHEDULE'
  | 'PREFERRED_SCHEDULE'
  | 'OTHER';

export interface RecommendationFeedbackEvent {
  id: string;
  userId: string;
  conversationId?: string;
  recommendationId: string;
  targetTitle?: string;
  targetBrand?: string;
  targetProvider?: string;
  targetCategory?: string;
  rating: RecommendationFeedbackRating;
  reason?: RecommendationFeedbackReason;
  comments?: string;
  timestamp: string;
}

export interface StagedInference {
  id: string;
  field: 'preferredBrand' | 'excludedBrand' | 'rankingPriority' | 'departureWindow' | 'priceBand' | string;
  inferredValue: any;
  confidenceScore: number; // 0.0 to 1.0 (>= 0.80 triggers proposal)
  confidence?: number;
  observationCount?: number;
  proposalText?: string;
  reason?: string;
  status: 'STAGED' | 'ACCEPTED' | 'DISMISSED' | 'REJECTED';
  detectedAt?: string;
}

export interface ProfileEvolutionEntry {
  id: string;
  timestamp: string;
  personaId: string;
  changeType:
    | 'PREFERENCE_ADDED'
    | 'PREFERENCE_REMOVED'
    | 'PRIORITY_CHANGED'
    | 'INFERENCE_CONFIRMED'
    | 'FEEDBACK_APPLIED'
    | 'PERSONA_SWITCHED'
    | 'REVERTED';
  source: 'EXPLICIT_USER' | 'INFERRED_CONFIRMED' | 'FEEDBACK_DRIVEN' | 'MANUAL_MODAL' | 'ACCEPTED_INFERENCE';
  field: string;
  oldValue: any;
  newValue: any;
  description: string;
  revertible: boolean;
}

export interface UserPersonalizationProfile {
  userId: string;
  activePersonaId: PersonaId;
  personas: Record<string, PersonaProfileData>;
  shopping: ShoppingPreferences; // Shortcut mirror of active persona for backward compatibility
  travel: TravelPreferences;     // Shortcut mirror of active persona for backward compatibility
  general: GeneralPreferences;   // Shortcut mirror of active persona for backward compatibility
  stagedInferences: StagedInference[];
  feedbackHistory: RecommendationFeedbackEvent[];
  evolutionHistory: ProfileEvolutionEntry[];
  selectionHistory?: { brand?: string; title?: string; operator?: string; departureTime?: string; price?: any; selectedAt: string }[];
  createdAt: string;
  updatedAt: string;
}

export type PreferenceScope = 'global' | 'session';

export interface PreferenceUpdateCommand {
  action:
    | 'ADD_PREFERRED_BRAND'
    | 'REMOVE_PREFERRED_BRAND'
    | 'ADD_EXCLUDED_BRAND'
    | 'REMOVE_EXCLUDED_BRAND'
    | 'SET_RANKING_PRIORITY'
    | 'SET_DEPARTURE_WINDOW'
    | 'SET_BUDGET_RANGE'
    | 'IGNORE_SAVED_PREFERENCES'
    | 'RESTORE_SAVED_PREFERENCES'
    | 'RESOLVE_CONFLICT'
    | 'SWITCH_PERSONA'
    | 'SUBMIT_FEEDBACK'
    | 'ACCEPT_INFERENCE'
    | 'REJECT_INFERENCE'
    | 'REVERT_EVOLUTION'
    | 'CLEAR_ALL';
  brand?: string;
  priority?: RankingPriority;
  departureWindow?: DepartureTimeWindow;
  minPrice?: number;
  maxPrice?: number;
  category?: string;
  scope?: PreferenceScope;
  rawText?: string;
  personaId?: PersonaId;
  inferenceId?: string;
  evolutionEntryId?: string;
  feedback?: Partial<RecommendationFeedbackEvent>;
  conflictResolution?: {
    conflictId?: string;
    choice: 'USE_CURRENT_REQUIREMENT' | 'KEEP_SAVED_PREFERENCE' | 'APPLY_BOTH';
  };
}

export interface SessionPreferences {
  conversationId: string;
  ignoreSavedPreferences?: boolean;
  activePersonaId?: PersonaId;
  preferredBrands?: string[];
  excludedBrands?: string[];
  rankingPriority?: RankingPriority;
  preferredDepartureTimeWindow?: DepartureTimeWindow;
  minPrice?: number;
  maxPrice?: number;
  appliedOverrides?: string[];
  activeNotes?: string[];
  updatedAt: string;
}

export interface ConflictOption {
  id: string;
  label: string;
  description: string;
  resolutionAction: 'USE_CURRENT_REQUIREMENT' | 'KEEP_SAVED_PREFERENCE' | 'APPLY_BOTH';
  scope: PreferenceScope;
  value: any;
}

export interface PreferenceConflict {
  id: string;
  field: 'brand' | 'price' | 'ranking_priority' | 'departure_window';
  existingValue: any;
  newValue: any;
  sourceTurn?: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolutionRequired: boolean;
  description: string;
  suggestedClarification: string;
  options: ConflictOption[];
}

export interface ProactiveRelaxationOption {
  id: string;
  label: string;
  type: 'INCREASE_BUDGET' | 'ALLOW_OTHER_BRANDS' | 'REMOVE_BRAND_EXCLUSION' | 'EXPAND_TIME_WINDOW' | 'RELAX_SPEC';
  description: string;
  adjustment: {
    field: string;
    oldValue?: any;
    newValue?: any;
  };
}

export interface EffectivePreferences {
  userId: string;
  conversationId?: string;
  activePersonaId?: PersonaId;
  shopping: ShoppingPreferences;
  travel: TravelPreferences;
  general: GeneralPreferences;
  appliedOverrides: string[];
  ignoredSavedPreferences: boolean;
  activeSessionOverrides: boolean;
  feedbackBoosts?: Record<string, number>; // brand/provider/category -> score delta
}
