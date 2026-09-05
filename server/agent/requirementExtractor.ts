import type { IntentType, SearchRequirements } from '../types/agent';
import { llmService } from '../llm/llmService';
import { logger } from '../utils/logger';

export class RequirementExtractor {
  async extract(
    text: string,
    intent: IntentType,
    context?: { previousRequirements?: SearchRequirements; previousIntent?: IntentType }
  ): Promise<SearchRequirements> {
    logger.info('Extracting requirements from user message', { intent, text });

    const result = await llmService.extractRequirements(text, intent, context);

    logger.info('Extracted structured requirements', {
      category: result.requirements.category,
      budget: result.requirements.budget,
      source: result.requirements.source,
      destination: result.requirements.destination,
      keywords: result.requirements.keywords,
      isModification: result.isModification,
    });

    return result.requirements;
  }
}

export const requirementExtractor = new RequirementExtractor();
