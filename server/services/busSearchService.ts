import type { SearchRequirements } from '../types/agent';
import type { NormalizedBusResult, IBusProviderAdapter, RawBusResult } from '../types/provider';
import { providerRegistry } from '../providers/providerRegistry';
import { BusNormalizer } from '../normalizers/busNormalizer';
import { RecommendationEngine } from '../comparison/recommendationEngine';
import { logger } from '../utils/logger';
import type { MultiProviderSearchResult } from './productSearchService';

export class BusSearchService {
  async search(
    requirements: SearchRequirements,
    options?: { maxTarget?: number }
  ): Promise<MultiProviderSearchResult<NormalizedBusResult>> {
    const maxLimit = options?.maxTarget || 20;

    const allProviders = providerRegistry.getProvidersForCategory<IBusProviderAdapter>('bus');
    const availableProviders = allProviders.filter((p) => {
      try {
        return p.isAvailable();
      } catch {
        return false;
      }
    });

    if (availableProviders.length === 0) {
      logger.warn('No bus transit providers currently available in ProviderRegistry.');
      return {
        results: [],
        totalFound: 0,
        providerStats: [],
      };
    }

    logger.info(`Querying ${availableProviders.length} bus provider(s) in parallel.`);

    const providerPromises = availableProviders.map(async (provider) => {
      try {
        const response = await provider.searchBuses(requirements);
        return {
          providerId: provider.providerId,
          providerName: provider.providerName,
          success: response.success,
          rawResults: response.results || [],
          error: response.error?.message,
        };
      } catch (err: any) {
        logger.error(`Error querying bus provider ${provider.providerId}:`, { error: err?.message });
        return {
          providerId: provider.providerId,
          providerName: provider.providerName,
          success: false,
          rawResults: [] as RawBusResult[],
          error: err?.message || 'Bus provider request failed',
        };
      }
    });

    const settledResults = await Promise.allSettled(providerPromises);

    const rawCollected: Array<{ raw: RawBusResult; provider: { id: string; name: string } }> = [];
    const providerStats: MultiProviderSearchResult<NormalizedBusResult>['providerStats'] = [];

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

    const normalizedList: NormalizedBusResult[] = rawCollected.map(({ raw, provider }) =>
      BusNormalizer.normalize(raw, provider)
    );

    const finalResults = normalizedList.slice(0, maxLimit);
    const recOutput = RecommendationEngine.processBuses(
      finalResults,
      requirements,
      undefined,
      requirements.profile
    );

    logger.info(`Bus search completed: ${recOutput.totalEligible} eligible route(s) returned.`);

    return {
      results: recOutput.hasMatches ? recOutput.recommendations.map((r) => r.item) : [],
      totalFound: recOutput.hasMatches ? recOutput.recommendations.length : 0,
      providerStats,
      recommendations: recOutput.recommendations,
      hasMatches: recOutput.hasMatches,
      closeMatches: recOutput.closeMatches,
      suggestedRelaxations: recOutput.suggestedRelaxations,
      noMatchReason: recOutput.noMatchReason,
    };
  }
}

export const busSearchService = new BusSearchService();
