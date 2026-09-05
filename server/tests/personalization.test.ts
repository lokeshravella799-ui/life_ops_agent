import test from 'node:test';
import assert from 'node:assert/strict';
import { profileStore } from '../personalization/profileStore';
import { llmService } from '../llm/llmService';
import { orchestrator } from '../agent/orchestrator';
import { contextManager } from '../agent/contextManager';
import { RankingEngine } from '../comparison/rankingEngine';
import { ExecutionPreparer } from '../execution/executionPreparer';
import type { NormalizedProduct } from '../types/provider';
import type { SearchRequirements } from '../types/agent';
import type { RecommendationResult } from '../comparison/types';

test('LifeOps Personalization & Profiles - Step 1 Test Suite', async (t) => {
  const userId = `test_user_${Date.now()}`;

  // Clean state for test user
  profileStore.clearProfile(userId);

  // Common contact & delivery fixtures for execution tests
  const validContact = {
    name: 'Lokesh Sharma',
    email: 'lokesh.sharma@example.com',
    phone: '+919876543210',
  };

  const validDelivery = {
    fullName: 'Lokesh Sharma',
    addressLine1: '402, Skyline Residency, Hitec City',
    city: 'Hyderabad',
    state: 'Telangana',
    postalCode: '500081',
    country: 'India',
    phone: '+919876543210',
  };

  // =========================================================================
  // 1. Empty/Default Profile
  // =========================================================================
  await t.test('1. Empty/default profile contains default weights and empty lists', () => {
    const profile = profileStore.getProfile(userId);
    assert.equal(profile.userId, userId);
    assert.deepEqual(profile.shopping.preferredBrands, []);
    assert.deepEqual(profile.shopping.excludedBrands, []);
    assert.equal(profile.general.rankingPriority, 'balanced');
    assert.equal(profile.travel.preferredDepartureTimeWindow, 'any');
    assert.equal(profile.shopping.priorityWeights.price, 0.25);
    assert.equal(profile.shopping.priorityWeights.quality, 0.25);
    assert.equal(profile.shopping.priorityWeights.performance, 0.25);
    assert.equal(profile.shopping.priorityWeights.brand, 0.25);
  });

  // =========================================================================
  // 2. Adding a Preferred Brand
  // =========================================================================
  await t.test('2. Adding a preferred brand normalizes and stores cleanly', () => {
    const updated = profileStore.addPreferredBrand(userId, 'ASUS');
    assert.ok(updated.shopping.preferredBrands.includes('ASUS'));

    // Duplicate check
    const dup = profileStore.addPreferredBrand(userId, 'asus');
    assert.equal(dup.shopping.preferredBrands.filter((b) => b.toLowerCase() === 'asus').length, 1);
  });

  // =========================================================================
  // 3. Excluding a Brand
  // =========================================================================
  await t.test('3. Excluding a brand adds to excluded and removes from preferred', () => {
    // First add Lenovo as preferred
    profileStore.addPreferredBrand(userId, 'Lenovo');
    assert.ok(profileStore.getProfile(userId).shopping.preferredBrands.includes('Lenovo'));

    // Now exclude Lenovo
    const excluded = profileStore.addExcludedBrand(userId, 'Lenovo');
    assert.ok(excluded.shopping.excludedBrands.includes('Lenovo'));
    assert.ok(!excluded.shopping.preferredBrands.includes('Lenovo'), 'Excluded brand must be removed from preferred');
  });

  // =========================================================================
  // 4. Price Priority
  // =========================================================================
  await t.test('4. Price priority updates general priority and shifts priority weights', () => {
    const updated = profileStore.setRankingPriority(userId, 'lowest_price');
    assert.equal(updated.general.rankingPriority, 'lowest_price');
    assert.equal(updated.shopping.priorityWeights.price, 0.5);
    assert.equal(updated.shopping.priorityWeights.brand, 0.2);
  });

  // =========================================================================
  // 5. Quality Priority
  // =========================================================================
  await t.test('5. Quality priority updates general priority and shifts weights towards quality', () => {
    const updated = profileStore.setRankingPriority(userId, 'highest_quality');
    assert.equal(updated.general.rankingPriority, 'highest_quality');
    assert.equal(updated.shopping.priorityWeights.quality, 0.4);
    assert.equal(updated.shopping.priorityWeights.price, 0.15);
  });

  // =========================================================================
  // 6. Travel Departure Preference
  // =========================================================================
  await t.test('6. Travel departure preference window stores correctly', () => {
    const updated = profileStore.setDepartureTimeWindow(userId, 'morning');
    assert.equal(updated.travel.preferredDepartureTimeWindow, 'morning');
  });

  // =========================================================================
  // 7. Explicit Preference Detection
  // =========================================================================
  await t.test('7. Explicit preference commands are detected as PREFERENCE_UPDATE', async () => {
    const testCases = [
      { msg: 'I prefer ASUS', action: 'ADD_PREFERRED_BRAND', brand: 'ASUS' },
      { msg: "I don't like Lenovo", action: 'ADD_EXCLUDED_BRAND', brand: 'Lenovo' },
      { msg: "Don't show me HP", action: 'ADD_EXCLUDED_BRAND', brand: 'HP' },
      { msg: 'Prefer morning departures', action: 'SET_DEPARTURE_WINDOW', window: 'morning' },
      { msg: 'I usually want the cheapest option', action: 'SET_RANKING_PRIORITY', priority: 'lowest_price' },
      { msg: 'Prioritize price', action: 'SET_RANKING_PRIORITY', priority: 'lowest_price' },
      { msg: 'Prioritize quality', action: 'SET_RANKING_PRIORITY', priority: 'highest_quality' },
    ];

    for (const tc of testCases) {
      const res = await llmService.classifyIntent(tc.msg);
      assert.equal(res.intent, 'PREFERENCE_UPDATE', `Expected "${tc.msg}" to be classified as PREFERENCE_UPDATE`);

      const cmd = llmService.extractPreferenceUpdate(tc.msg);
      assert.ok(cmd, `Should extract command for "${tc.msg}"`);
      assert.equal(cmd?.action, tc.action);
      if (tc.brand) assert.equal(cmd?.brand, tc.brand);
      if (tc.priority) assert.equal(cmd?.priority, tc.priority);
      if (tc.window) assert.equal(cmd?.departureWindow, tc.window);
    }
  });

  // =========================================================================
  // 8. Non-Explicit Search Not Creating a Permanent Preference
  // =========================================================================
  await t.test('8. Non-explicit search queries are NOT classified as PREFERENCE_UPDATE', async () => {
    const searchQueries = [
      'Find ASUS laptops',
      'Search for ASUS gaming laptops under 80000',
      'Show me Lenovo thinkpad',
      'Get ASUS ROG Strix under 100000',
    ];

    for (const sq of searchQueries) {
      const res = await llmService.classifyIntent(sq);
      assert.notEqual(res.intent, 'PREFERENCE_UPDATE', `"${sq}" must NOT be classified as PREFERENCE_UPDATE`);
      assert.equal(res.intent, 'PRODUCT_SEARCH', `"${sq}" should be classified as PRODUCT_SEARCH`);
    }
  });

  // =========================================================================
  // 9. Preference Persistence Across Conversation Turns
  // =========================================================================
  await t.test('9. Preference persists across conversation turns and influences future queries', async () => {
    const turnConvId = `conv_turns_${Date.now()}`;
    const testTurnUser = `turn_user_${Date.now()}`;
    profileStore.clearProfile(testTurnUser);

    // Turn 1: Search laptops
    const res1 = await orchestrator.processMessage({
      conversationId: turnConvId,
      message: 'Find me a gaming laptop under ₹90,000',
      userId: testTurnUser,
    });
    assert.equal(res1.agentState.intent, 'PRODUCT_SEARCH');

    // Turn 2: User states explicit brand preference
    const res2 = await orchestrator.processMessage({
      conversationId: turnConvId,
      message: 'I prefer ASUS',
      userId: testTurnUser,
    });
    assert.equal(res2.agentState.intent, 'PREFERENCE_UPDATE');
    assert.ok(res2.userProfile?.shopping.preferredBrands.includes('ASUS'));

    // Turn 3: User performs a new search; check that preferences are active
    const res3 = await orchestrator.processMessage({
      conversationId: turnConvId,
      message: 'Find laptops under ₹85,000',
      userId: testTurnUser,
    });
    assert.equal(res3.agentState.intent, 'PRODUCT_SEARCH');
    assert.ok(res3.userProfile?.shopping.preferredBrands.includes('ASUS'));

    // Top recommended product should reflect ASUS boost if ASUS laptop available
    if (res3.recommendations && res3.recommendations.length > 0) {
      const asusRec = res3.recommendations.find((r: any) => r.item.brand === 'ASUS');
      if (asusRec) {
        assert.equal(asusRec.personalizationApplied, true);
        assert.ok(asusRec.whyThisText.includes('ASUS'));
      }
    }
  });

  // =========================================================================
  // 10. Preference Influence on Ranking
  // =========================================================================
  await t.test('10. Preferred brand receives ranking boost and explainable rationale', () => {
    const mockProducts: NormalizedProduct[] = [
      {
        id: 'prod-acer',
        title: 'Acer Nitro 5 Gaming Laptop',
        brand: 'Acer',
        category: 'laptops',
        price: { amount: 65000, currency: 'INR' },
        rating: 4.5,
        reviewCount: 200,
        availability: 'In Stock',
        specifications: { gpu: 'RTX 3050', cpu: 'Ryzen 5', ram: '16GB' },
        provider: { id: 'amazon', name: 'Amazon' },
      },
      {
        id: 'prod-asus',
        title: 'ASUS TUF Gaming A15',
        brand: 'ASUS',
        category: 'laptops',
        price: { amount: 67000, currency: 'INR' },
        rating: 4.5,
        reviewCount: 200,
        availability: 'In Stock',
        specifications: { gpu: 'RTX 3050', cpu: 'Ryzen 5', ram: '16GB' },
        provider: { id: 'amazon', name: 'Amazon' },
      },
    ];

    const reqs: SearchRequirements = {
      category: 'electronics',
      budget: { max: 70000, currency: 'INR' },
    };

    // Ranking without profile
    const unpersonalized = RankingEngine.rankProducts(mockProducts, reqs);
    // Ranking with ASUS preferred
    const asusProfile = profileStore.getProfile('temp_user');
    asusProfile.shopping.preferredBrands = ['ASUS'];
    const personalized = RankingEngine.rankProducts(mockProducts, reqs, '', asusProfile);

    const asusUnpers = unpersonalized.find((r) => r.item.brand === 'ASUS')!;
    const asusPers = personalized.find((r) => r.item.brand === 'ASUS')!;

    // Score with personalization must be higher due to preferred brand boost
    assert.ok(
      asusPers.overallScore > asusUnpers.overallScore,
      `Personalized score (${asusPers.overallScore}) must be higher than unpersonalized (${asusUnpers.overallScore})`
    );
    assert.equal(asusPers.personalizationApplied, true);
    assert.ok(asusPers.whyThisText.toLowerCase().includes('asus'));
    assert.ok(asusPers.whyThisText.toLowerCase().includes('preferred'));
  });

  // =========================================================================
  // 11. Verification Taking Priority Over Personalization
  // =========================================================================
  await t.test('11. Verification failure blocks execution even for preferred brand', async () => {
    const unverifiedAsusProduct: NormalizedProduct = {
      id: 'asus-unverified',
      title: 'ASUS ROG Zephyrus G14',
      brand: 'ASUS',
      category: 'laptops',
      price: { amount: 85000, currency: 'INR' },
      rating: 4.8,
      reviewCount: 150,
      availability: 'In Stock',
      provider: { id: 'test_provider', name: 'Test Seller' },
    };

    const mockRec: RecommendationResult = {
      resultId: 'rec-unverified',
      rank: 1,
      overallScore: 98,
      item: unverifiedAsusProduct,
      whyThisText: 'Recommended because it matches your preferred ASUS brand.',
      pros: ['Matches preferred brand: ASUS'],
      cons: [],
      matchedRequirements: ['budget', 'brand'],
      scoreBreakdown: [],
      personalizationApplied: true,
      personalizationReason: 'Matches preferred ASUS brand',
      verification: {
        priceVerified: false,
        availabilityVerified: false,
        providerVerified: false,
        status: 'FAILED',
        issues: ['Merchant price endpoint unreachable'],
      },
    };

    const prepResult = ExecutionPreparer.prepareProductOrder(
      mockRec,
      validContact,
      validDelivery
    );

    assert.equal(
      prepResult.success,
      false,
      'Safety gate MUST block execution preparation if item failed verification, despite brand preference'
    );
    assert.ok(
      prepResult.errorCode === 'VERIFICATION_FAILED' || prepResult.errorCode === 'ITEM_NOT_VERIFIED',
      `Expected verification failure code, got ${prepResult.errorCode}`
    );
  });

  // =========================================================================
  // 12. Availability Taking Priority Over Personalization
  // =========================================================================
  await t.test('12. Unavailable items cannot proceed to confirmation even for preferred brand', async () => {
    const outOfStockAsus: NormalizedProduct = {
      id: 'asus-oos',
      title: 'ASUS Out Of Stock Edition',
      brand: 'ASUS',
      category: 'laptops',
      price: { amount: 80000, currency: 'INR' },
      rating: 4.9,
      reviewCount: 300,
      availability: 'Out of Stock',
      provider: { id: 'test_provider', name: 'Test Seller' },
    };

    const mockRec: RecommendationResult = {
      resultId: 'rec-oos',
      rank: 1,
      overallScore: 99,
      item: outOfStockAsus,
      whyThisText: 'Recommended because it matches your preferred ASUS brand.',
      pros: ['Matches preferred brand: ASUS'],
      cons: ['Currently Out of Stock'],
      matchedRequirements: ['brand'],
      scoreBreakdown: [],
      personalizationApplied: true,
      personalizationReason: 'Matches preferred ASUS brand',
      verification: {
        priceVerified: true,
        availabilityVerified: false,
        providerVerified: true,
        status: 'UNAVAILABLE',
        availabilityStatus: 'OUT_OF_STOCK',
        issues: ['Item is currently out of stock with supplier'],
      },
    };

    const prepResult = ExecutionPreparer.prepareProductOrder(
      mockRec,
      validContact,
      validDelivery
    );

    assert.equal(
      prepResult.success,
      false,
      'Execution preparation MUST block out-of-stock items, regardless of user preference'
    );
    assert.equal(prepResult.errorCode, 'ITEM_UNAVAILABLE');
  });

  // =========================================================================
  // 13. Clearing Preferences
  // =========================================================================
  await t.test('13. Clearing preferences resets profile to default values', () => {
    const clearUser = `clear_user_${Date.now()}`;
    profileStore.addPreferredBrand(clearUser, 'Sony');
    profileStore.setRankingPriority(clearUser, 'lowest_price');
    profileStore.setDepartureTimeWindow(clearUser, 'morning');

    const reset = profileStore.clearProfile(clearUser);
    assert.deepEqual(reset.shopping.preferredBrands, []);
    assert.equal(reset.general.rankingPriority, 'balanced');
    assert.equal(reset.travel.preferredDepartureTimeWindow, 'any');
    assert.equal(reset.shopping.priorityWeights.price, 0.25);
  });

  // =========================================================================
  // 14. Removing Individual Preferences
  // =========================================================================
  await t.test('14. Removing individual preference entries works cleanly', () => {
    const removeUser = `remove_user_${Date.now()}`;
    profileStore.addPreferredBrand(removeUser, 'Apple');
    profileStore.addPreferredBrand(removeUser, 'Samsung');

    const updated = profileStore.removePreferredBrand(removeUser, 'Apple');
    assert.ok(!updated.shopping.preferredBrands.includes('Apple'));
    assert.ok(updated.shopping.preferredBrands.includes('Samsung'));
  });

  // =========================================================================
  // 15. No Financial Credentials Stored in Profile (Strict Sanitization)
  // =========================================================================
  await t.test('15. Security Invariant: Financial credentials strictly rejected from profile storage', () => {
    const secUser = `sec_user_${Date.now()}`;

    // Attempt to inject sensitive keys into profile
    const maliciousPayload: any = {
      card_number: '4111 2222 3333 4444',
      cvv: '123',
      upi_pin: '9876',
      otp: '654321',
      banking_password: 'super_secret_pw',
      shopping: {
        preferredBrands: ['ASUS'],
        credit_card: '5500 0000 0000 0004',
        pin: '1234',
      },
    };

    const saved = profileStore.updateProfile(secUser, maliciousPayload);

    // Verify prohibited keys are absent
    assert.equal((saved as any).card_number, undefined);
    assert.equal((saved as any).cvv, undefined);
    assert.equal((saved as any).upi_pin, undefined);
    assert.equal((saved as any).otp, undefined);
    assert.equal((saved as any).banking_password, undefined);
    assert.equal((saved.shopping as any).credit_card, undefined);
    assert.equal((saved.shopping as any).pin, undefined);

    // Legitimate fields should be preserved
    assert.ok(saved.shopping.preferredBrands.includes('ASUS'));
  });
});
