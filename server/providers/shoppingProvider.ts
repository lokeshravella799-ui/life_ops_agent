import type {
  IProductProviderAdapter,
  RawProductResult,
  ProviderSearchResponse,
} from '../types/provider';
import type { SearchRequirements } from '../types/agent';

/**
 * Universal Interface for Autonomous Shopping Research Providers.
 * Supports web-scraping agents today and drop-in official APIs tomorrow without orchestrator changes.
 */
export interface ShoppingProvider extends IProductProviderAdapter {
  readonly providerId: string;
  readonly providerName: string;
  readonly sourceName: 'Amazon India' | 'Flipkart' | string;
  readonly baseUrl: string;

  /**
   * Search real commerce platforms using natural query and structured constraints
   */
  searchProducts(
    requirements: SearchRequirements,
    options?: { maxResults?: number; timeoutMs?: number }
  ): Promise<ProviderSearchResponse<RawProductResult>>;
}
