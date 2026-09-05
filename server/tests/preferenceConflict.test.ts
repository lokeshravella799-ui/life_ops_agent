import test from 'node:test';
import assert from 'node:assert/strict';
import { profileStore } from '../personalization/profileStore';
import { sessionPreferenceStore } from '../personalization/sessionPreferenceStore';
import { preferenceConflictDetector } from '../personalization/conflictDetector';
import { proactiveRelaxationGenerator } from '../personalization/relaxationGenerator';
import { orchestrator } from '../agent/orchestrator';
import { contextManager } from '../agent/contextManager';
import { RankingEngine } from '../comparison/rankingEngine';
import { ExecutionPreparer } from '../execution/executionPreparer';
import type { NormalizedProduct } from '../types/provider';
import type { SearchRequirements } from '../types/agent';
import type { RecommendationResult } from '../comparison/types';

test('LifeOps Proactive Multi-Turn Memory & Preference Conflict Resolution - Step 2 Test Suite', async (t) => {
  const baseUserId = `test_conflict_user_${Date.now()}`;
  profileStore.clearProfile(baseUserId);

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
  // 1. Global Preference Persists Across Turns
  // =========================================================================
  await t.test('1. Global preference persists across turns and updates ranking priority without destroying brand', async () => {
    const convId = `conv_turn_persist_${Date.now()}`;
    const userId = `${baseUserId}_1`;
    profileStore.clearProfile(userId);

    // Turn 1: "I prefer ASUS laptops."
    const turn1 = await orchestrator.processMessage({
      conversationId: convId,
      message: 'I prefer ASUS laptops',
      userId,
    });
    assert.equal(turn1.agentState.intent, 'PREFERENCE_UPDATE');
    const profileAfter1 = profileStore.getProfile(userId);
    assert.ok(profileAfter1.shopping.preferredBrands.includes('ASUS'));

    // Turn 2: "Find me a gaming laptop under ₹70,000."
    const turn2 = await orchestrator.processMessage({
      conversationId: convId,
      message: 'Find me a gaming laptop under ₹70,000',
      userId,
    });
    assert.equal(turn2.agentState.intent, 'PRODUCT_SEARCH');
    assert.ok(turn2.effectivePreferences?.shopping.preferredBrands.includes('ASUS'));

    // Turn 3: "I want something cheap."
    const turn3 = await orchestrator.processMessage({
      conversationId: convId,
      message: 'I want something cheap',
      userId,
    });
    assert.equal(turn3.agentState.intent, 'PREFERENCE_UPDATE');
    const profileAfter3 = profileStore.getProfile(userId);
    assert.equal(profileAfter3.general.rankingPriority, 'lowest_price');
    // ASUS brand must NOT be destroyed
    assert.ok(profileAfter3.shopping.preferredBrands.includes('ASUS'));

    // Turn 4: "Actually prioritize performance."
    const turn4 = await orchestrator.processMessage({
      conversationId: convId,
      message: 'Actually prioritize performance',
      userId,
    });
    assert.equal(turn4.agentState.intent, 'PREFERENCE_UPDATE');
    const profileAfter4 = profileStore.getProfile(userId);
    assert.equal(profileAfter4.general.rankingPriority, 'highest_quality');
    // ASUS brand must still remain intact
    assert.ok(profileAfter4.shopping.preferredBrands.includes('ASUS'));
  });

  // =========================================================================
  // 2. Session Preference Applies Only to Current Session
  // =========================================================================
  await t.test('2. Session preference applies only to current session without leaking to other sessions', () => {
    const sessionA = `session_a_${Date.now()}`;
    const sessionB = `session_b_${Date.now()}`;
    const userId = `${baseUserId}_2`;
    profileStore.clearProfile(userId);

    // Apply session preference to session A
    sessionPreferenceStore.applyCommand(sessionA, {
      action: 'SET_DEPARTURE_WINDOW',
      departureWindow: 'morning',
      scope: 'session',
    });

    const prefsA = sessionPreferenceStore.getSessionPreferences(sessionA);
    assert.equal(prefsA.preferredDepartureTimeWindow, 'morning');

    const effectiveA = sessionPreferenceStore.computeEffectivePreferences(
      profileStore.getProfile(userId),
      prefsA
    );
    assert.equal(effectiveA.travel.preferredDepartureTimeWindow, 'morning');

    // Session B must retain the global default ('any')
    const prefsB = sessionPreferenceStore.getSessionPreferences(sessionB);
    assert.equal(prefsB.preferredDepartureTimeWindow, undefined);

    const effectiveB = sessionPreferenceStore.computeEffectivePreferences(
      profileStore.getProfile(userId),
      prefsB
    );
    assert.equal(effectiveB.travel.preferredDepartureTimeWindow, 'any');
  });

  // =========================================================================
  // 3. Current-Turn Hard Constraint Overrides Global Preference
  // =========================================================================
  await t.test('3. Current-turn hard constraint overrides global preference', () => {
    const userId = `${baseUserId}_3`;
    profileStore.clearProfile(userId);
    profileStore.addPreferredBrand(userId, 'ASUS');

    const mockProducts: NormalizedProduct[] = [
      {
        id: 'p-asus',
        title: 'ASUS TUF Gaming A15',
        brand: 'ASUS',
        category: 'laptops',
        price: { amount: 65000, currency: 'INR' },
        rating: 4.5,
        reviewCount: 150,
        availability: 'In Stock',
        provider: { id: 'amazon', name: 'Amazon' },
      },
      {
        id: 'p-lenovo',
        title: 'Lenovo LOQ Gaming Laptop',
        brand: 'Lenovo',
        category: 'laptops',
        price: { amount: 64000, currency: 'INR' },
        rating: 4.6,
        reviewCount: 120,
        availability: 'In Stock',
        provider: { id: 'amazon', name: 'Amazon' },
      },
    ];

    // Current turn has hard exclusion: "No ASUS"
    const reqs: SearchRequirements = {
      category: 'electronics',
      budget: { max: 70000, currency: 'INR' },
      keywords: ['laptop', 'exclude', 'asus'],
      constraints: { excludedBrands: ['ASUS'] },
    };

    const sessionPrefs = sessionPreferenceStore.getSessionPreferences('sess_hard_constraint');
    sessionPrefs.excludedBrands = ['ASUS'];

    const effective = sessionPreferenceStore.computeEffectivePreferences(
      profileStore.getProfile(userId),
      sessionPrefs,
      reqs
    );

    // Filter results with hard constraint
    const eligible = mockProducts.filter(
      (p) => !effective.shopping.excludedBrands?.some((b) => b.toLowerCase() === p.brand.toLowerCase())
    );

    assert.equal(eligible.length, 1);
    assert.equal(eligible[0].brand, 'Lenovo');
    assert.ok(!eligible.some((p) => p.brand === 'ASUS'));
  });

  // =========================================================================
  // 4. Current-Turn Preference Overrides Persisted Preference When Appropriate
  // =========================================================================
  await t.test('4. Current-turn preference overrides persisted preference when appropriate', () => {
    const userId = `${baseUserId}_4`;
    profileStore.clearProfile(userId);
    profileStore.setRankingPriority(userId, 'balanced');

    const currentReqs: SearchRequirements = {
      category: 'electronics',
      sortPreference: 'cheapest',
      budget: { max: 70000, currency: 'INR' },
    };

    const effective = sessionPreferenceStore.computeEffectivePreferences(
      profileStore.getProfile(userId),
      undefined,
      currentReqs
    );

    // Current turn requested cheapest -> effective ranking priority should be lowest_price
    assert.equal(effective.general.rankingPriority, 'lowest_price');
    assert.equal(effective.shopping.priorityWeights.price, 0.50);
    // Global profile remains untouched
    assert.equal(profileStore.getProfile(userId).general.rankingPriority, 'balanced');
  });

  // =========================================================================
  // 5. Conflicting Preferences Are Detected
  // =========================================================================
  await t.test('5. Conflicting preferences are accurately detected into PreferenceConflict model', () => {
    const userId = `${baseUserId}_5`;
    profileStore.clearProfile(userId);
    profileStore.addPreferredBrand(userId, 'ASUS');
    profileStore.addPreferredBrand(userId, 'Apple');
    profileStore.setDepartureTimeWindow(userId, 'morning');
    profileStore.updateProfile(userId, { shopping: { maxPrice: 50000 } as any });

    const profile = profileStore.getProfile(userId);

    // Case A: Direct Brand Contradiction ("No ASUS")
    const brandContradictionReqs: SearchRequirements = {
      keywords: ['laptop', 'no', 'asus'],
    };
    const conflictsA = preferenceConflictDetector.detectConflicts(brandContradictionReqs, profile);
    const brandConflict = conflictsA.find((c) => c.field === 'brand' && c.existingValue === 'ASUS');
    assert.ok(brandConflict);
    assert.equal(brandConflict.severity, 'high');
    assert.equal(brandConflict.resolutionRequired, true);

    // Case B: Apple Saved + Cheapest Gaming Laptop Request
    const appleCheapGamingReqs: SearchRequirements = {
      category: 'gaming laptops',
      sortPreference: 'cheapest',
      keywords: ['gaming', 'laptop', 'cheap'],
      budget: { max: 60000, currency: 'INR' },
    };
    const conflictsB = preferenceConflictDetector.detectConflicts(appleCheapGamingReqs, profile);
    const appleConflict = conflictsB.find((c) => c.existingValue === 'Apple');
    assert.ok(appleConflict);
    assert.equal(appleConflict.severity, 'high');
    assert.equal(appleConflict.resolutionRequired, true);
    assert.ok(appleConflict.suggestedClarification.includes('Apple'));

    // Case C: Budget Conflict (Saved ₹50,000 vs current turn ₹80,000)
    const budgetReqs: SearchRequirements = {
      budget: { max: 80000, currency: 'INR' },
    };
    const conflictsC = preferenceConflictDetector.detectConflicts(budgetReqs, profile);
    const budgetConflict = conflictsC.find((c) => c.field === 'price');
    assert.ok(budgetConflict);
    assert.equal(budgetConflict.existingValue, 50000);
    assert.equal(budgetConflict.newValue, 80000);

    // Case D: Departure Time Conflict (Saved morning vs current departure after 18:00)
    const departureReqs: SearchRequirements = {
      departureAfter: '20:00',
    };
    const conflictsD = preferenceConflictDetector.detectConflicts(departureReqs, profile);
    const depConflict = conflictsD.find((c) => c.field === 'departure_window');
    assert.ok(depConflict);
    assert.equal(depConflict.existingValue, 'morning');
    assert.equal(depConflict.newValue, 'evening');
  });

  // =========================================================================
  // 6. Conflict Clarification Does Not Execute Anything
  // =========================================================================
  await t.test('6. Conflict clarification halts execution safely and returns interactive trade-off options', async () => {
    const convId = `conv_clarify_${Date.now()}`;
    const userId = `${baseUserId}_6`;
    profileStore.clearProfile(userId);
    profileStore.addPreferredBrand(userId, 'Apple');

    const res = await orchestrator.processMessage({
      conversationId: convId,
      message: 'Find me the cheapest gaming laptop under ₹60,000',
      userId,
    });

    assert.equal(res.agentState.phase, 'USER_REVIEW');
    assert.equal(res.requiresClarification, true);
    assert.ok(res.preferenceConflicts && res.preferenceConflicts.length > 0);
    assert.ok(res.message.includes('Apple') && res.message.includes('lowest price'));

    // Execution safety invariants: NO tools executed, NO preparation performed
    assert.equal(res.executionStatus, undefined);
    assert.equal(res.confirmationRequired, undefined);
    assert.equal((res as any).executionPreparation, undefined);
    assert.ok(!res.normalizedResults || res.normalizedResults.length === 0);
  });

  // =========================================================================
  // 7. Explicit Conflict Resolution Updates Only the Intended Scope
  // =========================================================================
  await t.test('7. Explicit conflict resolution updates only the intended scope without mutating global profile', async () => {
    const convId = `conv_resolve_scope_${Date.now()}`;
    const userId = `${baseUserId}_7`;
    profileStore.clearProfile(userId);
    profileStore.addPreferredBrand(userId, 'Apple');

    // Trigger conflict
    const turn1 = await orchestrator.processMessage({
      conversationId: convId,
      message: 'Find me the cheapest gaming laptop under ₹60,000',
      userId,
    });
    assert.equal(turn1.requiresClarification, true);

    // Resolve conflict with session-scoped choice: "Prioritize price for this search"
    const turn2 = await orchestrator.processMessage({
      conversationId: convId,
      message: 'Prioritize price for this search',
      userId,
    });

    assert.ok(turn2.message.includes('Resolved preference'));
    // Session preferences must reflect the choice
    assert.equal(turn2.activeSessionPreferences?.rankingPriority, 'lowest_price');

    // Global profile MUST remain intact (Apple still preferred globally)
    const globalProfile = profileStore.getProfile(userId);
    assert.ok(globalProfile.shopping.preferredBrands.includes('Apple'));
  });

  // =========================================================================
  // 8. "Only for this search" Does Not Modify Global Profile
  // =========================================================================
  await t.test('8. "Only for this search" modifies session state but does not modify global profile', async () => {
    const convId = `conv_only_search_${Date.now()}`;
    const userId = `${baseUserId}_8`;
    profileStore.clearProfile(userId);
    profileStore.setRankingPriority(userId, 'balanced');

    const res = await orchestrator.processMessage({
      conversationId: convId,
      message: 'Only for this search, choose the cheapest',
      userId,
    });

    assert.equal(res.agentState.intent, 'PREFERENCE_UPDATE');
    assert.equal(res.activeSessionPreferences?.rankingPriority, 'lowest_price');

    // Persistent profile must still be 'balanced'
    const profile = profileStore.getProfile(userId);
    assert.equal(profile.general.rankingPriority, 'balanced');
  });

  // =========================================================================
  // 9. "For this trip" Does Not Modify Global Profile
  // =========================================================================
  await t.test('9. "For this trip" modifies session state but does not modify global profile', async () => {
    const convId = `conv_for_trip_${Date.now()}`;
    const userId = `${baseUserId}_9`;
    profileStore.clearProfile(userId);
    profileStore.setDepartureTimeWindow(userId, 'any');

    const res = await orchestrator.processMessage({
      conversationId: convId,
      message: 'For this trip, prefer morning departures',
      userId,
    });

    assert.equal(res.agentState.intent, 'PREFERENCE_UPDATE');
    assert.equal(res.activeSessionPreferences?.preferredDepartureTimeWindow, 'morning');

    // Persistent profile must still be 'any'
    const profile = profileStore.getProfile(userId);
    assert.equal(profile.travel.preferredDepartureTimeWindow, 'any');
  });

  // =========================================================================
  // 10. Zero Verified Inventory Produces Relaxation Suggestions
  // =========================================================================
  await t.test('10. Zero verified inventory produces grounded relaxation suggestions', () => {
    const userId = `${baseUserId}_10`;
    const profile = profileStore.getProfile(userId);
    profile.shopping.preferredBrands = ['ASUS'];

    const effective = sessionPreferenceStore.computeEffectivePreferences(profile);
    const reqs: SearchRequirements = {
      category: 'laptops',
      budget: { max: 40000, currency: 'INR' },
    };

    const closeMatches = [
      { id: '1', title: 'ASUS Vivobook 15', brand: 'ASUS', price: { amount: 48000, currency: 'INR' } },
      { id: '2', title: 'Acer Aspire 5', brand: 'Acer', price: { amount: 39000, currency: 'INR' } },
    ];

    const result = proactiveRelaxationGenerator.generateRelaxations(reqs, effective, 2, closeMatches);

    assert.ok(result.options.length >= 2);
    const budgetOpt = result.options.find((o) => o.type === 'INCREASE_BUDGET');
    const brandOpt = result.options.find((o) => o.type === 'ALLOW_OTHER_BRANDS');

    assert.ok(budgetOpt, 'Should suggest increasing budget');
    assert.ok(brandOpt, 'Should suggest allowing other brands');
    assert.ok(result.formattedMessage.includes('Increase budget'));
  });

  // =========================================================================
  // 11. Relaxation is Never Automatic
  // =========================================================================
  await t.test('11. Relaxation is never automatic: zero verified results pause and await user decision', async () => {
    const convId = `conv_never_auto_${Date.now()}`;
    const userId = `${baseUserId}_11`;
    profileStore.clearProfile(userId);
    profileStore.addPreferredBrand(userId, 'ASUS');

    // Impossible price constraint for ASUS gaming laptop
    const res = await orchestrator.processMessage({
      conversationId: convId,
      message: 'Find me an ASUS gaming laptop under ₹10,000',
      userId,
    });

    assert.equal(res.hasMatches, false);
    assert.equal(res.resultCount, 0);
    assert.ok(res.recommendations?.length === 0);
    assert.ok(res.relaxationOptions && res.relaxationOptions.length > 0);
    // Crucial: The agent did NOT automatically purchase, prepare, or widen budget without asking
    assert.equal(res.executionStatus, undefined);
  });

  // =========================================================================
  // 12. User Can Explicitly Accept a Relaxation
  // =========================================================================
  await t.test('12. User can explicitly accept a proactive relaxation option', async () => {
    const convId = `conv_accept_relax_${Date.now()}`;
    const userId = `${baseUserId}_12`;
    profileStore.clearProfile(userId);
    profileStore.addPreferredBrand(userId, 'ASUS');

    // Turn 1: Zero result query
    const res1 = await orchestrator.processMessage({
      conversationId: convId,
      message: 'Find me an ASUS gaming laptop under ₹40,000',
      userId,
    });
    assert.equal(res1.hasMatches, false);
    assert.ok(res1.relaxationOptions && res1.relaxationOptions.length > 0);

    // Turn 2: User explicitly accepts relaxation by asking to increase the budget
    const res2 = await orchestrator.processMessage({
      conversationId: convId,
      message: 'Increase the budget',
      userId,
    });

    assert.equal(res2.hasMatches, true);
    assert.ok(res2.recommendations && res2.recommendations.length > 0);
    assert.ok(res2.message.includes('relaxed requirements') || res2.message.includes('Found'));
  });

  // =========================================================================
  // 13. User Can Reject a Relaxation
  // =========================================================================
  await t.test('13. User can explicitly reject a proactive relaxation option', async () => {
    const convId = `conv_reject_relax_${Date.now()}`;
    const userId = `${baseUserId}_13`;
    profileStore.clearProfile(userId);
    profileStore.addPreferredBrand(userId, 'ASUS');

    // Turn 1: Zero result query
    const res1 = await orchestrator.processMessage({
      conversationId: convId,
      message: 'Find me an ASUS gaming laptop under ₹40,000',
      userId,
    });
    assert.equal(res1.hasMatches, false);
    assert.ok(res1.relaxationOptions && res1.relaxationOptions.length > 0);

    // Turn 2: User rejects relaxation
    const res2 = await orchestrator.processMessage({
      conversationId: convId,
      message: 'No, keep my constraints',
      userId,
    });

    assert.equal(res2.agentState.phase, 'USER_REVIEW');
    assert.ok(res2.message.includes('not relax'));
    const ctx = contextManager.getContext(convId);
    assert.equal(ctx.relaxationOptions, undefined);
  });

  // =========================================================================
  // 14. Ranking Reflects Resolved Preferences
  // =========================================================================
  await t.test('14. Ranking reflects resolved preferences accurately', () => {
    const mockProducts: NormalizedProduct[] = [
      {
        id: 'p-acer',
        title: 'Acer Nitro 5 Gaming Laptop',
        brand: 'Acer',
        category: 'laptops',
        price: { amount: 65000, currency: 'INR' },
        rating: 4.5,
        reviewCount: 200,
        availability: 'In Stock',
        specifications: { gpu: 'RTX 3050', ram: '16GB', cpu: 'Ryzen 5' },
        provider: { id: 'amazon', name: 'Amazon' },
      },
      {
        id: 'p-lenovo',
        title: 'Lenovo Legion 5 Gaming Laptop',
        brand: 'Lenovo',
        category: 'laptops',
        price: { amount: 67000, currency: 'INR' },
        rating: 4.5,
        reviewCount: 200,
        availability: 'In Stock',
        specifications: { gpu: 'RTX 3050', ram: '16GB', cpu: 'Ryzen 5' },
        provider: { id: 'amazon', name: 'Amazon' },
      },
    ];

    const reqs: SearchRequirements = {
      category: 'laptops',
      budget: { max: 70000, currency: 'INR' },
    };

    // Baseline ranking (no session override)
    const baseline = RankingEngine.rankProducts(mockProducts, reqs);

    // Ranking with session override preferring Lenovo
    const sessionPrefs: SessionPreferences = {
      conversationId: 'sess_ranking',
      preferredBrands: ['Lenovo'],
      updatedAt: new Date().toISOString(),
    };
    const effective = sessionPreferenceStore.computeEffectivePreferences(
      profileStore.getProfile('temp_user'),
      sessionPrefs
    );

    const rankedWithSession = RankingEngine.rankProducts(
      mockProducts,
      reqs,
      '',
      effective as any
    );

    const lenovoRec = rankedWithSession.find((r) => r.item.brand === 'Lenovo')!;
    const acerRec = rankedWithSession.find((r) => r.item.brand === 'Acer')!;

    assert.ok(lenovoRec.overallScore > acerRec.overallScore);
    assert.equal(lenovoRec.personalizationApplied, true);
    assert.ok(lenovoRec.personalizationReason?.includes('Lenovo'));
  });

  // =========================================================================
  // 15. Rationale Explains Preference Resolution
  // =========================================================================
  await t.test('15. Rationale explains preference resolution transparently', () => {
    const mockProducts: NormalizedProduct[] = [
      {
        id: 'p-budget',
        title: 'Budget Gaming Laptop',
        brand: 'HP',
        category: 'laptops',
        price: { amount: 52000, currency: 'INR' },
        rating: 4.4,
        reviewCount: 100,
        availability: 'In Stock',
        specifications: { gpu: 'RTX 3050', ram: '16GB', cpu: 'Core i5' },
        provider: { id: 'amazon', name: 'Amazon' },
      },
    ];

    const reqs: SearchRequirements = {
      category: 'laptops',
      sortPreference: 'cheapest',
      budget: { max: 60000, currency: 'INR' },
    };

    const sessionPrefs: SessionPreferences = {
      conversationId: 'sess_rationale',
      rankingPriority: 'lowest_price',
      updatedAt: new Date().toISOString(),
    };
    const effective = sessionPreferenceStore.computeEffectivePreferences(
      profileStore.getProfile('temp_user'),
      sessionPrefs,
      reqs
    );

    const ranked = RankingEngine.rankProducts(
      mockProducts,
      reqs,
      '',
      effective as any
    );

    const topPick = ranked[0];
    assert.ok(topPick.whyThisText);
    assert.ok(
      topPick.whyThisText.toLowerCase().includes('price') ||
      topPick.whyThisText.toLowerCase().includes('budget') ||
      topPick.whyThisText.toLowerCase().includes('lowest')
    );
  });

  // =========================================================================
  // 16. Verification Still Overrides Personalization
  // =========================================================================
  await t.test('16. Safety Invariant: Verification failure blocks confirmation even for preferred brands', async () => {
    const failedVerificationProduct: NormalizedProduct = {
      id: 'asus-failed-ver',
      title: 'ASUS ROG Strix G16',
      brand: 'ASUS',
      category: 'laptops',
      price: { amount: 85000, currency: 'INR' },
      rating: 4.8,
      reviewCount: 120,
      availability: 'In Stock',
      provider: { id: 'test_provider', name: 'Test Provider' },
    };

    const mockRec: RecommendationResult = {
      resultId: 'rec-fail-ver',
      rank: 1,
      overallScore: 99,
      item: failedVerificationProduct,
      whyThisText: 'Matches your preferred ASUS brand',
      pros: ['ASUS preferred brand'],
      cons: [],
      matchedRequirements: ['brand'],
      scoreBreakdown: [],
      personalizationApplied: true,
      personalizationReason: 'Matches preferred ASUS brand',
      verification: {
        priceVerified: false,
        availabilityVerified: true,
        providerVerified: true,
        status: 'FAILED',
        issues: ['Merchant live price mismatch'],
      },
    };

    const result = ExecutionPreparer.prepareProductOrder(mockRec, validContact, validDelivery);
    assert.equal(result.success, false);
    assert.ok(
      result.errorCode === 'VERIFICATION_FAILED' || result.errorCode === 'ITEM_NOT_VERIFIED',
      `Expected verification failure code, got ${result.errorCode}`
    );
  });

  // =========================================================================
  // 17. Availability Still Overrides Personalization
  // =========================================================================
  await t.test('17. Safety Invariant: Availability failure blocks confirmation even for preferred brands', async () => {
    const oosProduct: NormalizedProduct = {
      id: 'asus-oos-item',
      title: 'ASUS ROG Zephyrus OOS Edition',
      brand: 'ASUS',
      category: 'laptops',
      price: { amount: 95000, currency: 'INR' },
      rating: 4.9,
      reviewCount: 350,
      availability: 'Out of Stock',
      provider: { id: 'test_provider', name: 'Test Provider' },
    };

    const mockRec: RecommendationResult = {
      resultId: 'rec-oos-item',
      rank: 1,
      overallScore: 99,
      item: oosProduct,
      whyThisText: 'Matches your preferred ASUS brand',
      pros: ['ASUS preferred brand'],
      cons: ['Out of Stock'],
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
        issues: ['Stock exhausted at supplier'],
      },
    };

    const result = ExecutionPreparer.prepareProductOrder(mockRec, validContact, validDelivery);
    assert.equal(result.success, false);
    assert.equal(result.errorCode, 'ITEM_UNAVAILABLE');
  });

  // =========================================================================
  // 18. Financial Credentials Rejected from Session & Global Preferences
  // =========================================================================
  await t.test('18. Security Invariant: Financial credentials strictly rejected from session and global preferences', () => {
    const convId = `sess_sec_${Date.now()}`;
    const maliciousPayload: any = {
      card_number: '4111 2222 3333 4444',
      cvv: '123',
      upi_pin: '9876',
      otp: '654321',
      banking_password: 'super_secret_pw',
      preferredBrands: ['ASUS'],
    };

    // Test session preference sanitization
    const savedSession = sessionPreferenceStore.updateSessionPreferences(convId, maliciousPayload);
    assert.equal((savedSession as any).card_number, undefined);
    assert.equal((savedSession as any).cvv, undefined);
    assert.equal((savedSession as any).upi_pin, undefined);
    assert.equal((savedSession as any).otp, undefined);
    assert.equal((savedSession as any).banking_password, undefined);
    assert.ok(savedSession.preferredBrands?.includes('ASUS'));

    // Test global profile sanitization
    const secUser = `user_sec_${Date.now()}`;
    const savedGlobal = profileStore.updateProfile(secUser, maliciousPayload);
    assert.equal((savedGlobal as any).card_number, undefined);
    assert.equal((savedGlobal as any).cvv, undefined);
    assert.equal((savedGlobal as any).upi_pin, undefined);
    assert.equal((savedGlobal as any).otp, undefined);
    assert.equal((savedGlobal as any).banking_password, undefined);
  });
});
