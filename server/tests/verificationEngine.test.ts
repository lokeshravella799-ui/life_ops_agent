import test from 'node:test';
import assert from 'node:assert/strict';
import { verificationService, VerificationService } from '../verification/verificationService';
import { UrlValidator } from '../verification/urlValidator';
import { FreshnessTracker } from '../verification/freshnessTracker';
import { PriceVerifier } from '../verification/priceVerifier';
import { AvailabilityVerifier } from '../verification/availabilityVerifier';
import { ProviderVerifier } from '../verification/providerVerifier';
import { providerRegistry } from '../providers/providerRegistry';
import { MockProductProvider } from '../providers/mock/mockProductProvider';
import { MockBusProvider } from '../providers/mock/mockBusProvider';
import type { NormalizedProduct, NormalizedBusResult } from '../types/provider';
import type { RecommendationResult } from '../comparison/types';

function createMockProduct(overrides?: Partial<NormalizedProduct>): NormalizedProduct {
  return {
    id: 'mock_omnistore_OMNI-LPT-01',
    provider: {
      id: 'mock_omnistore',
      name: 'DEVELOPMENT MOCK - OmniStore',
    },
    title: 'ASUS ROG Zephyrus G14 Gaming Laptop',
    description: 'AMD Ryzen 7, RTX 4050',
    images: ['https://images.unsplash.com/photo-1593642632823-8f785ba67e45'],
    price: {
      amount: 64999,
      currency: 'INR',
    },
    productUrl: 'https://omnistore.example.com/products/asus-g14',
    category: 'electronics',
    specifications: { category: 'electronics' },
    availability: 'In Stock',
    fetchedAt: new Date().toISOString(),
    verification: {
      priceVerified: false,
      availabilityVerified: false,
      providerVerified: false,
    },
    ...overrides,
  };
}

function createMockBus(overrides?: Partial<NormalizedBusResult>): NormalizedBusResult {
  return {
    id: 'mock_smarttransit_ST-HYD-BLR-01',
    provider: {
      id: 'mock_smarttransit',
      name: 'DEVELOPMENT MOCK - SmartTransit',
    },
    operator: 'IntrCity SmartBus',
    source: 'Hyderabad',
    destination: 'Bangalore',
    departureTime: '19:30',
    arrivalTime: '06:00',
    price: {
      amount: 1299,
      currency: 'INR',
    },
    seatsAvailable: 8,
    bookingUrl: 'https://smarttransit.example.com/book/ST-HYD-BLR-01',
    fetchedAt: new Date().toISOString(),
    verification: {
      priceVerified: false,
      availabilityVerified: false,
      providerVerified: false,
    },
    ...overrides,
  };
}

