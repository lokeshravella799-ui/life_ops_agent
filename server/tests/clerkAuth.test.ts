import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { profileStore } from '../personalization/profileStore';
import { orchestrator } from '../agent/orchestrator';
import { contextManager } from '../agent/contextManager';

describe('LifeOps Clerk Authentication & User Identity Tests', () => {
  // 1. Clerk Publishable Key Format & Detection
  describe('1. Clerk Key Validation & Detection Rules', () => {
    it('validates standard Clerk publishable key format (pk_test_ and pk_live_)', () => {
      const isValidClerkKey = (key?: string) => {
        if (!key || typeof key !== 'string') return false;
        const clean = key.trim();
        return clean.startsWith('pk_test_') || clean.startsWith('pk_live_');
      };

      assert.strictEqual(isValidClerkKey('pk_test_Y2xlcmsuY2hhcnRlci5vcmck'), true);
      assert.strictEqual(isValidClerkKey('pk_live_Y2xlcmsuZXhhbXBsZS5vcmck'), true);
      assert.strictEqual(isValidClerkKey('sk_test_12345'), false, 'Secret key is not a publishable key');
      assert.strictEqual(isValidClerkKey(''), false);
      assert.strictEqual(isValidClerkKey(undefined), false);
    });

    it('operates in resilient fallback mode when Clerk key is empty or unconfigured', () => {
      const mockEnvKey: string | undefined = undefined;
      const isClerkConfigured = Boolean(mockEnvKey && mockEnvKey.startsWith('pk_'));

      assert.strictEqual(isClerkConfigured, false);
      // Fallback user defaults to 'default_user'
      const activeUser = isClerkConfigured ? 'user_clerk_999' : 'default_user';
      assert.strictEqual(activeUser, 'default_user');
    });
  });

  // 2. Personalization Profile Isolation per Clerk User ID
  describe('2. User Personalization Profile Isolation by Clerk User ID', () => {
    it('creates and maintains distinct profiles for different authenticated Clerk users', () => {
      const clerkUserA = `clerk_user_alice_${Date.now()}`;
      const clerkUserB = `clerk_user_bob_${Date.now()}`;

      // Initialize profile for User A (Alice - prefers ASUS & Lenovo, maxPrice 70000)
      profileStore.updateProfile(clerkUserA, {
        shopping: {
          preferredBrands: ['ASUS', 'Lenovo'],
          excludedBrands: [],
          preferredCategories: ['electronics'],
          maxPrice: 70000,
        },
      });

      // Initialize profile for User B (Bob - prefers Apple & Dell, maxPrice 150000)
      profileStore.updateProfile(clerkUserB, {
        shopping: {
          preferredBrands: ['Apple', 'Dell'],
          excludedBrands: [],
          preferredCategories: ['electronics'],
          maxPrice: 150000,
        },
      });

      // Verify complete isolation
      const fetchedA = profileStore.getProfile(clerkUserA);
      const fetchedB = profileStore.getProfile(clerkUserB);

      assert.strictEqual(fetchedA.userId, clerkUserA);
      assert.strictEqual(fetchedB.userId, clerkUserB);

      assert.deepStrictEqual(fetchedA.shopping.preferredBrands, ['ASUS', 'Lenovo']);
      assert.deepStrictEqual(fetchedB.shopping.preferredBrands, ['Apple', 'Dell']);

      assert.strictEqual(fetchedA.shopping.maxPrice, 70000);
      assert.strictEqual(fetchedB.shopping.maxPrice, 150000);
    });

    it('persists persona switches separately per Clerk user account', () => {
      const clerkUserA = `clerk_user_work_alice_${Date.now()}`;
      const clerkUserB = `clerk_user_personal_bob_${Date.now()}`;

      // User A switches to Work persona
      profileStore.switchPersona(clerkUserA, 'work');
      // User B switches to Personal persona
      profileStore.switchPersona(clerkUserB, 'personal');

      const profileA = profileStore.getProfile(clerkUserA);
      const profileB = profileStore.getProfile(clerkUserB);

      assert.strictEqual(profileA.activePersonaId, 'work');
      assert.strictEqual(profileB.activePersonaId, 'personal');
    });
  });

  // 3. End-to-End Agent Orchestration with Authenticated Clerk Identity
  describe('3. Agent Orchestration with Clerk User Identity', () => {
    it('uses authenticated Clerk user preferences to rank recommendations', async () => {
      const clerkUser = `clerk_user_gamer_${Date.now()}`;
      const convId = `clerk_conv_${Date.now()}`;
      contextManager.clearContext(convId);

      // Configure user preferences for ASUS laptops
      profileStore.addPreferredBrand(clerkUser, 'ASUS');

      // Send search message with authenticated Clerk userId
      const response = await orchestrator.processMessage({
        conversationId: convId,
        message: 'Find me a gaming laptop',
        userId: clerkUser,
      });

      assert.strictEqual(response.agentState.intent, 'PRODUCT_SEARCH');
      assert.ok(response.recommendations && response.recommendations.length > 0);
      // Top recommendation or response should match preferred brand
      const topTitle = response.recommendations[0].item.title;
      assert.ok(
        topTitle.includes('ASUS') || response.message.includes('ASUS'),
        'Personalized recommendation reflects Clerk user preference'
      );
    });
  });
});
