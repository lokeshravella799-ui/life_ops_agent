import type { IntentType, SearchRequirements, AgentPhase } from '../types/agent';
import type { UserPersonalizationProfile } from '../types/personalization';
import { logger } from '../utils/logger';

export interface ConversationContext {
  conversationId: string;
  userId?: string;
  previousRequest?: string;
  previousIntent?: IntentType;
  previousRequirements?: SearchRequirements;
  previousSearchCriteria?: Record<string, any>;
  previousRecommendations?: any[];
  pendingExecution?: any;
  selectedResult?: any;
  executionReceipt?: any;
  currentWorkflowState?: AgentPhase;
  userProfile?: UserPersonalizationProfile;
  sessionPreferences?: import('../types/personalization').SessionPreferences;
  activeConflicts?: import('../types/personalization').PreferenceConflict[];
  updatedAt: string;
}

export class ConversationContextManager {
  private store: Map<string, ConversationContext> = new Map();

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
        // Drop forbidden financial/auth secrets completely
        continue;
      }
      if (typeof v === 'string') {
        const digitsOnly = v.replace(/[^0-9]/g, '');
        if (digitsOnly.length >= 13 && digitsOnly.length <= 19 && /\b(?:\d[ -]*?){13,19}\b/.test(v)) {
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

  getContext(conversationId: string): ConversationContext {
    let ctx = this.store.get(conversationId);
    if (!ctx) {
      ctx = {
        conversationId,
        updatedAt: new Date().toISOString(),
      };
      this.store.set(conversationId, ctx);
    }
    return ctx;
  }

  updateContext(
    conversationId: string,
    updates: Partial<Omit<ConversationContext, 'conversationId' | 'updatedAt'>>
  ): ConversationContext {
    const existing = this.getContext(conversationId);

    const sanitizedUpdates = this.sanitize(updates);

    const merged: ConversationContext = {
      ...existing,
      ...sanitizedUpdates,
      updatedAt: new Date().toISOString(),
    };

    this.store.set(conversationId, merged);
    logger.debug('Context updated for conversation', { conversationId });
    return merged;
  }

  clearContext(conversationId: string): void {
    this.store.delete(conversationId);
  }
}

export const contextManager = new ConversationContextManager();
