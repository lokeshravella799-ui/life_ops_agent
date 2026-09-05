import type { SearchRequirements } from '../types/agent';
import type { NormalizedProduct, IProductProviderAdapter, RawProductResult } from '../types/provider';
import type { RecommendationResult, ComparisonSummary } from '../comparison/types';
import { RecommendationEngine } from '../comparison/recommendationEngine';
import { providerRegistry } from '../providers/providerRegistry';
import { ProductNormalizer } from '../normalizers/productNormalizer';
import { logger } from '../utils/logger';

export interface MultiProviderSearchResult<T> {
  results: T[];
  totalFound: number;
  providerStats: Array<{
    providerId: string;
    providerName: string;
    success: boolean;
    resultCount: number;
    error?: string;
  }>;
  recommendations?: RecommendationResult<T>[];
  hasMatches?: boolean;
  closeMatches?: T[];
  suggestedRelaxations?: string[];
  comparisonSummary?: ComparisonSummary;
  noMatchReason?: string;
}

export class ProductSearchService {
  private registry: ProviderRegistry;

  constructor(registry: ProviderRegistry = providerRegistry) {
    this.registry = registry;
  }

  /**
   * Safe deduplication:
   * Merges products only when brand/model or normalized title are identical.
   * Prefers the lower priced listing and does not aggressively discard distinct variations.
   */
  private deduplicate(products: NormalizedProduct[]): NormalizedProduct[] {
    const deduped: NormalizedProduct[] = [];
    const seenSignatures = new Set<string>();

    for (const product of products) {
      // Formulate a conservative signature: simplified lowercase title (letters & numbers only) + model if available
      const cleanTitle = product.title
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 30);
      const model = (product.specifications['model'] || product.specifications['cpu'] || '').toLowerCase().replace(/[^a-z0-9]/g, '');

      const signature = `${cleanTitle}_${model}`;

      if (!seenSignatures.has(signature)) {
        seenSignatures.add(signature);
        deduped.push(product);
      } else {
        // Safe check: If identical product found from another provider, keep the one with better pricing
        const existingIdx = deduped.findIndex((p) => {
          const pClean = p.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30);
          const pModel = (p.specifications['model'] || p.specifications['cpu'] || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          return `${pClean}_${pModel}` === signature;
        });

        if (existingIdx !== -1 && product.price.amount < deduped[existingIdx].price.amount && product.price.amount > 0) {
          logger.debug('Replacing duplicate product with lower priced provider listing', {
            originalProvider: deduped[existingIdx].provider.name,
            cheaperProvider: product.provider.name,
            originalPrice: deduped[existingIdx].price.amount,
            newPrice: product.price.amount,
          });
          deduped[existingIdx] = product;
        } else {
          logger.debug('Skipping duplicate product variant from provider', {
            title: product.title,
            provider: product.provider.name,
          });
        }
      }
    }

    return deduped;
  }

  async search(
    requirements: SearchRequirements,
    options?: { minTarget?: number; maxTarget?: number }
  ): Promise<MultiProviderSearchResult<NormalizedProduct>> {
    const maxLimit = options?.maxTarget || (options?.minTarget ? 8 : 24);

    // 1. Discover all registered product providers
    const allProviders = this.registry.getProvidersForCategory<IProductProviderAdapter>('product');
    const availableProviders = allProviders.filter((p) => {
      try {
        return p.isAvailable();
      } catch {
        return false;
      }
    });

    if (availableProviders.length === 0) {
      logger.warn('No product providers currently available in ProviderRegistry.');
      return {
        results: [],
        totalFound: 0,
        providerStats: [],
      };
    }

    logger.info(`Querying ${availableProviders.length} product provider(s) in parallel.`);

    // 2. Query each provider in parallel with failure isolation
    const providerPromises = availableProviders.map(async (provider) => {
      try {
        const response = await provider.searchProducts(requirements, { maxResults: maxLimit });
        return {
          providerId: provider.providerId,
          providerName: provider.providerName,
          success: response.success,
          rawResults: response.results || [],
          error: response.error?.message,
        };
      } catch (err: any) {
        logger.error(`Error querying provider ${provider.providerId}:`, { error: err?.message });
        return {
          providerId: provider.providerId,
          providerName: provider.providerName,
          success: false,
          rawResults: [] as RawProductResult[],
          error: err?.message || 'Provider request failed',
        };
      }
    });

    const settledResults = await Promise.allSettled(providerPromises);

    // 3. Collect and normalize successful results
    const rawCollected: Array<{ raw: RawProductResult; provider: { id: string; name: string } }> = [];
    const providerStats: MultiProviderSearchResult<NormalizedProduct>['providerStats'] = [];

    for (const settled of settledResults) {
      if (settled.status === 'fulfilled') {
        const res = settled.value;
        providerStats.push({
          providerId: res.providerId,
          providerName: res.providerName,
          success: res.success,
          resultCount: res.rawResults.length,
          error: res.error,
        });

        if (res.success && Array.isArray(res.rawResults)) {
          for (const raw of res.rawResults) {
            rawCollected.push({
              raw,
              provider: { id: res.providerId, name: res.providerName },
            });
          }
        }
      }
    }

    // 4. Normalize raw results into universal schema
    const normalizedList: NormalizedProduct[] = rawCollected.map(({ raw, provider }) =>
      ProductNormalizer.normalize(raw, provider)
    );

    // 5. Safe Deduplication
    const dedupedResults = this.deduplicate(normalizedList);

    // 6. Respect upper bounds (DO NOT create fake filler results to satisfy minimum targets!)
    const finalResults = dedupedResults.slice(0, maxLimit);

    // 7. Process through Intelligence Layer: Filtering -> Comparison -> Scoring -> Ranking -> Rationale
    const recOutput = RecommendationEngine.processProducts(
      finalResults,
      requirements,
      options?.rawText,
      options?.profile || requirements.profile
    );

    logger.info(`Product search completed: ${recOutput.totalEligible} eligible recommendations returned across providers.`);

    return {
      results: recOutput.hasMatches ? recOutput.recommendations.map((r) => r.item) : [],
      totalFound: recOutput.hasMatches ? recOutput.recommendations.length : 0,
      providerStats,
      recommendations: recOutput.recommendations,
      hasMatches: recOutput.hasMatches,
      closeMatches: recOutput.closeMatches,
      suggestedRelaxations: recOutput.suggestedRelaxations,
      comparisonSummary: recOutput.comparisonSummary,
      noMatchReason: recOutput.noMatchReason,
    };
  }
}

export const productSearchService = new ProductSearchService();
