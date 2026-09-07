import type {
  RecommendationItem,
  ExecutionPreparation,
  SandboxOrder,
  SandboxBooking,
  SandboxReceipt,
  VerificationSummary,
  ComparisonSummary,
  UserPersonalizationProfile,
  SessionPreferences,
  PreferenceConflict,
  ProactiveRelaxationOption,
  EffectivePreferences,
} from '../types/agent';

export interface AgentMessageResponse {
  conversationId: string;
  agentState: {
    phase: string;
    intent: string;
  };
  message: string;
  requirements?: {
    intent?: string;
    category?: string;
    source?: string;
    destination?: string;
    date?: string;
    budget?: { min?: number; max?: number; currency: string } | null;
    currency?: string;
    quantity?: number;
    keywords?: string[];
  } | null;
  plan?: {
    planId: string;
    intent: string;
    steps: Array<{
      id: string;
      type: string;
      status: 'completed' | 'active' | 'pending' | 'failed';
      description?: string;
    }>;
  } | null;
  selectedTool?: string | null;
  requiresClarification?: boolean;
  clarificationQuestions?: Array<{ field: string; question: string }>;
  safetyNotice?: string;
  normalizedResults?: any[];
  resultCount?: number;
  recommendations?: RecommendationItem[];
  hasMatches?: boolean;
  closeMatches?: any[];
  suggestedRelaxations?: string[];
  comparisonSummary?: ComparisonSummary;
  verificationSummary?: VerificationSummary;
  executionStatus?:
    | 'PREPARING'
    | 'READY_FOR_CONFIRMATION'
    | 'AWAITING_CONFIRMATION'
    | 'CONFIRMED'
    | 'PROCESSING'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'FAILED'
    | 'NOT_EXECUTED';
  confirmationRequired?: boolean;
  executionId?: string;
  executionPreparation?: ExecutionPreparation;
  sandboxExecution?: SandboxOrder | SandboxBooking;
  executionReceipt?: SandboxReceipt;
  sandboxExecutionStatus?: string;
  userProfile?: UserPersonalizationProfile;
  activePersonaId?: string;
  activeSessionPreferences?: SessionPreferences;
  effectivePreferences?: EffectivePreferences;
  preferenceConflicts?: PreferenceConflict[];
  relaxationOptions?: ProactiveRelaxationOption[];
  stagedInferences?: import('../types/agent').StagedInference[];
  feedbackResult?: { success: boolean; message: string };
  contextualRecommendations?: string[];
  error?: string;
}

const BACKEND_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/+$/, '');

async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  try {
    const res = await fetch(input, init);
    if (res.status >= 502 && res.status <= 504) {
      const fallbackUrl = input.startsWith('/api') ? `${BACKEND_BASE}${input}` : input;
      return await fetch(fallbackUrl, init);
    }
    return res;
  } catch (netErr) {
    if (input.startsWith('/api')) {
      try {
        const fallbackUrl = `${BACKEND_BASE}${input}`;
        return await fetch(fallbackUrl, init);
      } catch {
        throw new Error('Unable to connect to LifeOps backend. Please ensure the backend server is running on port 3001.');
      }
    }
    throw netErr;
  }
}

export async function fetchConversations(
  userId: string = 'default_user'
): Promise<import('../types/agent').ConversationRecord[]> {
  const res = await apiFetch(`/api/agent/conversations?userId=${encodeURIComponent(userId)}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch conversations (${res.status})`);
  }
  const data = await res.json();
  return data.conversations || [];
}

export async function fetchConversationById(
  id: string
): Promise<import('../types/agent').ConversationRecord> {
  const res = await apiFetch(`/api/agent/conversations/${encodeURIComponent(id)}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch conversation (${res.status})`);
  }
  const data = await res.json();
  return data.conversation;
}

export async function createConversation(
  userId: string = 'default_user',
  title?: string
): Promise<import('../types/agent').ConversationRecord> {
  const res = await apiFetch('/api/agent/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, title }),
  });
  if (!res.ok) {
    throw new Error(`Failed to create conversation (${res.status})`);
  }
  const data = await res.json();
  return data.conversation;
}

