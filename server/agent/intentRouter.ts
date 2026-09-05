import type { IntentType, UserRequest } from '../types/agent';
import { llmService, LLMIntentResult } from '../llm/llmService';
import { logger } from '../utils/logger';

export class IntentRouter {
  async route(
    rawText: string,
    conversationId: string,
    context?: { previousIntent?: IntentType; userId?: string; pendingExecution?: any; previousRecommendations?: any[] }
  ): Promise<UserRequest> {
    logger.info('Routing user request intent', { text: rawText, conversationId });

    const result: LLMIntentResult = await llmService.classifyIntent(rawText, context);

    const userRequest: UserRequest = {
      requestId: `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      conversationId,
      userId: context?.userId,
      rawText,
      intent: result.intent,
      confidence: result.confidence,
      timestamp: new Date().toISOString(),
    };

    logger.info('Intent detected', {
      intent: userRequest.intent,
      confidence: userRequest.confidence,
      reasoning: result.reasoning,
    });

    return userRequest;
  }
}

export const intentRouter = new IntentRouter();
