import type { UserPersonalizationProfile } from './personalization';

export type IntentType =
  | 'GENERAL_CHAT'
  | 'PRODUCT_SEARCH'
  | 'BUS_SEARCH'
  | 'HOTEL_SEARCH'
  | 'FLIGHT_SEARCH'
  | 'SHOPPING_SEARCH'
  | 'TRANSACTION_REQUEST'
  | 'MODIFICATION_REQUEST'
  | 'CANCELLATION_REQUEST'
  | 'PREFERENCE_UPDATE'
  | 'FEEDBACK_SUBMISSION'
  | 'PERSONA_SWITCH'
  | 'UNKNOWN';

export type AgentPhase =
  | 'IDLE'
  | 'UNDERSTANDING'
  | 'REQUIREMENTS_EXTRACTED'
  | 'PLANNING'
  | 'TOOL_SELECTION'
  | 'SEARCHING'
  | 'RESULTS_FOUND'
  | 'VERIFYING'
  | 'VERIFIED'
  | 'VERIFICATION_FAILED'
  | 'USER_REVIEW'
  | 'SELECTION'
  | 'PREPARATION'
  | 'WAITING_FOR_CONFIRMATION'
  | 'AWAITING_CONFIRMATION'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'SUCCESS'
  | 'CANCELLED'
  | 'ERROR';

export interface UserRequest {
  requestId: string;
  conversationId: string;
  userId?: string;
  rawText: string;
  intent: IntentType;
  confidence: number;
  timestamp: string;
}

export interface BudgetConstraint {
  min?: number;
  max?: number;
  currency: string;
}

export interface SearchRequirements {
  intent?: IntentType;
  category?: string;
  source?: string;
  destination?: string;
  date?: string;
  returnDate?: string;
  departureAfter?: string;
  departureBefore?: string;
  budget?: BudgetConstraint | null;
  currency?: string;
  quantity?: number;
  brand?: string;
  preferences?: Record<string, any>;
  constraints?: Record<string, any>;
  sortPreference?: string;
  keywords?: string[];
  profile?: UserPersonalizationProfile;
  effectivePreferences?: import('./personalization').EffectivePreferences;
  sessionPreferences?: import('./personalization').SessionPreferences;
}

export interface PlanStep {
  id: string;
  type: string;
  status: 'completed' | 'active' | 'pending' | 'failed';
  description?: string;
}

export interface AgentPlan {
  planId: string;
  intent: IntentType;
  steps: PlanStep[];
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

export interface Tool {
  name: string;
  description: string;
  category: string;
  execute(input: any): Promise<ToolResult>;
}

export interface ClarificationQuestion {
  field: string;
  question: string;
}

export interface ClarificationResponse {
  requiresClarification: boolean;
  questions: ClarificationQuestion[];
}

export interface AgentState {
  sessionId: string;
  phase: AgentPhase;
  intent: IntentType | null;
  requirements: SearchRequirements | null;
  plan: AgentPlan | null;
  selectedTool: string | null;
  results: any[];
  selectedResult: any | null;
  awaitingUserConfirmation: boolean;
  error: string | null;
}

export interface AgentResponsePayload {
  conversationId: string;
  agentState: {
    phase: AgentPhase;
    intent: IntentType;
  };
  message: string;
  requirements?: SearchRequirements | null;
  plan?: AgentPlan | null;
  selectedTool?: string | null;
  requiresClarification?: boolean;
  clarificationQuestions?: ClarificationQuestion[];
  safetyNotice?: string;
  normalizedResults?: any[];
  resultCount?: number;
  recommendations?: any[];
  hasMatches?: boolean;
  closeMatches?: any[];
  suggestedRelaxations?: string[];
  contextualRecommendations?: string[];
  comparisonSummary?: any;
  verificationSummary?: {
    verifiedCount: number;
    unverifiedCount: number;
    changedCount: number;
    unavailableCount: number;
  };
  executionStatus?: 'PREPARING' | 'READY_FOR_CONFIRMATION' | 'AWAITING_CONFIRMATION' | 'CONFIRMED' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED' | 'FAILED' | 'NOT_EXECUTED';
  confirmationRequired?: boolean;
  executionId?: string;
  executionPreparation?: any;
  sandboxExecution?: any;
  executionReceipt?: any;
  sandboxExecutionStatus?: string;
  userProfile?: UserPersonalizationProfile;
  preferenceConflicts?: import('./personalization').PreferenceConflict[];
  activeSessionPreferences?: import('./personalization').SessionPreferences;
  relaxationOptions?: import('./personalization').ProactiveRelaxationOption[];
  effectivePreferences?: import('./personalization').EffectivePreferences;
  activePersonaId?: string;
  stagedInferences?: import('./personalization').StagedInference[];
  feedbackResult?: { success: boolean; message: string };
}

