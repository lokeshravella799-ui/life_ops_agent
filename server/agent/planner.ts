import type { IntentType, SearchRequirements, AgentPlan, PlanStep } from '../types/agent';
import { logger } from '../utils/logger';

export class Planner {
  createPlan(intent: IntentType, requirements: SearchRequirements): AgentPlan {
    const planId = `plan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    let steps: PlanStep[] = [];

    switch (intent) {
      case 'PRODUCT_SEARCH':
      case 'SHOPPING_SEARCH':
        steps = [
          { id: 'step_1', type: 'extract_requirements', status: 'completed', description: 'Parse budget, constraints & workload' },
          { id: 'step_2', type: 'search_products', status: 'pending', description: 'Query generic shopping provider tools' },
          { id: 'step_3', type: 'normalize_results', status: 'pending', description: 'Normalize catalog formats and prices' },
          { id: 'step_4', type: 'compare_results', status: 'pending', description: 'Run multi-criteria benchmark evaluation' },
          { id: 'step_5', type: 'recommend', status: 'pending', description: 'Formulate top options and rationale' },
        ];
        break;

      case 'BUS_SEARCH':
        steps = [
          { id: 'step_1', type: 'extract_requirements', status: 'completed', description: 'Parse route, departure window & preferences' },
          { id: 'step_2', type: 'search_buses', status: 'pending', description: 'Query bus travel provider adapters' },
          { id: 'step_3', type: 'normalize_results', status: 'pending', description: 'Format departure schedules and seat availability' },
          { id: 'step_4', type: 'compare_results', status: 'pending', description: 'Sort by price, rating & duration' },
          { id: 'step_5', type: 'recommend', status: 'pending', description: 'Present optimal travel options' },
        ];
        break;

      case 'HOTEL_SEARCH':
        steps = [
          { id: 'step_1', type: 'extract_requirements', status: 'completed', description: 'Extract locality, guest count & dates' },
          { id: 'step_2', type: 'search_hotels', status: 'pending', description: 'Query hospitality provider adapters' },
          { id: 'step_3', type: 'normalize_results', status: 'pending', description: 'Normalize room tariffs and amenities' },
          { id: 'step_4', type: 'compare_results', status: 'pending', description: 'Filter reviews and ratings' },
          { id: 'step_5', type: 'recommend', status: 'pending', description: 'Present verified hotel recommendations' },
        ];
        break;

      case 'FLIGHT_SEARCH':
        steps = [
          { id: 'step_1', type: 'extract_requirements', status: 'completed', description: 'Extract airport codes and dates' },
          { id: 'step_2', type: 'search_flights', status: 'pending', description: 'Query flight schedule tools' },
          { id: 'step_3', type: 'normalize_results', status: 'pending', description: 'Normalize airfares and layovers' },
          { id: 'step_4', type: 'compare_results', status: 'pending', description: 'Compare direct vs connecting options' },
          { id: 'step_5', type: 'recommend', status: 'pending', description: 'Present flights for selection' },
        ];
        break;

      case 'TRANSACTION_REQUEST':
        steps = [
          { id: 'step_1', type: 'resolve_selected_item', status: 'completed', description: 'Identify target item from active context' },
          { id: 'step_2', type: 'prepare_explicit_safety_summary', status: 'pending', description: 'Compile itemized pricing and terms' },
          { id: 'step_3', type: 'request_user_explicit_approval', status: 'pending', description: 'Gate action behind explicit consent' },
        ];
        break;

      case 'MODIFICATION_REQUEST':
        steps = [
          { id: 'step_1', type: 'merge_context_requirements', status: 'completed', description: 'Update modified constraints' },
          { id: 'step_2', type: 're_execute_search', status: 'pending', description: 'Search with updated parameters' },
          { id: 'step_3', type: 'compare_and_recommend', status: 'pending', description: 'Present revised options' },
        ];
        break;

      case 'GENERAL_CHAT':
      default:
        steps = [
          { id: 'step_1', type: 'process_dialogue', status: 'completed', description: 'Formulate natural conversational response' },
        ];
        break;
    }

    const plan: AgentPlan = {
      planId,
      intent,
      steps,
    };

    logger.info('Created execution plan', { planId, intent, stepCount: steps.length });
    return plan;
  }
}

export const planner = new Planner();
