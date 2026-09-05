import type { Tool, ToolResult } from '../types/agent';
import { productSearchService } from '../services/productSearchService';
import { busSearchService } from '../services/busSearchService';
import { verificationService } from '../verification';
import { ExecutionPreparer, confirmationGate, sandboxExecutor } from '../execution';
import { logger } from '../utils/logger';


export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  constructor() {
    this.registerDefaultTools();
  }

  registerTool(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      logger.warn(`Tool with name "${tool.name}" is already registered. Overwriting.`);
    }
    this.tools.set(tool.name, tool);
    logger.debug(`Registered tool: ${tool.name} (${tool.category})`);
  }

  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  listTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  listToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  private registerDefaultTools(): void {
    // 1. Generic Product Search Tool (Connected to ProductSearchService)
    this.registerTool({
      name: 'search_products',
      description: 'Searches consumer products and hardware across multi-provider adapters without provider lock-in.',
      category: 'shopping',
      execute: async (input: any): Promise<ToolResult> => {
        try {
          const res = await productSearchService.search(input || {});
          return {
            success: true,
            data: res,
          };
        } catch (err: any) {
          return {
            success: false,
            error: err?.message || 'Product search service failure',
          };
        }
      },
    });

    // 2. Generic Product Details Tool
    this.registerTool({
      name: 'get_product_details',
      description: 'Fetches detailed specifications and verified seller listings for a product.',
      category: 'shopping',
      execute: async (input: any): Promise<ToolResult> => {
        return {
          success: true,
          data: { status: 'placeholder', message: 'Generic get_product_details interface ready.', input },
        };
      },
    });

    // 3. Generic Bus Search Tool (Connected to BusSearchService)
    this.registerTool({
      name: 'search_buses',
      description: 'Searches scheduled bus routes, sleeper buses, and operators across transport adapters.',
      category: 'transportation',
      execute: async (input: any): Promise<ToolResult> => {
        try {
          const res = await busSearchService.search(input || {});
          return {
            success: true,
            data: res,
          };
        } catch (err: any) {
          return {
            success: false,
            error: err?.message || 'Bus search service failure',
          };
        }
      },
    });

    // 4. Generic Bus Details Tool
    this.registerTool({
      name: 'get_bus_details',
      description: 'Retrieves seat layout, boarding points, and cancellation policies for a bus service.',
      category: 'transportation',
      execute: async (input: any): Promise<ToolResult> => {
        return {
          success: true,
          data: { status: 'placeholder', message: 'Generic get_bus_details interface ready.', input },
        };
      },
    });

    // 5. Generic Hotel Search Tool
    this.registerTool({
      name: 'search_hotels',
      description: 'Searches accommodations, rooms, and hotel tariffs across hospitality adapters.',
      category: 'hospitality',
      execute: async (input: any): Promise<ToolResult> => {
        return {
          success: true,
          data: { status: 'placeholder', message: 'Generic search_hotels interface ready.', input },
        };
      },
    });

    // 6. Generic Hotel Details Tool
    this.registerTool({
      name: 'get_hotel_details',
      description: 'Retrieves room amenities, photos, and policies for a hotel.',
      category: 'hospitality',
      execute: async (input: any): Promise<ToolResult> => {
        return {
          success: true,
          data: { status: 'placeholder', message: 'Generic get_hotel_details interface ready.', input },
        };
      },
    });

    // 7. Generic Flight Search Tool
    this.registerTool({
      name: 'search_flights',
      description: 'Searches airline itineraries, fares, and connections.',
      category: 'aviation',
      execute: async (input: any): Promise<ToolResult> => {
        return {
          success: true,
          data: { status: 'placeholder', message: 'Generic search_flights interface ready.', input },
        };
      },
    });

    // 8. Generic Flight Details Tool
    this.registerTool({
      name: 'get_flight_details',
      description: 'Retrieves flight baggage rules, seat maps, and fare conditions.',
      category: 'aviation',
      execute: async (input: any): Promise<ToolResult> => {
        return {
          success: true,
          data: { status: 'placeholder', message: 'Generic get_flight_details interface ready.', input },
        };
      },
    });

    // 9. Generic Web Search Tool
    this.registerTool({
      name: 'web_search',
      description: 'Performs generic informational web search for non-transactional inquiries.',
      category: 'general',
      execute: async (input: any): Promise<ToolResult> => {
        return {
          success: true,
          data: { status: 'placeholder', message: 'Generic web_search interface ready.', input },
        };
      },
    });

    // 10. Generic Product Verification Tool
    this.registerTool({
      name: 'verify_product',
      description: 'Verifies product pricing, stock availability, and seller authenticity directly against verifiable provider adapters.',
      category: 'verification',
      execute: async (input: any): Promise<ToolResult> => {
        try {
          const res = await verificationService.verifyProduct(input);
          return {
            success: true,
            data: res,
          };
        } catch (err: any) {
          return {
            success: false,
            error: err?.message || 'Product verification service failure',
          };
        }
      },
    });

    // 11. Generic Bus Transit Verification Tool
    this.registerTool({
      name: 'verify_bus',
      description: 'Verifies bus seat availability, fare validity, route, and departure times against transit adapters.',
      category: 'verification',
      execute: async (input: any): Promise<ToolResult> => {
        try {
          const res = await verificationService.verifyBus(input);
          return {
            success: true,
            data: res,
          };
        } catch (err: any) {
          return {
            success: false,
            error: err?.message || 'Bus verification service failure',
          };
        }
      },
    });

    // 12. Generic Hotel Verification Tool
    this.registerTool({
      name: 'verify_hotel',
      description: 'Verifies hotel room availability, tariff, and cancellation policies against hospitality adapters.',
      category: 'verification',
      execute: async (input: any): Promise<ToolResult> => {
        try {
          const res = await verificationService.verifyHotel(input);
          return {
            success: true,
            data: res,
          };
        } catch (err: any) {
          return {
            success: false,
            error: err?.message || 'Hotel verification service failure',
          };
        }
      },
    });

    // 13. Generic Flight Verification Tool
    this.registerTool({
      name: 'verify_flight',
      description: 'Verifies flight fare, seat availability, and itinerary against aviation adapters.',
      category: 'verification',
      execute: async (input: any): Promise<ToolResult> => {
        try {
          const res = await verificationService.verifyFlight(input);
          return {
            success: true,
            data: res,
          };
        } catch (err: any) {
          return {
            success: false,
            error: err?.message || 'Flight verification service failure',
          };
        }
      },
    });

    // 14. Generic Execution Preparation Tool (Zero Financial Action)
    this.registerTool({
      name: 'prepare_execution',
      description: 'Prepares an itemized transaction or booking for explicit user confirmation without executing payment.',
      category: 'execution',
      execute: async (input: any): Promise<ToolResult> => {
        try {
          if (!input || !input.item) {
            return {
              success: false,
              error: 'Missing required item for execution preparation.',
            };
          }
          const item = input.item;
          let prepRes;
          if (input.type === 'BUS_BOOKING' || (item.operator && item.departureTime)) {
            prepRes = ExecutionPreparer.prepareBusBooking(item, input.contact, input.passengers, input.options);
          } else if (input.type === 'HOTEL_BOOKING' || (item.roomType || item.amenities)) {
            prepRes = ExecutionPreparer.prepareHotelBooking(item, input.contact, input.guests, input.options);
          } else if (input.type === 'FLIGHT_BOOKING' || (item.airline || item.flightNumber)) {
            prepRes = ExecutionPreparer.prepareFlightBooking(item, input.contact, input.passengers, input.options);
          } else {
            prepRes = ExecutionPreparer.prepareProductOrder(item, input.contact, input.delivery, input.options);
          }

          if (prepRes.success && prepRes.preparation) {
            confirmationGate.registerPreparation(prepRes.preparation);
            return {
              success: true,
              data: prepRes.preparation,
            };
          } else {
            return {
              success: false,
              error: prepRes.error || 'Failed to prepare execution.',
            };
          }
        } catch (err: any) {
          return {
            success: false,
            error: err?.message || 'Execution preparation failure',
          };
        }
      },
    });

    // 15. Generic Sandbox Execution Tool (Zero Live Transactions)
    this.registerTool({
      name: 'execute_sandbox',
      description: 'Executes a simulated product order or booking in sandbox mode after explicit user confirmation without live payments or merchant orders.',
      category: 'execution',
      execute: async (input: any): Promise<ToolResult> => {
        try {
          if (!input || !input.executionId) {
            return {
              success: false,
              error: 'Missing required executionId for sandbox execution.',
            };
          }
          const res = await sandboxExecutor.execute(input.executionId, input.options);
          return {
            success: res.success,
            data: res,
            error: res.error,
          };
        } catch (err: any) {
          return {
            success: false,
            error: err?.message || 'Sandbox execution failure',
          };
        }
      },
    });
  }
}

export const toolRegistry = new ToolRegistry();



