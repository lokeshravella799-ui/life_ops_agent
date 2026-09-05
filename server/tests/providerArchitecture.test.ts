import test from 'node:test';
import assert from 'node:assert/strict';

import { ProviderRegistry } from '../providers/providerRegistry';
import { MockProductProvider, MockSecondaryProductProvider } from '../providers/mock/mockProductProvider';
import { MockBusProvider } from '../providers/mock/mockBusProvider';
import { ProductNormalizer } from '../normalizers/productNormalizer';
import { BusNormalizer } from '../normalizers/busNormalizer';
import { ProductSearchService } from '../services/productSearchService';
import { toolRegistry } from '../agent/toolRegistry';
import type { RawProductResult, RawBusResult, IProductProviderAdapter, ProviderSearchResponse } from '../types/provider';
import type { SearchRequirements } from '../types/agent';

test('LifeOps Phase 2 Step 2: Provider Adapter Architecture & Result Normalization', async (t) => {

  // =========================================================================
  // TEST 1: Register a product provider -> Provider registry contains it
  // =========================================================================
  await t.test('TEST 1: Register a product provider in ProviderRegistry', () => {
    const registry = new ProviderRegistry();
    const mockProvider = new MockProductProvider();

    registry.register(mockProvider);

    assert.equal(registry.hasProvider('mock_omnistore'), true, 'Registry must contain registered provider');
    const retrieved = registry.getProvider('mock_omnistore');
    assert.ok(retrieved, 'Must retrieve provider by ID');
    assert.equal(retrieved.providerName, 'DEVELOPMENT MOCK - OmniStore');
    assert.equal(retrieved.category, 'product');

    const productProviders = registry.getProvidersForCategory('product');
    assert.ok(productProviders.some((p) => p.providerId === 'mock_omnistore'), 'Must list provider under category');
  });

  // =========================================================================
  // TEST 2: Search through MockProductProvider -> Raw products are returned
  // =========================================================================
  await t.test('TEST 2: Search through MockProductProvider returns raw products', async () => {
    const mockProvider = new MockProductProvider();
    const requirements: SearchRequirements = {
      category: 'electronics',
      budget: { max: 70000, currency: 'INR' },
      keywords: ['gaming laptop'],
    };

    const response = await mockProvider.searchProducts(requirements);

    assert.equal(response.success, true, 'Provider search must succeed');
    assert.equal(response.providerId, 'mock_omnistore');
    assert.ok(Array.isArray(response.results), 'Results must be an array');
    assert.ok(response.results.length > 0, 'Must return matching mock products');

    const first = response.results[0];
    assert.ok(first.providerProductId, 'Raw product must have providerProductId');
    assert.ok(first.title, 'Raw product must have title');
    assert.ok(first.price, 'Raw product must have price');
    assert.ok(first.productUrl, 'Raw product must have productUrl');
  });

  // =========================================================================
  // TEST 3: Normalize a raw product -> NormalizedProduct contains correct fields
  // =========================================================================
  await t.test('TEST 3: ProductNormalizer converts raw data into NormalizedProduct', () => {
    const raw: RawProductResult = {
      providerProductId: 'EXT-9988',
      title: '  Acer Predator Helios Neo 16  ',
      description: 'High performance gaming machine with liquid metal cooling',
      images: ['https://example.com/img1.jpg', '', 'https://example.com/img2.jpg'],
      productUrl: 'https://marketplace.example.com/item/9988',
      price: '₹72,990',
      originalPrice: '₹89,990',
      currency: 'INR',
      availability: ' In Stock ',
      seller: ' Official Acer Store ',
      rating: 4.6,
      reviewCount: 310,
      specifications: {
        cpu: 'Intel Core i7-13700HX',
        gpu: 'RTX 4060 8GB',
        ram: '16GB',
        category: 'electronics',
      },
      delivery: {
        estimatedDate: 'Tomorrow',
        fee: '₹0',
      },
    };

    const providerInfo = { id: 'test_provider', name: 'Test Marketplace' };
    const normalized = ProductNormalizer.normalize(raw, providerInfo);

    // Verify key normalized fields
    assert.equal(normalized.id, 'test_provider_EXT-9988');
    assert.equal(normalized.provider.id, 'test_provider');
    assert.equal(normalized.provider.name, 'Test Marketplace');
    assert.equal(normalized.title, 'Acer Predator Helios Neo 16');
    assert.equal(normalized.price.amount, 72990, 'Must parse numeric amount from formatted string');
    assert.equal(normalized.price.currency, 'INR');
    assert.equal(normalized.originalPrice?.amount, 89990);
    assert.equal(normalized.discount, 19, 'Must calculate discount percentage accurately');
    assert.equal(normalized.images.length, 2, 'Must filter out empty image strings');
    assert.equal(normalized.seller, 'Official Acer Store');
    assert.equal(normalized.rating, 4.6);
    assert.equal(normalized.reviewCount, 310);
    assert.equal(normalized.delivery?.fee, 0);
    assert.ok(normalized.fetchedAt, 'Must include ISO fetchedAt timestamp');
    assert.equal(normalized.verification?.priceVerified, false, 'Initial verification state must be unverified');
  });

  // =========================================================================
  // TEST 4: Multiple product providers -> Results from both providers combined
  // =========================================================================
  await t.test('TEST 4: Multiple product providers combine into unified results', async () => {
    const testRegistry = new ProviderRegistry();
    testRegistry.clear();
    testRegistry.register(new MockProductProvider());
    testRegistry.register(new MockSecondaryProductProvider());
    const searchService = new ProductSearchService(testRegistry);
    const requirements: SearchRequirements = {
      category: 'electronics',
      budget: { max: 70000, currency: 'INR' },
    };

    const response = await searchService.search(requirements);

    assert.ok(response.results.length >= 2, 'Combined results must contain products from multiple providers');
    const providersFound = new Set(response.results.map((p) => p.provider.id));
    assert.ok(providersFound.has('mock_omnistore'), 'Must contain results from OmniStore');
    assert.ok(providersFound.has('mock_apexretail'), 'Must contain results from ApexRetail');
    assert.equal(response.providerStats.length, 2, 'Provider statistics must cover all queried providers');
  });

  // =========================================================================
  // TEST 5: One provider fails -> Successful provider results are still returned
  // =========================================================================
  await t.test('TEST 5: Failure isolation when one provider throws or fails', async () => {
    const testRegistry = new ProviderRegistry();
    testRegistry.clear();

    const omniProvider = new MockProductProvider();
    const failingSecondary = new MockSecondaryProductProvider();

    // Trigger failure on the secondary provider
    failingSecondary.setShouldFail(true);

    testRegistry.register(omniProvider);
    testRegistry.register(failingSecondary);

    const searchService = new ProductSearchService(testRegistry);

    const requirements: SearchRequirements = { category: 'electronics' };
    const response = await searchService.search(requirements);

    // Assert that results were still obtained from the working provider
    assert.ok(response.results.length > 0, 'Successful provider results must still be returned');
    assert.ok(response.results.every((p) => p.provider.id === 'mock_omnistore'), 'Only healthy provider results present');

    const failingStat = response.providerStats.find((s) => s.providerId === 'mock_apexretail');
    assert.ok(failingStat, 'Failing provider stat must be logged');
    assert.equal(failingStat?.success, false, 'Failed provider must be flagged as unsuccessful');
  });

  // =========================================================================
  // TEST 6: Duplicate product appears from two providers -> Safe deduplication
  // =========================================================================
  await t.test('TEST 6: Safe deduplication across multiple providers', async () => {
    const testRegistry = new ProviderRegistry();
    testRegistry.clear();
    testRegistry.register(new MockProductProvider());
    testRegistry.register(new MockSecondaryProductProvider());
    const searchService = new ProductSearchService(testRegistry);
    const requirements: SearchRequirements = {
      category: 'electronics',
      budget: { max: 80000, currency: 'INR' },
    };

    const response = await searchService.search(requirements);

    // ASUS ROG Zephyrus G14 is offered by both OmniStore (₹64,999) and ApexRetail (₹64,499)
    const asusMatches = response.results.filter((p) =>
      p.title.toLowerCase().includes('asus rog zephyrus g14')
    );

    // Should be safely deduplicated to exactly 1 best listing
    assert.equal(asusMatches.length, 1, 'Duplicate product from two providers must be deduplicated to one entry');
    assert.equal(asusMatches[0].price.amount, 64499, 'Safe deduplication must retain the more favorable price (ApexRetail)');
  });

  // =========================================================================
  // TEST 7: Less than 9 genuine results -> Never create fake filler products
  // =========================================================================
  await t.test('TEST 7: Exact genuine result count returned without fake fillers', async () => {
    const searchService = new ProductSearchService();
    // Set a strict budget where only 1 or 2 items qualify
    const strictRequirements: SearchRequirements = {
      category: 'electronics',
      budget: { max: 60000, currency: 'INR' },
    };

    const response = await searchService.search(strictRequirements, { minTarget: 9 });

    assert.ok(response.results.length < 9, 'Must not artificially inflate results to reach minimum target 9');
    assert.equal(response.totalFound, response.results.length);
    assert.ok(response.results.every((p) => p.price.amount <= 60000), 'All returned items must be genuine and meet criteria');
  });

  // =========================================================================
  // TEST 8: Provider has no credentials / unavailable -> Reports unavailable
  // =========================================================================
  await t.test('TEST 8: Unavailable provider reports isAvailable = false without crashing', async () => {
    class UncredentialedProvider implements IProductProviderAdapter {
      readonly providerId = 'uncredentialed_future_provider';
      readonly providerName = 'Future Provider Without Keys';
      readonly category = 'product' as const;

      isAvailable(): boolean {
        // Without required API key from environment, provider gracefully reports unavailable
        return Boolean(process.env.NON_EXISTENT_API_KEY);
      }

      async searchProducts(): Promise<ProviderSearchResponse<RawProductResult>> {
        throw new Error('Should not be invoked when isAvailable() is false');
      }

      async getProductDetails(): Promise<RawProductResult | null> {
        return null;
      }
    }

    const uncredentialed = new UncredentialedProvider();
    assert.equal(uncredentialed.isAvailable(), false, 'Provider without keys must report isAvailable() false');

    const registry = new ProviderRegistry();
    registry.register(uncredentialed);

    const available = registry.getProvidersForCategory<IProductProviderAdapter>('product')
      .filter((p) => p.isAvailable());

    assert.ok(!available.some((p) => p.providerId === 'uncredentialed_future_provider'), 'Unavailable provider excluded from query');
  });

  // =========================================================================
  // TEST 9: search_products tool -> Uses ProductSearchService
  // =========================================================================
  await t.test('TEST 9: search_products tool delegates to ProductSearchService', async () => {
    const searchTool = toolRegistry.getTool('search_products');
    assert.ok(searchTool, 'search_products tool must exist in registry');

    const toolResult = await searchTool.execute({
      category: 'electronics',
      budget: { max: 70000, currency: 'INR' },
    });

    assert.equal(toolResult.success, true, 'search_products tool must succeed');
    assert.ok(toolResult.data?.results, 'Must return normalized results collection');
    assert.ok(Array.isArray(toolResult.data.results), 'data.results must be an array');
    assert.ok(toolResult.data.results.length > 0, 'Must contain normalized products');
    assert.ok(toolResult.data.results[0].provider?.name, 'Normalized product must contain provider name');
  });

  // =========================================================================
  // TEST 10: Bus normalization -> Raw bus data becomes NormalizedBusResult
  // =========================================================================
  await t.test('TEST 10: BusNormalizer converts raw bus schedule into NormalizedBusResult', () => {
    const rawBus: RawBusResult = {
      busId: 'BUS-HYD-BLR-88',
      operator: '  Kaveri Travels  ',
      source: 'Hyderabad',
      destination: 'Bangalore',
      departureTime: '20:15',
      arrivalTime: '06:30',
      duration: '10h 15m',
      busType: 'Bharat Benz A/C Sleeper',
      price: '₹1,350',
      currency: 'INR',
      seatsAvailable: 6,
      boardingPoints: ['Gachibowli', 'Mehdipatnam'],
      droppingPoints: ['Hebbal', 'Majestic'],
      rating: 4.8,
      cancellationPolicy: 'Refundable up to 8 hrs prior',
      bookingUrl: 'https://kaveri.example.com/ticket/88',
    };

    const providerInfo = { id: 'mock_bus_provider', name: 'SmartTransit' };
    const normalized = BusNormalizer.normalize(rawBus, providerInfo);

    assert.equal(normalized.id, 'mock_bus_provider_BUS-HYD-BLR-88');
    assert.equal(normalized.operator, 'Kaveri Travels');
    assert.equal(normalized.source, 'Hyderabad');
    assert.equal(normalized.destination, 'Bangalore');
    assert.equal(normalized.departureTime, '20:15');
    assert.equal(normalized.price.amount, 1350);
    assert.equal(normalized.price.currency, 'INR');
    assert.equal(normalized.seatsAvailable, 6);
    assert.equal(normalized.boardingPoints?.length, 2);
    assert.equal(normalized.rating, 4.8);
    assert.equal(normalized.verification?.priceVerified, false);
    assert.ok(normalized.fetchedAt);
  });

});