test('LifeOps Phase 2 Step 4: Verification & Trust Engine', async (t) => {
  let omniProvider = providerRegistry.getProvider<MockProductProvider>('mock_omnistore');
  if (!omniProvider) {
    omniProvider = new MockProductProvider();
    providerRegistry.register(omniProvider);
  }
  const busProvider = providerRegistry.getProvider<MockBusProvider>('mock_smarttransit')!;

  t.after(() => {
    providerRegistry.unregister('mock_omnistore');
  });

  t.beforeEach(() => {
    omniProvider?.resetVerificationScenarios();
    busProvider?.resetVerificationScenarios();
    verificationService.clearAuditEvents();
  });

  await t.test('TEST 1: Search result with unchanged price (priceVerified = true)', async () => {
    const product = createMockProduct({ price: { amount: 64999, currency: 'INR' } });
    omniProvider.setVerificationScenario('OMNI-LPT-01', 'PRICE_UNCHANGED');

    const result = await verificationService.verifyProduct(product);

    assert.equal(result.verified, true, 'Product should be marked verified');
    assert.equal(result.status, 'VERIFIED');
    assert.equal(result.checks.price.status, 'VERIFIED');
    assert.equal(result.checks.availability.status, 'VERIFIED');
    assert.equal(result.checks.provider.status, 'VERIFIED');
    assert.equal(result.priceChange, undefined, 'Price change should be undefined when price is unchanged');
  });

  await t.test('TEST 2: Search price ₹49,999, verified price ₹52,999 (price status = CHANGED)', async () => {
    const product = createMockProduct({
      id: 'mock_omnistore_OMNI-LPT-01',
      price: { amount: 49999, currency: 'INR' },
    });
    omniProvider.setVerificationScenario('OMNI-LPT-01', 'PRICE_CHANGED', 52999);

    const result = await verificationService.verifyProduct(product);

    assert.equal(result.verified, false, 'Should not be marked overall verified if price changed');
    assert.equal(result.status, 'CHANGED', 'Status should be CHANGED');
    assert.equal(result.checks.price.status, 'CHANGED');
    assert.ok(result.priceChange, 'Price change details must be present');
    assert.equal(result.priceChange?.originalPrice, 49999);
    assert.equal(result.priceChange?.verifiedPrice, 52999);
    assert.equal(result.priceChange?.difference, 3000);
    assert.equal(result.priceChange?.percentageChange, 6.0);
    assert.equal(result.priceChange?.currency, 'INR');
  });

  await t.test('TEST 3: Product becomes unavailable (availability = UNAVAILABLE)', async () => {
    const product = createMockProduct();
    omniProvider.setVerificationScenario('OMNI-LPT-01', 'UNAVAILABLE');

    const result = await verificationService.verifyProduct(product);

    assert.equal(result.verified, false);
    assert.equal(result.status, 'UNAVAILABLE');
    assert.equal(result.checks.availability.status, 'UNAVAILABLE');
    assert.ok(result.unavailableReason, 'Must include reason for unavailability');
  });

  await t.test('TEST 4: Verification provider timeout (verification = FAILED, search does not fail)', async () => {
    const productA = createMockProduct({ id: 'mock_omnistore_OMNI-LPT-01' });
    const productB = createMockProduct({
      id: 'mock_omnistore_OMNI-LPT-02',
      title: 'Lenovo Legion Slim 5',
      price: { amount: 68490, currency: 'INR' },
      productUrl: 'https://omnistore.example.com/products/lenovo-legion-slim-5',
    });

    // Simulate timeout only on Product A
    omniProvider.setVerificationScenario('OMNI-LPT-01', 'TIMEOUT');
    omniProvider.setVerificationScenario('OMNI-LPT-02', 'PRICE_UNCHANGED');

    const { verifiedItems, summary, results } = await verificationService.verifyResults(
      [productA, productB],
      'product'
    );

    // Assert entire batch did NOT fail
    assert.equal(verifiedItems.length, 2);
    assert.equal(results[0].status, 'FAILED');
    assert.equal(results[0].checks.price.status, 'FAILED');
    assert.equal(results[1].status, 'VERIFIED');
    assert.equal(results[1].checks.price.status, 'VERIFIED');
    assert.equal(summary.verifiedCount, 1);
    assert.equal(summary.unverifiedCount, 1);
  });

  await t.test('TEST 5: Provider identity is known (providerVerified = true)', async () => {
    const result = ProviderVerifier.verify(
      'mock_omnistore',
      'https://omnistore.example.com/products/test',
      providerRegistry
    );

    assert.equal(result.providerVerified, true);
    assert.equal(result.check.status, 'VERIFIED');
    assert.equal(result.issues.length, 0);
  });

  await t.test('TEST 6: Unknown provider (providerVerified = false)', async () => {
    const result = ProviderVerifier.verify(
      'untrusted_sketchy_store',
      'https://sketchystore.com/item',
      providerRegistry
    );

    assert.equal(result.providerVerified, false);
    assert.equal(result.check.status, 'FAILED');
    assert.ok(result.issues.length > 0);
    assert.match(result.issues[0], /not registered/i);
  });

  await t.test('TEST 7: Invalid provider URL (URL validation fails safely)', async () => {
    // 1. Dangerous scheme
    const dangerous = UrlValidator.validate('javascript:alert(document.cookie)', 'mock_omnistore');
    assert.equal(dangerous.isValid, false);
    assert.match(dangerous.reason || '', /dangerous/i);

    // 2. Malformed URL
    const malformed = UrlValidator.validate('htp:/not a url', 'mock_omnistore');
    assert.equal(malformed.isValid, false);

    // 3. Domain mismatch for registered provider
    const mismatch = UrlValidator.validate('https://phishing-site.com/asus', 'mock_omnistore');
    assert.equal(mismatch.isValid, false);
    assert.match(mismatch.reason || '', /does not match registered domains/i);

    // 4. ProviderVerifier integrates safety check
    const provRes = ProviderVerifier.verify('mock_omnistore', 'javascript:void(0)', providerRegistry);
    assert.equal(provRes.providerVerified, false);
    assert.equal(provRes.check.status, 'FAILED');
  });

  await t.test('TEST 8: Fresh verification (freshness = FRESH)', async () => {
    const nowIso = new Date().toISOString();
    const freshness = FreshnessTracker.evaluateFreshness(nowIso, { thresholdSeconds: 300 });

    assert.equal(freshness.status, 'FRESH');
    assert.ok(freshness.ageSeconds >= 0 && freshness.ageSeconds <= 2);
  });

  await t.test('TEST 9: Old verification (freshness = STALE)', async () => {
    const tenMinutesAgo = new Date(Date.now() - 600 * 1000).toISOString();
    const freshness = FreshnessTracker.evaluateFreshness(tenMinutesAgo, { thresholdSeconds: 300 });

    assert.equal(freshness.status, 'STALE');
    assert.ok(freshness.ageSeconds >= 590);
  });

  await t.test('TEST 10: No verification capability (UNSUPPORTED/UNKNOWN, never false VERIFIED)', async () => {
    // ApexRetail does NOT implement verification methods
    const apexProduct = createMockProduct({
      id: 'mock_apexretail_APEX-LPT-01',
      provider: {
        id: 'mock_apexretail',
        name: 'DEVELOPMENT MOCK - ApexRetail',
      },
      productUrl: 'https://apexretail.example.com/item',
    });

    const result = await verificationService.verifyProduct(apexProduct);

    assert.equal(result.verified, false, 'Must NEVER claim verified if adapter lacks capability');
    assert.equal(result.status, 'UNSUPPORTED');
    assert.equal(result.checks.price.status, 'UNSUPPORTED');
    assert.equal(result.checks.availability.status, 'UNSUPPORTED');
  });

  await t.test('TEST 11: Multiple results with mixed verification states (Correct summary counts)', async () => {
    const p1 = createMockProduct({ id: 'mock_omnistore_OMNI-LPT-01' }); // unchanged -> VERIFIED
    const p2 = createMockProduct({ id: 'mock_omnistore_OMNI-LPT-02' }); // price changed -> CHANGED
    const p3 = createMockProduct({ id: 'mock_omnistore_OMNI-LPT-03' }); // unavailable -> UNAVAILABLE
    const p4 = createMockProduct({
      id: 'mock_apexretail_APEX-LPT-01',
      provider: { id: 'mock_apexretail', name: 'ApexRetail' },
      productUrl: 'https://apexretail.example.com/laptops',
    }); // unsupported -> UNVERIFIED

    omniProvider.setVerificationScenario('OMNI-LPT-01', 'PRICE_UNCHANGED');
    omniProvider.setVerificationScenario('OMNI-LPT-02', 'PRICE_CHANGED', 72000);
    omniProvider.setVerificationScenario('OMNI-LPT-03', 'UNAVAILABLE');

    const { summary } = await verificationService.verifyResults([p1, p2, p3, p4], 'product');

    assert.equal(summary.verifiedCount, 1, 'Should have 1 verified item');
    assert.equal(summary.changedCount, 1, 'Should have 1 price-changed item');
    assert.equal(summary.unavailableCount, 1, 'Should have 1 unavailable item');
    assert.equal(summary.unverifiedCount, 1, 'Should have 1 unverified/unsupported item');
  });

  await t.test('TEST 12: Verification does not alter original normalized data unexpectedly', async () => {
    const product = createMockProduct({
      price: { amount: 64999, currency: 'INR' },
      title: 'Immutable Search Listing Title',
    });
    omniProvider.setVerificationScenario('OMNI-LPT-01', 'PRICE_CHANGED', 69999);

    const result = await verificationService.verifyProduct(product);

    // Product search amount itself is not silently mutated
    assert.equal(product.price.amount, 64999);
    assert.equal(product.title, 'Immutable Search Listing Title');
    assert.equal(result.priceChange?.originalPrice, 64999);
    assert.equal(result.priceChange?.verifiedPrice, 69999);
  });

  await t.test('TEST 13: Price change is preserved with original and verified values in recommendation', async () => {
    const product = createMockProduct({ price: { amount: 49999, currency: 'INR' } });
    omniProvider.setVerificationScenario('OMNI-LPT-01', 'PRICE_CHANGED', 52999);

    const mockRec: RecommendationResult = {
      resultId: product.id,
      rank: 1,
      overallScore: 92,
      item: product,
      whyThisText: 'Best overall choice at ₹49,999 with powerful graphics.',
      pros: ['Great thermals'],
      cons: [],
      matchedRequirements: ['budget'],
      unmetPreferences: [],
      scoreBreakdown: [],
    };

    const { recommendations } = await verificationService.verifyRecommendations([mockRec]);
    const verifiedRec = recommendations[0];

    assert.equal(verifiedRec.priceChanged, true);
    assert.equal(verifiedRec.originalPrice, 49999);
    assert.equal(verifiedRec.verifiedPrice, 52999);
    assert.equal(verifiedRec.priceDifference, 3000);
    // Crucial check: Narrative must NOT continue claiming ₹49,999 as current offer
    assert.ok(
      verifiedRec.whyThisText.includes('52,999'),
      'Recommendation text must reflect the verified price'
    );
  });

  await t.test('TEST 14: Unavailable result remains visible but clearly marked unavailable', async () => {
    const product = createMockProduct();
    omniProvider.setVerificationScenario('OMNI-LPT-01', 'UNAVAILABLE');

    const mockRec: RecommendationResult = {
      resultId: product.id,
      rank: 1,
      overallScore: 90,
      item: product,
      whyThisText: 'Top pick.',
      pros: [],
      cons: [],
      matchedRequirements: [],
      unmetPreferences: [],
      scoreBreakdown: [],
    };

    const { recommendations } = await verificationService.verifyRecommendations([mockRec]);

    // Result is NOT deleted
    assert.equal(recommendations.length, 1);
    const rec = recommendations[0];
    assert.equal(rec.item.availability, 'UNAVAILABLE');
    assert.equal(rec.verification?.status, 'UNAVAILABLE');
    assert.ok(rec.unavailableReason && rec.unavailableReason.length > 0);
  });

  await t.test('TEST 15: Bus transit verification (route, price, seats, operator)', async () => {
    const bus = createMockBus({ price: { amount: 1299, currency: 'INR' } });
    busProvider.setVerificationScenario('ST-HYD-BLR-01', 'PRICE_UNCHANGED');

    const result = await verificationService.verifyBus(bus);
    assert.equal(result.verified, true);
    assert.equal(result.status, 'VERIFIED');
    assert.equal(result.checks.price.status, 'VERIFIED');
    assert.equal(result.checks.availability.status, 'VERIFIED');

    // Seat sold out test
    busProvider.setVerificationScenario('ST-HYD-BLR-01', 'UNAVAILABLE');
    const soldOutRes = await verificationService.verifyBus(bus);
    assert.equal(soldOutRes.status, 'UNAVAILABLE');
    assert.equal(soldOutRes.verified, false);
  });

  await t.test('TEST 16: Verification audit event recording (No secrets logged)', async () => {
    const product = createMockProduct();
    omniProvider.setVerificationScenario('OMNI-LPT-01', 'PRICE_CHANGED', 68000);

    await verificationService.verifyProduct(product);

    const auditEvents = verificationService.getAuditEvents();
    assert.ok(auditEvents.length > 0, 'Audit event should be recorded');
    const priceChangeEvent = auditEvents.find((e) => e.eventType === 'PRICE_CHANGED');
    assert.ok(priceChangeEvent, 'PRICE_CHANGED audit event must exist');
    assert.equal(priceChangeEvent?.providerId, 'mock_omnistore');

    // Security check: Verify no passwords, tokens, credentials exist in details
    const serialized = JSON.stringify(auditEvents);
    assert.ok(!serialized.includes('password'));
    assert.ok(!serialized.includes('secret'));
    assert.ok(!serialized.includes('token'));
  });
});
