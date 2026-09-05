import test from 'node:test';
import assert from 'node:assert/strict';

import { ConstraintFilter } from '../comparison/constraintFilter';
import { ScoringEngine } from '../comparison/scoringEngine';
import { RankingEngine } from '../comparison/rankingEngine';
import { ComparisonEngine } from '../comparison/comparisonEngine';
import { RecommendationEngine } from '../comparison/recommendationEngine';
import { RationaleGenerator } from '../comparison/rationaleGenerator';
import type { NormalizedProduct, NormalizedBusResult } from '../types/provider';
import type { SearchRequirements } from '../types/agent';

test('LifeOps Phase 2 Step 3: Comparison, Scoring & Recommendation Engine', async (t) => {

  // Test Fixture: Standard Mock Normalized Products
  const mockProducts: NormalizedProduct[] = [
    {
      id: 'p_asus_g14',
      provider: { id: 'omnistore', name: 'OmniStore' },
      title: 'ASUS ROG Zephyrus G14 Gaming Laptop',
      description: 'AMD Ryzen 7 7840HS, RTX 4050 6GB, 16GB DDR5, 1TB SSD',
      images: ['https://example.com/asus.jpg'],
      price: { amount: 64999, currency: 'INR' },
      originalPrice: { amount: 79990, currency: 'INR' },
      discount: 18,
      availability: 'In Stock',
      productUrl: 'https://example.com/asus',
      seller: 'Omni Retail',
      category: 'electronics',
      specifications: {
        cpu: 'AMD Ryzen 7 7840HS',
        gpu: 'RTX 4050 6GB',
        ram: '16GB',
        storage: '1TB SSD',
      },
      rating: 4.8,
      reviewCount: 1420,
      fetchedAt: new Date().toISOString(),
      verification: { priceVerified: false, availabilityVerified: false, providerVerified: false },
    },
    {
      id: 'p_acer_nitro',
      provider: { id: 'omnistore', name: 'OmniStore' },
      title: 'Acer Nitro V 15 Gaming Laptop',
      description: 'Intel Core i5-13420H, RTX 4050 6GB, 8GB DDR5, 512GB SSD',
      images: ['https://example.com/acer.jpg'],
      price: { amount: 54999, currency: 'INR' },
      originalPrice: { amount: 69990, currency: 'INR' },
      discount: 21,
      availability: 'In Stock',
      productUrl: 'https://example.com/acer',
      seller: 'Nitro Outlet',
      category: 'electronics',
      specifications: {
        cpu: 'Intel Core i5-13420H',
        gpu: 'RTX 4050 6GB',
        ram: '8GB',
        storage: '512GB SSD',
      },
      rating: 4.5,
      reviewCount: 2310,
      fetchedAt: new Date().toISOString(),
      verification: { priceVerified: false, availabilityVerified: false, providerVerified: false },
    },
    {
      id: 'p_lenovo_legion',
      provider: { id: 'apexretail', name: 'ApexRetail' },
      title: 'Lenovo Legion Slim 5 Gaming Laptop',
      description: 'Intel Core i7-13700H, RTX 4060 8GB, 16GB DDR5, 1TB SSD',
      images: ['https://example.com/lenovo.jpg'],
      price: { amount: 84990, currency: 'INR' },
      originalPrice: { amount: 99990, currency: 'INR' },
      discount: 15,
      availability: 'In Stock',
      productUrl: 'https://example.com/lenovo',
      seller: 'Lenovo Authorized',
      category: 'electronics',
      specifications: {
        cpu: 'Intel Core i7-13700H',
        gpu: 'RTX 4060 8GB',
        ram: '16GB',
        storage: '1TB SSD',
      },
      rating: 4.7,
      reviewCount: 980,
      fetchedAt: new Date().toISOString(),
      verification: { priceVerified: false, availabilityVerified: false, providerVerified: false },
    },
  ];

  // Test Fixture: Standard Mock Normalized Buses
  const mockBuses: NormalizedBusResult[] = [
    {
      id: 'bus_smart_01',
      provider: { id: 'smarttransit', name: 'SmartTransit' },
      operator: 'IntrCity SmartBus',
      source: 'Hyderabad',
      destination: 'Bangalore',
      departureTime: '19:30',
      arrivalTime: '06:00',
      duration: '10h 30m',
      busType: 'AC Sleeper (2+1)',
      price: { amount: 1299, currency: 'INR' },
      seatsAvailable: 8,
      rating: 4.8,
      cancellationPolicy: 'Free cancellation up to 6 hours prior',
      bookingUrl: 'https://smarttransit.example.com/01',
      fetchedAt: new Date().toISOString(),
      verification: { priceVerified: false, availabilityVerified: false, providerVerified: false },
    },
    {
      id: 'bus_orange_02',
      provider: { id: 'smarttransit', name: 'SmartTransit' },
      operator: 'Orange Tours',
      source: 'Hyderabad',
      destination: 'Bangalore',
      departureTime: '16:30', // Before 6 PM
      arrivalTime: '03:15',
      duration: '10h 45m',
      busType: 'AC Sleeper',
      price: { amount: 1100, currency: 'INR' },
      seatsAvailable: 12,
      rating: 4.6,
      cancellationPolicy: 'Standard cancellation',
      bookingUrl: 'https://smarttransit.example.com/02',
      fetchedAt: new Date().toISOString(),
      verification: { priceVerified: false, availabilityVerified: false, providerVerified: false },
    },
  ];

  // =========================================================================
  // TEST 1: Product under budget -> Eligible
  // =========================================================================
  await t.test('TEST 1: Product under hard budget is marked eligible', () => {
    const reqs: SearchRequirements = { budget: { max: 70000, currency: 'INR' } };
    const evalResult = ConstraintFilter.filterProducts(mockProducts, reqs);

    assert.equal(evalResult.hasMatches, true);
    assert.ok(evalResult.eligible.some((p) => p.id === 'p_asus_g14'));
    assert.ok(evalResult.eligible.some((p) => p.id === 'p_acer_nitro'));
  });

  // =========================================================================
  // TEST 2: Product over hard budget -> Excluded
  // =========================================================================
  await t.test('TEST 2: Product over hard budget is strictly excluded', () => {
    const reqs: SearchRequirements = { budget: { max: 70000, currency: 'INR' } };
    const evalResult = ConstraintFilter.filterProducts(mockProducts, reqs);

    assert.ok(!evalResult.eligible.some((p) => p.id === 'p_lenovo_legion'), 'Lenovo (₹84,990) must be excluded');
    const excludedLenovo = evalResult.excluded.find((e) => e.item.id === 'p_lenovo_legion');
    assert.ok(excludedLenovo, 'Must record exclusion details');
    assert.equal(excludedLenovo?.violatedConstraint, 'budget');
  });

  // =========================================================================
  // TEST 3: Minimum RAM constraint -> Products below minimum excluded
  // =========================================================================
  await t.test('TEST 3: Products below minimum RAM constraint are excluded', () => {
    const reqs: SearchRequirements = {
      budget: { max: 70000, currency: 'INR' },
      constraints: { minRamGb: 16 },
    };
    const evalResult = ConstraintFilter.filterProducts(mockProducts, reqs);

    assert.ok(evalResult.eligible.some((p) => p.id === 'p_asus_g14'), 'ASUS (16GB RAM) must be eligible');
    assert.ok(!evalResult.eligible.some((p) => p.id === 'p_acer_nitro'), 'Acer (8GB RAM) must be excluded');

    const excludedAcer = evalResult.excluded.find((e) => e.item.id === 'p_acer_nitro');
    assert.equal(excludedAcer?.violatedConstraint, 'minRamGb');
  });

  // =========================================================================
  // TEST 4: Cheapest objective -> Lower-price eligible result receives stronger price preference
  // =========================================================================
  await t.test('TEST 4: Cheapest objective prioritizes lower-priced eligible products', () => {
    const reqs: SearchRequirements = {
      budget: { max: 70000, currency: 'INR' },
      sortPreference: 'cheapest',
    };

    const ranked = RankingEngine.rankProducts([mockProducts[0], mockProducts[1]], reqs, 'find me the cheapest laptop');

    // Acer is ₹54,999 vs ASUS ₹64,999. With 'cheapest' objective, Acer ranks #1
    assert.equal(ranked[0].item.id, 'p_acer_nitro');
    assert.equal(ranked[0].rank, 1);
    assert.ok(ranked[0].overallScore > ranked[1].overallScore);
  });

  // =========================================================================
  // TEST 5: Best-value objective -> Score considers multiple factors rather than only price
  // =========================================================================
  await t.test('TEST 5: Best-value objective balances performance and price', () => {
    const reqs: SearchRequirements = {
      budget: { max: 70000, currency: 'INR' },
      sortPreference: 'best',
    };

    const scoredAsus = ScoringEngine.scoreProduct(mockProducts[0], mockProducts, reqs, 'best laptop under 70000');
    const scoredAcer = ScoringEngine.scoreProduct(mockProducts[1], mockProducts, reqs, 'best laptop under 70000');

    // ASUS has Ryzen 7 + 16GB RAM + 4.8 rating vs Acer i5 + 8GB RAM + 4.5 rating
    assert.ok(scoredAsus.factors.length >= 4, 'Must evaluate multiple factors');
    assert.ok(scoredAsus.overallScore > scoredAcer.overallScore, 'ASUS provides superior overall value despite higher price');
  });

  // =========================================================================
  // TEST 6: Gaming workload -> GPU/CPU-related factors influence ranking
  // =========================================================================
  await t.test('TEST 6: Gaming workload prioritizes GPU and CPU capabilities', () => {
    const reqs: SearchRequirements = {
      budget: { max: 70000, currency: 'INR' },
      keywords: ['gaming laptop'],
    };

    const scored = ScoringEngine.scoreProduct(mockProducts[0], mockProducts, reqs, 'gaming laptop for esports');
    const gpuFactor = scored.factors.find((f) => f.name === 'gpu');

    assert.ok(gpuFactor, 'Must evaluate dedicated GPU factor');
    assert.ok((gpuFactor?.weight || 0) >= 0.25, 'GPU weight must be heavily prioritized for gaming');
    assert.ok((gpuFactor?.score || 0) >= 70, 'RTX 4050 must achieve gaming tier score');
  });

  // =========================================================================
  // TEST 7: Bus cheapest request -> Price receives strong weighting
  // =========================================================================
  await t.test('TEST 7: Bus cheapest request applies strong price weighting', () => {
    const reqs: SearchRequirements = {
      source: 'Hyderabad',
      destination: 'Bangalore',
      sortPreference: 'cheapest',
    };

    const scored = ScoringEngine.scoreBus(mockBuses[0], mockBuses, reqs, 'cheapest bus');
    const priceFactor = scored.factors.find((f) => f.name === 'price');

    assert.ok(priceFactor);
    assert.ok((priceFactor?.weight || 0) >= 0.50, 'Price weight must be at least 0.50 for cheapest request');
  });

  // =========================================================================
  // TEST 8: Bus after 6 PM -> Earlier buses excluded when 6 PM is hard constraint
  // =========================================================================
  await t.test('TEST 8: Earlier buses excluded when departureAfter cutoff is specified', () => {
    const reqs: SearchRequirements = {
      source: 'Hyderabad',
      destination: 'Bangalore',
      departureAfter: '18:00', // 6:00 PM
    };

    const evalResult = ConstraintFilter.filterBuses(mockBuses, reqs);

    assert.ok(evalResult.eligible.some((b) => b.id === 'bus_smart_01'), '19:30 bus must be eligible');
    assert.ok(!evalResult.eligible.some((b) => b.id === 'bus_orange_02'), '16:30 bus must be excluded');

    const excludedOrange = evalResult.excluded.find((e) => e.item.id === 'bus_orange_02');
    assert.equal(excludedOrange?.violatedConstraint, 'departureAfter');
  });

  // =========================================================================
  // TEST 9: No exact matches -> Structured no-match response with suggested relaxations
  // =========================================================================
  await t.test('TEST 9: No exact matches returns structured no-match with relaxations', () => {
    const impossibleReqs: SearchRequirements = {
      category: 'electronics',
      budget: { max: 30000, currency: 'INR' }, // All laptops are > ₹50,000
    };

    const output = RecommendationEngine.processProducts(mockProducts, impossibleReqs);

    assert.equal(output.hasMatches, false, 'hasMatches must be false');
    assert.equal(output.recommendations.length, 0);
    assert.ok(output.noMatchReason?.includes('30,000'));
    assert.ok(Array.isArray(output.suggestedRelaxations));
    assert.ok(output.suggestedRelaxations.length > 0);
  });

  // =========================================================================
  // TEST 10: Partial matches -> Close matches clearly separated from exact matches
  // =========================================================================
  await t.test('TEST 10: Close matches are preserved separately without pretending to be exact matches', () => {
    const reqs: SearchRequirements = {
      budget: { max: 50000, currency: 'INR' }, // Acer is ₹54,999 (within 10% delta)
    };

    const output = RecommendationEngine.processProducts(mockProducts, reqs);

    assert.equal(output.hasMatches, false);
    assert.ok(output.closeMatches.length > 0, 'Close matches must be retained');
    assert.ok(output.closeMatches.some((p) => p.id === 'p_acer_nitro'), 'Acer should appear as close match');
  });

  // =========================================================================
  // TEST 11: Missing specification -> Treated as unknown, not fabricated
  // =========================================================================
  await t.test('TEST 11: Missing specification is marked unavailable without fabricated score', () => {
    const productMissingGpu: NormalizedProduct = {
      ...mockProducts[0],
      id: 'p_no_gpu',
      title: 'General Office Laptop',
      specifications: { ram: '16GB', cpu: 'Core i5-1235U' }, // no GPU
    };

    const scored = ScoringEngine.scoreProduct(productMissingGpu, [productMissingGpu], {});
    const gpuFactor = scored.factors.find((f) => f.name === 'gpu');

    assert.ok(gpuFactor);
    assert.equal(gpuFactor?.isAvailable, false, 'Missing GPU must be flagged as isAvailable: false');
    assert.ok(gpuFactor?.weight < 0.1, 'Weight of missing attribute must be attenuated');
    assert.ok(!gpuFactor?.reason.includes('RTX'), 'Must not invent an RTX specification');
  });

  // =========================================================================
  // TEST 12: Rationale generation -> whyThisText references actual result data
  // =========================================================================
  await t.test('TEST 12: whyThisText references actual product specs and budget', () => {
    const reqs: SearchRequirements = { budget: { max: 70000, currency: 'INR' }, keywords: ['gaming'] };
    const whyThis = RationaleGenerator.generateProductWhyThis(
      mockProducts[0],
      1,
      reqs,
      'BEST_PERFORMANCE',
      { name: 'gaming', description: '', priorities: [] }
    );

    assert.ok(whyThis.includes('gaming'), 'Must cite user request');
    assert.ok(whyThis.includes('RTX 4050') || whyThis.includes('graphics'), 'Must cite actual GPU');
    assert.ok(!whyThis.includes('world\'s best'), 'Must not contain hyperbolic claims');
  });

  // =========================================================================
  // TEST 13: Pros/cons -> No unsupported claims
  // =========================================================================
  await t.test('TEST 13: Pros and cons are strictly grounded in normalized data', () => {
    const reqs: SearchRequirements = { budget: { max: 70000, currency: 'INR' } };
    const { pros, cons } = RationaleGenerator.generateProductProsCons(
      mockProducts[1], // Acer: 8GB RAM, ₹54,999
      reqs,
      []
    );

    assert.ok(pros.some((p) => p.includes('under budget')), 'Must note savings under budget');
    assert.ok(cons.some((c) => c.includes('8GB')), 'Must flag 8GB memory as limitation');
    assert.ok(!cons.some((c) => c.includes('poor audio')), 'Must not invent unsupported claims');
  });

  // =========================================================================
  // TEST 14: Ranking determinism -> Same input produces same ranking
  // =========================================================================
  await t.test('TEST 14: Ranking is 100% deterministic given identical inputs', () => {
    const reqs: SearchRequirements = { budget: { max: 90000, currency: 'INR' } };

    const runA = RankingEngine.rankProducts(mockProducts, reqs, 'find laptops');
    const runB = RankingEngine.rankProducts(mockProducts, reqs, 'find laptops');

    assert.equal(runA.length, runB.length);
    for (let i = 0; i < runA.length; i++) {
      assert.equal(runA[i].resultId, runB[i].resultId);
      assert.equal(runA[i].overallScore, runB[i].overallScore);
      assert.equal(runA[i].rank, runB[i].rank);
    }
  });

  // =========================================================================
  // TEST 15: 9+ genuine results -> All genuine results are ranked
  // =========================================================================
  await t.test('TEST 15: 9+ genuine results are fully evaluated and ranked', () => {
    // Generate 12 genuine variations
    const twelveProducts: NormalizedProduct[] = Array.from({ length: 12 }, (_, i) => ({
      ...mockProducts[0],
      id: `p_genuine_${i}`,
      title: `Laptop Model Gen ${i + 1}`,
      price: { amount: 50000 + i * 1500, currency: 'INR' },
    }));

    const output = RecommendationEngine.processProducts(twelveProducts, { budget: { max: 70000, currency: 'INR' } });

    assert.equal(output.recommendations.length, 12, 'All 12 genuine items must be ranked');
    assert.equal(output.recommendations[0].rank, 1);
    assert.equal(output.recommendations[11].rank, 12);
  });

  // =========================================================================
  // TEST 16: Only 4 genuine results -> 4 results returned, no filler results
  // =========================================================================
  await t.test('TEST 16: 4 genuine results returns exactly 4 without fake filler items', () => {
    const fourProducts = [
      mockProducts[0],
      mockProducts[1],
      { ...mockProducts[0], id: 'p4_3', price: { amount: 62000, currency: 'INR' } },
      { ...mockProducts[0], id: 'p4_4', price: { amount: 58000, currency: 'INR' } },
    ];

    const output = RecommendationEngine.processProducts(fourProducts, { budget: { max: 70000, currency: 'INR' } });

    assert.equal(output.recommendations.length, 4, 'Must return exactly 4 genuine results without filler padding');
    assert.equal(output.totalEligible, 4);
  });

  // =========================================================================
  // TEST 17: Different currencies -> Rejects invalid cross-currency comparison
  // =========================================================================
  await t.test('TEST 17: Mismatched currency is marked ineligible for comparison', () => {
    const usdProduct: NormalizedProduct = {
      ...mockProducts[0],
      id: 'p_usd',
      price: { amount: 800, currency: 'USD' },
    };

    const scored = ScoringEngine.scoreProduct(usdProduct, [usdProduct], { currency: 'INR' });
    assert.equal(scored.overallScore, 0, 'Cross-currency without exchange rate must fail safely');
    assert.ok(scored.factors.some((f) => f.name === 'currency_mismatch'));
  });

  // =========================================================================
  // TEST 18: Verification flags -> Scoring does not falsely mark results as verified
  // =========================================================================
  await t.test('TEST 18: Scoring engine does not modify verification flags', () => {
    const unverifiedProduct: NormalizedProduct = {
      ...mockProducts[0],
      verification: { priceVerified: false, availabilityVerified: false, providerVerified: false },
    };

    const output = RecommendationEngine.processProducts([unverifiedProduct], {});
    const rec = output.recommendations[0];

    assert.equal(rec.item.verification?.priceVerified, false, 'priceVerified must remain false');
    assert.equal(rec.item.verification?.availabilityVerified, false, 'availabilityVerified must remain false');
    assert.equal(rec.item.verification?.providerVerified, false, 'providerVerified must remain false');
  });

});
