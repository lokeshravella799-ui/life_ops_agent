import type { IProviderAdapter, ProviderCategory } from '../types/provider';
import { AmazonShoppingProvider } from './amazonShoppingProvider';
import { FlipkartShoppingProvider } from './flipkartShoppingProvider';
import { MockBusProvider } from './mock/mockBusProvider';
import { MockHotelProvider } from './mock/mockHotelProvider';
import { MockFlightProvider } from './mock/mockFlightProvider';
import { logger } from '../utils/logger';

export class ProviderRegistry {
  private providers: Map<string, IProviderAdapter> = new Map();

  constructor() {
    this.registerDefaultProviders();
  }

  registerDefaultProviders(): void {
    this.register(new AmazonShoppingProvider());
    this.register(new FlipkartShoppingProvider());
    this.register(new MockBusProvider());
    this.register(new MockHotelProvider());
    this.register(new MockFlightProvider());
  }

  register(provider: IProviderAdapter): void {
    if (this.providers.has(provider.providerId)) {
      logger.warn(`Provider "${provider.providerId}" already registered. Overwriting.`);
    }
    this.providers.set(provider.providerId, provider);
    logger.info(`Registered provider adapter: ${provider.providerName} [${provider.providerId}] (${provider.category})`);
  }

  unregister(providerId: string): boolean {
    const deleted = this.providers.delete(providerId);
    if (deleted) {
      logger.info(`Unregistered provider adapter: ${providerId}`);
    }
    return deleted;
  }

  getProvider<T extends IProviderAdapter = IProviderAdapter>(providerId: string): T | undefined {
    return this.providers.get(providerId) as T | undefined;
  }

  hasProvider(providerId: string): boolean {
    return this.providers.has(providerId);
  }

  getProviders(): IProviderAdapter[] {
    return Array.from(this.providers.values());
  }

  getProvidersForCategory<T extends IProviderAdapter = IProviderAdapter>(
    category: ProviderCategory
  ): T[] {
    return Array.from(this.providers.values()).filter(
      (p) => p.category === category
    ) as T[];
  }

  clear(): void {
    this.providers.clear();
  }
}

export const providerRegistry = new ProviderRegistry();