export async function deleteConversation(
  id: string
): Promise<void> {
  const res = await apiFetch(`/api/agent/conversations/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error(`Failed to delete conversation (${res.status})`);
  }
}

export interface CreateOrderResponse {
  success: boolean;
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  demoMode: boolean;
  bookingDetails?: any;
}

export async function createPaymentOrder(payload: {
  amount: number;
  currency?: string;
  bookingDetails?: any;
  conversationId?: string;
}): Promise<CreateOrderResponse> {
  const res = await apiFetch('/api/payment/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let errorMsg = `Payment order failed (${res.status})`;
    try {
      const err = await res.json();
      if (err.error) errorMsg = err.error;
    } catch {}
    throw new Error(errorMsg);
  }
  return res.json();
}

export interface VerifySignatureResponse {
  success: boolean;
  bookingId: string;
  status: string;
  paymentId: string;
  orderId: string;
  message: string;
  receipt?: any;
}

export async function verifyPaymentSignature(payload: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  bookingDetails?: any;
  conversationId?: string;
}): Promise<VerifySignatureResponse> {
  const res = await apiFetch('/api/payment/verify-signature', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let errorMsg = `Signature verification failed (${res.status})`;
    try {
      const err = await res.json();
      if (err.error) errorMsg = err.error;
    } catch {}
    throw new Error(errorMsg);
  }
  return res.json();
}


export async function sendAgentMessage(
  message: string,
  conversationId?: string,
  userId?: string,
  location?: { latitude?: number; longitude?: number; city?: string }
): Promise<AgentMessageResponse> {
  const response = await apiFetch('/api/agent/message', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      conversationId,
      userId,
      location,
    }),
  });

  if (!response.ok) {
    let errorMsg = `Agent API error (${response.status})`;
    try {
      const errJson = await response.json();
      if (errJson && typeof errJson.error === 'string') {
        errorMsg = errJson.error;
      }
    } catch {
      try {
        const errText = await response.text();
        if (errText && !errText.includes('<!DOCTYPE') && !errText.includes('<html')) {
          errorMsg = errText;
        } else if (response.status === 504 || response.status === 502) {
          errorMsg = 'Backend server on port 3001 is unreachable. Please ensure the server is running.';
        }
      } catch {
        // Fallback to status errorMsg
      }
    }
    throw new Error(errorMsg);
  }

  return response.json();
}

export async function fetchUserProfile(
  userId: string = 'default_user'
): Promise<import('../types/agent').UserPersonalizationProfile> {
  const res = await apiFetch(`/api/agent/profile?userId=${encodeURIComponent(userId)}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch user profile (${res.status})`);
  }
  const data = await res.json();
  return data.profile;
}

export async function updateUserProfile(payload: {
  userId?: string;
  action?: string;
  brand?: string;
  priority?: string;
  departureWindow?: string;
  personaId?: string;
  inferenceId?: string;
  evolutionEntryId?: string;
  profile?: Partial<import('../types/agent').UserPersonalizationProfile>;
}): Promise<import('../types/agent').UserPersonalizationProfile> {
  const res = await apiFetch('/api/agent/profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Failed to update profile (${res.status})`);
  }
  const data = await res.json();
  return data.profile;
}

export async function clearUserProfile(
  userId: string = 'default_user'
): Promise<import('../types/agent').UserPersonalizationProfile> {
  const res = await apiFetch(`/api/agent/profile?userId=${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error(`Failed to clear profile (${res.status})`);
  }
  const data = await res.json();
  return data.profile;
}

export async function submitFeedback(payload: {
  userId?: string;
  recommendationId: string;
  rating: 'positive' | 'negative';
  reason?: import('../types/agent').RecommendationFeedbackReason;
  targetBrand?: string;
  targetTitle?: string;
  comments?: string;
}): Promise<{ success: boolean; message: string; profile: import('../types/agent').UserPersonalizationProfile }> {
  const res = await apiFetch('/api/agent/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Failed to submit feedback (${res.status})`);
  }
  return res.json();
}

export async function switchPersona(
  personaId: 'personal' | 'work',
  userId: string = 'default_user'
): Promise<{ success: boolean; message: string; profile: import('../types/agent').UserPersonalizationProfile }> {
  const res = await apiFetch('/api/agent/persona/switch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ personaId, userId }),
  });
  if (!res.ok) {
    throw new Error(`Failed to switch persona (${res.status})`);
  }
  return res.json();
}

export async function acceptStagedInference(
  inferenceId: string,
  userId: string = 'default_user'
): Promise<{ success: boolean; message: string; profile: import('../types/agent').UserPersonalizationProfile }> {
  const res = await apiFetch(`/api/agent/inferences/${encodeURIComponent(inferenceId)}/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) {
    throw new Error(`Failed to accept staged inference (${res.status})`);
  }
  return res.json();
}

export async function rejectStagedInference(
  inferenceId: string,
  userId: string = 'default_user'
): Promise<{ success: boolean; message: string; profile: import('../types/agent').UserPersonalizationProfile }> {
  const res = await apiFetch(`/api/agent/inferences/${encodeURIComponent(inferenceId)}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) {
    throw new Error(`Failed to reject staged inference (${res.status})`);
  }
  return res.json();
}

export async function revertProfileEvolution(
  entryId: string,
  userId: string = 'default_user'
): Promise<{ success: boolean; message: string; profile: import('../types/agent').UserPersonalizationProfile }> {
  const res = await apiFetch(`/api/agent/evolution/${encodeURIComponent(entryId)}/revert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) {
    throw new Error(`Failed to revert profile evolution (${res.status})`);
  }
  return res.json();
}

