import type { IntentType, SearchRequirements, ClarificationResponse, ClarificationQuestion } from '../types/agent';
import { logger } from '../utils/logger';

export class ClarificationSystem {
  checkClarification(
    intent: IntentType,
    reqs: SearchRequirements,
    userLocation?: { city?: string; formattedAddress?: string }
  ): ClarificationResponse {
    const questions: ClarificationQuestion[] = [];

    if (intent === 'BUS_SEARCH') {
      // Required parameters: source and destination
      if (!reqs.source && !reqs.destination) {
        questions.push({
          field: 'route',
          question: 'I can help with that! What city are you traveling from, and where are you going?',
        });
      } else if (!reqs.source && !userLocation?.city && !userLocation?.formattedAddress) {
        questions.push({
          field: 'source',
          question: 'Which city will you be departing from?',
        });
      } else if (!reqs.destination) {
        questions.push({
          field: 'destination',
          question: 'Where are you traveling to?',
        });
      }
    } else if (intent === 'HOTEL_SEARCH') {
      if (!reqs.destination) {
        questions.push({
          field: 'destination',
          question: 'Which city or locality would you like to stay in?',
        });
      }
    } else if (intent === 'FLIGHT_SEARCH') {
      if (!reqs.source || !reqs.destination) {
        questions.push({
          field: 'flight_route',
          question: 'Where will you be flying from, and what is your destination?',
        });
      }
    }

    const requiresClarification = questions.length > 0;

    if (requiresClarification) {
      logger.info('Clarification needed for missing parameters', { intent, questionsCount: questions.length });
    }

    return {
      requiresClarification,
      questions,
    };
  }
}

export const clarificationSystem = new ClarificationSystem();
