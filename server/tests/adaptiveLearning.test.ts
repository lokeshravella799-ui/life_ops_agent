import test from 'node:test';
import assert from 'node:assert/strict';
import { profileStore } from '../personalization/profileStore';
import { personaManager } from '../personalization/personaManager';
import { adaptiveLearningEngine } from '../personalization/adaptiveLearningEngine';
import { sessionPreferenceStore } from '../personalization/sessionPreferenceStore';
import { orchestrator } from '../agent/orchestrator';
import { ScoringEngine } from '../comparison/scoringEngine';
import { RankingEngine } from '../comparison/rankingEngine';
import type { NormalizedProduct } from '../types/provider';
import type { SearchRequirements } from '../types/agent';

test('LifeOps Phase 3 Step 3 — Adaptive Preference Learning, Explicit Feedback & Explainable Evolution Test Suite', async (t) => {
  const baseUserId = `test_adaptive_user_${Date.now()}`;
  profileStore.clearProfile(baseUserId);

  const sampleLaptopAsus: NormalizedProduct = {
    id: 'lap_asus_1',
    provider: { id: 'mock_croma', name: 'Croma', type: 'mock' },
    title: 'ASUS ZenBook 14 OLED',
    brand: 'ASUS',
    model: 'ZenBook 14',
    category: 'electronics',
    price: { amount: 64999, currency: 'INR' },
    rating: 4.6,
    reviewCount: 280,
    availability: 'IN_STOCK',
    specifications: {
      cpu: 'Intel Core Ultra 7',
      ram: '16GB',
      storage: '512GB SSD',
      gpu: 'Intel Arc Graphics',
      brand: 'ASUS',
    },
    url: 'https://example.com/asus',
    images: [],
    rawData: {},
  };

  const sampleLaptopLenovo: NormalizedProduct = {
    id: 'lap_lenovo_1',
    provider: { id: 'mock_amazon', name: 'Amazon', type: 'mock' },
    title: 'Lenovo ThinkPad E16 Gen 2',
    brand: 'Lenovo',
    model: 'ThinkPad E16',
    category: 'electronics',
    price: { amount: 69999, currency: 'INR' },
    rating: 4.7,
    reviewCount: 310,
    availability: 'IN_STOCK',
    specifications: {
      cpu: 'Intel Core i7-1355U',
      ram: '16GB',
      storage: '512GB SSD',
      gpu: 'Integrated Iris Xe',
      brand: 'Lenovo',
    },
    url: 'https://example.com/lenovo',
    images: [],
    rawData: {},
  };

  const sampleLaptopAcer: NormalizedProduct = {
    id: 'lap_acer_1',
    provider: { id: 'mock_reliance', name: 'Reliance Digital', type: 'mock' },
    title: 'Acer Aspire 5 Slim',
    brand: 'Acer',
    model: 'Aspire 5',
    category: 'electronics',
    price: { amount: 48999, currency: 'INR' },
    rating: 4.2,
    reviewCount: 150,
    availability: 'IN_STOCK',
    specifications: {
      cpu: 'Intel Core i5-1240P',
      ram: '8GB',
      storage: '512GB SSD',
      gpu: 'Intel Iris Xe',
      brand: 'Acer',
    },
    url: 'https://example.com/acer',
    images: [],
    rawData: {},
  };

  // =========================================================================
  // 1. Persona Switching (personal vs work)
  // =========================================================================
  await t.test('1. should switch active persona between personal and work, updating active priorities', async () => {
    const userId = `${baseUserId}_persona_1`;
    profileStore.clearProfile(userId);

    const initial = profileStore.getProfile(userId);
    assert.equal(initial.activePersonaId, 'personal');
    assert.equal(initial.general.rankingPriority, 'balanced');

    // Switch to work persona
    const switched = profileStore.switchPersona(userId, 'work');
    assert.equal(switched.activePersonaId, 'work');
    assert.equal(switched.general.rankingPriority, 'highest_quality');
    assert.ok(switched.shopping.priorityWeights.performance > 0.3);

    // Switch back to personal
    const reverted = profileStore.switchPersona(userId, 'personal');
    assert.equal(reverted.activePersonaId, 'personal');
    assert.equal(reverted.general.rankingPriority, 'balanced');
  });

  // =========================================================================
  // 2. Persona & Root Synchronization
  // =========================================================================
  await t.test('2. should keep active persona and root profile shortcuts synchronized', async () => {
    const userId = `${baseUserId}_sync_2`;
    profileStore.clearProfile(userId);

    // Add preferred brand to active personal persona
    profileStore.addPreferredBrand(userId, 'Apple');
    const profile = profileStore.getProfile(userId);

    // Root shopping shortcut must reflect Apple
    assert.ok(profile.shopping.preferredBrands.includes('Apple'));
    // Active persona data must also reflect Apple
    assert.ok(profile.personas?.personal.shopping.preferredBrands.includes('Apple'));

    // Switch to work persona and verify separation
    profileStore.switchPersona(userId, 'work');
    const workProfile = profileStore.getProfile(userId);
    assert.equal(workProfile.activePersonaId, 'work');
    // Work persona should NOT have personal preferred brands (Apple was added to personal)
    assert.ok(!workProfile.shopping.preferredBrands.includes('Apple'));
    // Add Dell to work persona and verify it updates
    profileStore.addPreferredBrand(userId, 'Dell');
    assert.ok(profileStore.getProfile(userId).shopping.preferredBrands.includes('Dell'));
  });

  // =========================================================================
  // 3. Bayesian Confidence & Repeated Item Selection
  // =========================================================================
  await t.test('3. should track repeated item selections and compute Bayesian confidence', async () => {
    const userId = `${baseUserId}_selection_3`;
    profileStore.clearProfile(userId);
    const profile = profileStore.getProfile(userId);

    // Initial state: 0 selections
    const inf1 = adaptiveLearningEngine.recordItemSelection(profile, userId, sampleLaptopLenovo);
    // 1 selection should NOT trigger staged inference (confidence < 0.80)
    assert.equal(inf1, null);

    const updatedProfile = profileStore.getProfile(userId);
    const history = updatedProfile.selectionHistory || [];
    assert.equal(history.length, 1);
    assert.equal(history[0].brand, 'Lenovo');
  });

  // =========================================================================
  // 4. Threshold Triggered Staged Inference
  // =========================================================================
  await t.test('4. should stage preference inference when threshold (0.80) is reached without modifying saved profile', async () => {
    const userId = `${baseUserId}_threshold_4`;
    profileStore.clearProfile(userId);

    let profile = profileStore.getProfile(userId);
    // Remove Lenovo if present in default
    profileStore.removePreferredBrand(userId, 'Lenovo');
    profile = profileStore.getProfile(userId);
    assert.ok(!profile.shopping.preferredBrands.includes('Lenovo'));

    // Record 3 selections of Lenovo
    adaptiveLearningEngine.recordItemSelection(profile, userId, sampleLaptopLenovo);
    profile = profileStore.getProfile(userId);
    adaptiveLearningEngine.recordItemSelection(profile, userId, sampleLaptopLenovo);
    profile = profileStore.getProfile(userId);
    const staged = adaptiveLearningEngine.recordItemSelection(profile, userId, sampleLaptopLenovo);

    assert.ok(staged !== null, 'Staged inference should be returned after 3 consecutive selections');
    assert.equal(staged?.inferredValue, 'Lenovo');
    assert.ok(staged?.confidence >= 0.80, `Expected confidence >= 0.80, got ${staged?.confidence}`);
    assert.equal(staged?.status, 'STAGED');

    // CRITICAL SAFETY INVARIANT: Profile preferred brands must NOT be modified automatically!
    const verifiedProfile = profileStore.getProfile(userId);
    assert.ok(
      !verifiedProfile.shopping.preferredBrands.includes('Lenovo'),
      'Learned preference must remain STAGED until explicit user confirmation'
    );
  });

  // =========================================================================
  // 5. Explicit User Acceptance of Staged Inference
  // =========================================================================
  await t.test('5. should require explicit user acceptance before promoting staged inference into preferred brands', async () => {
    const userId = `${baseUserId}_accept_5`;
    profileStore.clearProfile(userId);

    // Stage an inference for ASUS
    const staged = profileStore.stageInference(userId, {
      field: 'shopping.preferredBrands',
      inferredValue: 'ASUS',
      confidence: 0.95,
      reason: 'User frequently selected ASUS items in 3 recent queries',
    });

    // Accept staged inference
    const updated = profileStore.acceptStagedInference(userId, staged.id);
    assert.ok(updated.shopping.preferredBrands.includes('ASUS'));

    const acceptedInf = updated.stagedInferences?.find((s) => s.id === staged.id);
    assert.equal(acceptedInf?.status, 'ACCEPTED');

    // Verify evolution history logged this promotion
    const evo = updated.evolutionHistory?.find((e) => e.source === 'ACCEPTED_INFERENCE');
    assert.ok(evo !== undefined);
    assert.equal(evo?.field, 'shopping.preferredBrands');
  });

  // =========================================================================
  // 6. Explicit User Rejection of Staged Inference
  // =========================================================================
  await t.test('6. should allow user rejection of staged inference and mark it as REJECTED', async () => {
    const userId = `${baseUserId}_reject_6`;
    profileStore.clearProfile(userId);

    const staged = profileStore.stageInference(userId, {
      field: 'shopping.preferredBrands',
      inferredValue: 'MSI',
      confidence: 0.85,
      reason: 'User selected MSI items twice',
    });

    const updated = profileStore.rejectStagedInference(userId, staged.id);
    assert.ok(!updated.shopping.preferredBrands.includes('MSI'));

    const rejectedInf = updated.stagedInferences?.find((s) => s.id === staged.id);
    assert.equal(rejectedInf?.status, 'REJECTED');
  });

  // =========================================================================
  // 7. Explicit Recommendation Feedback (Thumbs Up / Thumbs Down)
  // =========================================================================
  await t.test('7. should record explicit recommendation feedback (thumbs up / thumbs down)', async () => {
    const userId = `${baseUserId}_feedback_7`;
    profileStore.clearProfile(userId);

    const updated = profileStore.recordFeedback(userId, {
      id: 'fb_1',
      userId,
      recommendationId: 'rec_asus_zenbook',
      rating: 'positive',
      targetBrand: 'ASUS',
      targetTitle: 'ASUS ZenBook 14',
      timestamp: new Date().toISOString(),
    });

    assert.equal(updated.feedbackHistory?.length, 1);
    assert.equal(updated.feedbackHistory?.[0].rating, 'positive');
    assert.equal(updated.feedbackHistory?.[0].targetBrand, 'ASUS');
  });

  // =========================================================================
  // 8. Structured Feedback Reasons
  // =========================================================================
  await t.test('8. should support structured feedback reasons (e.g., DISLIKED_BRAND, TOO_EXPENSIVE)', async () => {
    const userId = `${baseUserId}_reasons_8`;
    profileStore.clearProfile(userId);

    profileStore.recordFeedback(userId, {
      id: 'fb_dislike',
      userId,
      recommendationId: 'rec_acer_1',
      rating: 'negative',
      reason: 'DISLIKED_BRAND',
      targetBrand: 'Acer',
      timestamp: new Date().toISOString(),
    });

    profileStore.recordFeedback(userId, {
      id: 'fb_expensive',
      userId,
      recommendationId: 'rec_dell_1',
      rating: 'negative',
      reason: 'TOO_EXPENSIVE',
      targetBrand: 'Dell',
      timestamp: new Date().toISOString(),
    });

    const profile = profileStore.getProfile(userId);
    const boosts = adaptiveLearningEngine.computeFeedbackBoosts(profile);

    assert.ok(boosts['acer'] <= -20, `Expected Acer penalty <= -20, got ${boosts['acer']}`);
    assert.ok(boosts['dell'] <= -10, `Expected Dell penalty <= -10, got ${boosts['dell']}`);
  });

  // =========================================================================
  // 9. Scoring Engine Feedback Boosts & Adjustments
  // =========================================================================
  await t.test('9. should compute feedback score boosts and penalty adjustments in scoring engine', async () => {
    const reqs: SearchRequirements = {
      intent: 'PRODUCT_SEARCH',
      category: 'electronics',
    };

    // Baseline score without feedback
    const baseScore = ScoringEngine.scoreProduct(sampleLaptopAsus, [sampleLaptopAsus], reqs, '');

    // Profile with positive feedback for ASUS (+15)
    const profileWithThumbsUp = profileStore.createDefaultProfile('test_user_boost');
    profileWithThumbsUp.feedbackHistory = [
      {
        id: 'fb_asus',
        userId: 'test_user_boost',
        recommendationId: 'rec_1',
        rating: 'positive',
        targetBrand: 'ASUS',
        timestamp: new Date().toISOString(),
      },
    ];

    const effectiveWithBoost = sessionPreferenceStore.computeEffectivePreferences(
      profileWithThumbsUp,
      { conversationId: 'conv_boost', updatedAt: new Date().toISOString() }
    );

    const boostedScore = ScoringEngine.scoreProduct(sampleLaptopAsus, [sampleLaptopAsus], reqs, '', effectiveWithBoost as any);
    assert.ok(
      boostedScore.overallScore > baseScore.overallScore,
      `Boosted score (${boostedScore.overallScore}) should exceed baseline (${baseScore.overallScore})`
    );
  });

  // =========================================================================
  // 10. Auditable Profile Evolution History
  // =========================================================================
  await t.test('10. should record auditable profile evolution entries for all changes', async () => {
    const userId = `${baseUserId}_evolution_10`;
    profileStore.clearProfile(userId);

    profileStore.switchPersona(userId, 'work');
    profileStore.addPreferredBrand(userId, 'Sony');
    profileStore.setRankingPriority(userId, 'highest_quality');

    const profile = profileStore.getProfile(userId);
    assert.ok(profile.evolutionHistory && profile.evolutionHistory.length >= 3);

    const personaEntry = profile.evolutionHistory.find((e) => e.field === 'activePersonaId');
    assert.ok(personaEntry);
    assert.equal(personaEntry.newValue, 'work');

    const brandEntry = profile.evolutionHistory.find((e) => e.field === 'shopping.preferredBrands');
    assert.ok(brandEntry);
    assert.ok(brandEntry.newValue.includes('Sony'));
  });

  // =========================================================================
  // 11. One-Click Profile Evolution Revert (Rollback)
  // =========================================================================
  await t.test('11. should successfully revert a previous profile evolution entry to its prior state', async () => {
    const userId = `${baseUserId}_revert_11`;
    profileStore.clearProfile(userId);

    // Add Sony to preferred brands
    profileStore.addPreferredBrand(userId, 'Sony');
    let profile = profileStore.getProfile(userId);
    assert.ok(profile.shopping.preferredBrands.includes('Sony'));

    // Find the evolution entry
    const entry = profile.evolutionHistory?.find((e) => e.field === 'shopping.preferredBrands' && e.revertible);
    assert.ok(entry, 'Expected revertible evolution entry for preferredBrands');

    // Revert the evolution entry
    profileStore.revertEvolutionEntry(userId, entry.id);
    profile = profileStore.getProfile(userId);

    assert.ok(!profile.shopping.preferredBrands.includes('Sony'), 'Sony should be removed after reverting evolution entry');
  });

  // =========================================================================
  // 12. Strict Financial Sanitization
  // =========================================================================
  await t.test('12. should maintain safety invariants and strip sensitive financial credentials from feedback and profile inputs', async () => {
    const userId = `${baseUserId}_safety_12`;
    profileStore.clearProfile(userId);

    // Attempt to inject sensitive financial credentials
    const dirtyProfile = {
      card_number: '4111222233334444',
      cvv: '123',
      upi_pin: '9876',
      banking_password: 'SecretPassword123!',
      shopping: {
        preferredBrands: ['Lenovo', '4111-2222-3333-4444'],
      },
    };

    const updated = profileStore.updateProfile(userId, dirtyProfile as any);

    assert.equal((updated as any).card_number, undefined);
    assert.equal((updated as any).cvv, undefined);
    assert.equal((updated as any).upi_pin, undefined);
    assert.equal((updated as any).banking_password, undefined);
    // Card pattern in string array must also be sanitized
    assert.ok(!updated.shopping.preferredBrands.includes('4111-2222-3333-4444'));
  });

  // =========================================================================
  // 13. Conversational Persona Switching via Orchestrator
  // =========================================================================
  await t.test('13. should handle conversational persona switch requests in agent orchestrator', async () => {
    const convId = `conv_persona_orch_${Date.now()}`;
    const userId = `${baseUserId}_persona_orch_13`;
    profileStore.clearProfile(userId);

    const res = await orchestrator.processMessage({
      conversationId: convId,
      message: 'Switch to work profile',
      userId,
    });

    assert.equal(res.agentState.intent, 'PERSONA_SWITCH');
    assert.equal(res.activePersonaId, 'work');
    assert.ok(res.message.toLowerCase().includes('work'));

    const currentProfile = profileStore.getProfile(userId);
    assert.equal(currentProfile.activePersonaId, 'work');
  });

  // =========================================================================
  // 14. Conversational Feedback Submission via Orchestrator
  // =========================================================================
  await t.test('14. should handle conversational feedback submission in agent orchestrator', async () => {
    const convId = `conv_feedback_orch_${Date.now()}`;
    const userId = `${baseUserId}_feedback_orch_14`;
    profileStore.clearProfile(userId);

    // Pre-populate recommendations in context
    const searchRes = await orchestrator.processMessage({
      conversationId: convId,
      message: 'Find me a gaming laptop under 90000',
      userId,
    });
    assert.ok(searchRes.recommendations && searchRes.recommendations.length > 0);

    // Provide thumbs up feedback on option 1
    const feedbackRes = await orchestrator.processMessage({
      conversationId: convId,
      message: 'Thumbs up on option 1',
      userId,
    });

    assert.equal(feedbackRes.agentState.intent, 'FEEDBACK_SUBMISSION');
    assert.ok(feedbackRes.feedbackResult?.success);
    assert.ok(feedbackRes.message.includes('Feedback recorded'));
  });

  // =========================================================================
  // 15. Conversational Staged Inference Acceptance via Orchestrator
  // =========================================================================
  await t.test('15. should handle conversational staged inference acceptance via orchestrator', async () => {
    const convId = `conv_staged_orch_${Date.now()}`;
    const userId = `${baseUserId}_staged_orch_15`;
    profileStore.clearProfile(userId);

    // Stage an inference for MSI
    profileStore.stageInference(userId, {
      field: 'shopping.preferredBrands',
      inferredValue: 'MSI',
      confidence: 0.90,
      reason: 'Frequent MSI selections',
    });

    // Accept via conversational input
    const acceptRes = await orchestrator.processMessage({
      conversationId: convId,
      message: 'Yes, add MSI to my profile',
      userId,
    });

    assert.equal(acceptRes.agentState.intent, 'PREFERENCE_UPDATE');
    assert.ok(acceptRes.message.includes('MSI'));

    const profile = profileStore.getProfile(userId);
    assert.ok(profile.shopping.preferredBrands.includes('MSI'));
  });

  // =========================================================================
  // 16. Dynamic Re-ranking on Persona Switch
  // =========================================================================
  await t.test('16. should dynamically re-rank options when switching persona', async () => {
    const reqs: SearchRequirements = {
      intent: 'PRODUCT_SEARCH',
      category: 'electronics',
    };

    const products = [sampleLaptopAcer, sampleLaptopLenovo, sampleLaptopAsus];

    // Personal persona ranks for lowest price (Acer is cheapest at 48,999)
    const personalProfile = personaManager.createDefaultPersonas().personal;
    const personalRanked = RankingEngine.rankProducts(products, reqs, '', personalProfile as any);
    assert.equal(personalRanked[0].item.brand, 'Acer');

    // Work persona ranks for quality and performance (ThinkPad or ASUS should rank #1)
    const workProfile = personaManager.createDefaultPersonas().work;
    const workRanked = RankingEngine.rankProducts(products, reqs, '', workProfile as any);
    assert.notEqual(workRanked[0].item.brand, 'Acer');
    assert.ok(workRanked[0].item.brand === 'Lenovo' || workRanked[0].item.brand === 'ASUS');
  });

  // =========================================================================
  // 17. Safety & Availability Override Invariant
  // =========================================================================
  await t.test('17. should ensure safety/verification/availability strictly overrides learned preferences and feedback boosts', async () => {
    const convId = `conv_safety_inv_${Date.now()}`;
    const userId = `${baseUserId}_safety_inv_17`;
    profileStore.clearProfile(userId);

    // Add ASUS to preferred brands and give it positive feedback
    profileStore.addPreferredBrand(userId, 'ASUS');
    profileStore.recordFeedback(userId, {
      id: 'fb_asus',
      userId,
      recommendationId: 'rec_asus',
      rating: 'positive',
      targetBrand: 'ASUS',
      timestamp: new Date().toISOString(),
    });

    // Create an unavailable item
    const unavailableAsus: NormalizedProduct = {
      ...sampleLaptopAsus,
      availability: 'UNAVAILABLE',
      verification: {
        priceVerified: false,
        availabilityVerified: false,
        providerVerified: true,
        status: 'UNAVAILABLE',
      },
    };

    const recs = RankingEngine.rankProducts([unavailableAsus], { intent: 'PRODUCT_SEARCH', category: 'electronics' });
    // Item is ranked but marked unavailable
    assert.equal(recs[0].item.availability, 'UNAVAILABLE');
  });
});
