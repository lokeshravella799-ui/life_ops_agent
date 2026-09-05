import type { IntentType, AgentPhase, SearchRequirements } from '../types/agent';

export interface User {
  id: string;
  email?: string;
  name?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  id: string;
  userId?: string;
  title: string;
  currentIntent?: IntentType;
  currentPhase: AgentPhase;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  sender: 'user' | 'agent' | 'system';
  content: string;
  intent?: IntentType;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface Workflow {
  id: string;
  conversationId: string;
  intent: IntentType;
  status: 'active' | 'completed' | 'failed' | 'cancelled';
  requirements?: SearchRequirements;
  activePlanId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreference {
  id: string;
  userId: string;
  category: string;
  key: string;
  value: any;
  updatedAt: string;
}

// Stubs for future extensions in later phases:
export interface SearchResultStub {
  id: string;
  workflowId: string;
  provider: string;
  externalId: string;
  payload: any;
}

export interface TransactionStub {
  id: string;
  workflowId: string;
  amount: number;
  currency: string;
  status: 'PENDING_APPROVAL' | 'CONFIRMED' | 'SETTLED' | 'FAILED';
  approvalTimestamp?: string;
}

export interface AuditEventStub {
  id: string;
  eventType: string;
  userId?: string;
  workflowId?: string;
  details: Record<string, any>;
  timestamp: string;
}
