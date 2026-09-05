import type { IntentType, SearchRequirements, Tool } from '../types/agent';
import { toolRegistry } from './toolRegistry';
import { logger } from '../utils/logger';

export class ToolSelector {
  selectTool(intent: IntentType, requirements?: SearchRequirements): Tool | null {
    let toolName: string | null = null;

    switch (intent) {
      case 'PRODUCT_SEARCH':
      case 'SHOPPING_SEARCH':
        toolName = 'search_products';
        break;

      case 'BUS_SEARCH':
        toolName = 'search_buses';
        break;

      case 'HOTEL_SEARCH':
        toolName = 'search_hotels';
        break;

      case 'FLIGHT_SEARCH':
        toolName = 'search_flights';
        break;

      case 'MODIFICATION_REQUEST':
        if (requirements?.category === 'bus') {
          toolName = 'search_buses';
        } else if (requirements?.category === 'electronics' || requirements?.category === 'shopping') {
          toolName = 'search_products';
        } else if (requirements?.category === 'hotel') {
          toolName = 'search_hotels';
        } else {
          toolName = 'search_products';
        }
        break;

      case 'GENERAL_CHAT':
      case 'TRANSACTION_REQUEST':
      case 'CANCELLATION_REQUEST':
      case 'UNKNOWN':
      default:
        toolName = null;
        break;
    }

    if (!toolName) {
      logger.debug('No external search tool required for intent', { intent });
      return null;
    }

    const tool = toolRegistry.getTool(toolName);
    if (!tool) {
      logger.warn(`Selected tool "${toolName}" was not found in ToolRegistry!`);
      return null;
    }

    logger.info('Selected tool for execution', { toolName, intent });
    return tool;
  }
}

export const toolSelector = new ToolSelector();
