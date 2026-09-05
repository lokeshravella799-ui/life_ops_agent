import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { orchestrator } from '../agent/orchestrator';
import { contextManager } from '../agent/contextManager';
import { confirmationGate } from '../execution/confirmationGate';
import { sandboxExecutor } from '../execution/sandboxExecutor';
import { ExecutionPreparer } from '../execution/executionPreparer';
import { providerRegistry } from '../providers/providerRegistry';
import { MockProductProvider } from '../providers/mock/mockProductProvider';
import { InputValidator } from '../execution/inputValidator';
import type { SelectedItem } from '../execution/types';

describe('LifeOps Phase 2 Step 7: End-to-End Autonomous Agent Execution Flow & Production Readiness', () => {
  beforeEach(() => {
    confirmationGate.clear();
    sandboxExecutor.clear();
  });

  const createMockVerifiedProduct = (id: string = 'prod-e2e-1', title: string = 'ASUS ROG Zephyrus G14'): SelectedItem => ({
    id,
    title,
    category: 'Electronics > Laptops',
    price: {
      amount: 64999,
      currency: 'INR',
    },
    provider: {
      id: 'mock_omnistore',
      name: 'OmniStore Electronics',
      url: 'https://omnistore.example.com/item/1',
    },
    availability: 'In Stock',
    verification: {
      status: 'VERIFIED',
      verifiedAt: new Date().toISOString(),
      priceVerified: true,
      availabilityVerified: true,
      providerVerified: true,
      freshness: 'FRESH',
    },
  });

  // TEST 1: Search -> Recommendations
  test('TEST 1: Search -> recommendations with live verification', async () => {
    const conversationId = `conv_e2e_t1_${Date.now()}`;
    contextManager.clearContext(conversationId);

    const res = await orchestrator.processMessage({
      conversationId,
      message: 'Find me a gaming laptop under ₹90,000',
    });

    assert.equal(res.agentState.intent, 'PRODUCT_SEARCH');
    assert.ok(res.agentState.phase === 'VERIFIED' || res.agentState.phase === 'RESULTS_FOUND');
    assert.ok(res.recommendations && res.recommendations.length >= 2, 'Should return multiple ranked recommendations');
    assert.ok(res.verificationSummary, 'Should include verification summary');
    assert.ok(res.verificationSummary.verifiedCount > 0, 'Should have verified recommendations');

    // Context check
    const ctx = contextManager.getContext(conversationId);
    assert.ok(ctx.previousRecommendations && ctx.previousRecommendations.length >= 2);
    assert.equal(ctx.previousIntent, 'PRODUCT_SEARCH');
  });

  // TEST 2: Selection -> Preparation
  test('TEST 2: Selection -> preparation resolves item from recommendations', async () => {
    const conversationId = `conv_e2e_t2_${Date.now()}`;
    contextManager.clearContext(conversationId);

    // Turn 1: Search
    await orchestrator.processMessage({
      conversationId,
      message: 'Find me a gaming laptop under ₹90,000',
    });

    // Turn 2: Selection
    const selectRes = await orchestrator.processMessage({
      conversationId,
      message: 'I want the second one',
    });

    assert.equal(selectRes.agentState.intent, 'TRANSACTION_REQUEST');
    assert.equal(selectRes.agentState.phase, 'WAITING_FOR_CONFIRMATION');
    assert.equal(selectRes.executionStatus, 'AWAITING_CONFIRMATION');
    assert.equal(selectRes.confirmationRequired, true);
    assert.ok(selectRes.executionId, 'Execution ID must be generated');
    assert.ok(selectRes.executionId.startsWith('exec_prod_'));
    assert.ok(selectRes.executionPreparation, 'Preparation must be attached');
    assert.equal(selectRes.executionPreparation.type, 'PRODUCT_ORDER');
    assert.ok(selectRes.safetyNotice && selectRes.safetyNotice.includes('SAFETY GUARANTEE'));

    // Verify item matches recommendation 2
    const ctx = contextManager.getContext(conversationId);
    assert.ok(ctx.pendingExecution);
    assert.equal(ctx.pendingExecution.executionId, selectRes.executionId);
  });

  // TEST 3: Preparation does NOT execute automatically
  test('TEST 3: Preparation does not execute automatically (Zero execution on selection)', async () => {
    const conversationId = `conv_e2e_t3_${Date.now()}`;
    contextManager.clearContext(conversationId);

    await orchestrator.processMessage({
      conversationId,
      message: 'Find me a gaming laptop under ₹90,000',
    });

    const selectRes = await orchestrator.processMessage({
      conversationId,
      message: 'I want the second one',
    });

    // Invariant: sandboxExecution and executionReceipt MUST NOT be present
    assert.equal(selectRes.sandboxExecution, undefined);
    assert.equal(selectRes.executionReceipt, undefined);

    // Confirmation gate check: isExecuted must be false
    const gateState = confirmationGate.getConfirmationState(selectRes.executionId!);
    assert.ok(gateState);
    assert.equal(gateState.isExecuted, false);
    assert.equal(gateState.status, 'AWAITING_CONFIRMATION');

    // Audit check: EXECUTION_STARTED must NOT have been emitted
    const auditEvents = sandboxExecutor.getAuditEvents();
    const started = auditEvents.find((e) => e.executionId === selectRes.executionId && e.eventType === 'EXECUTION_STARTED');
    assert.equal(started, undefined, 'Execution must not start before user confirmation');
  });

  // TEST 4: Confirmation -> Sandbox execution
  test('TEST 4: Confirmation -> executes sandbox transaction safely', async () => {
    const conversationId = `conv_e2e_t4_${Date.now()}`;
    contextManager.clearContext(conversationId);

    // Turn 1: Search
    await orchestrator.processMessage({
      conversationId,
      message: 'Find me a gaming laptop under ₹90,000',
    });

    // Turn 2: Selection
    const selectRes = await orchestrator.processMessage({
      conversationId,
      message: 'I want the second one',
    });

    const executionId = selectRes.executionId!;

    // Turn 3: Confirmation
    const confirmRes = await orchestrator.processMessage({
      conversationId,
      message: 'Yes, confirm it',
    });

    assert.equal(confirmRes.agentState.intent, 'TRANSACTION_REQUEST');
    assert.equal(confirmRes.agentState.phase, 'COMPLETED');
    assert.equal(confirmRes.executionStatus, 'CONFIRMED');
    assert.equal(confirmRes.sandboxExecutionStatus, 'COMPLETED');
    assert.equal(confirmRes.confirmationRequired, false);
    assert.ok(confirmRes.sandboxExecution, 'Sandbox execution details must be returned');
    assert.ok(confirmRes.sandboxExecution.sandboxOrderId.startsWith('SANDBOX-ORD-'));

    // Confirmation gate check: marked executed
    const gateState = confirmationGate.getConfirmationState(executionId);
    assert.ok(gateState);
    assert.equal(gateState.isExecuted, true);
  });

  // TEST 5: Immutable audit receipt generation
  test('TEST 5: Immutable audit receipt generation with mandatory safety statement', async () => {
    const conversationId = `conv_e2e_t5_${Date.now()}`;
    contextManager.clearContext(conversationId);

    await orchestrator.processMessage({
      conversationId,
      message: 'Find me a gaming laptop under ₹90,000',
    });

    await orchestrator.processMessage({
      conversationId,
      message: 'I want the second one',
    });

    const confirmRes = await orchestrator.processMessage({
      conversationId,
      message: 'Yes, confirm it',
    });

    const receipt = confirmRes.executionReceipt;
    assert.ok(receipt, 'Audit receipt must be generated');
    assert.ok(receipt.receiptId.startsWith('SANDBOX-RCP-'));
    assert.equal(receipt.sandbox, true);
    assert.equal(receipt.executionStatus, 'COMPLETED');
    assert.equal(
      receipt.safetyStatement,
      'No real payment was processed and no real order or booking was created.'
    );
    assert.ok(receipt.costBreakdown.total > 0);
    assert.equal(receipt.costBreakdown.currency, 'INR');
  });

  // TEST 6: Cancellation
  test('TEST 6: Cancellation of active preparation transitions to CANCELLED', async () => {
    const conversationId = `conv_e2e_t6_${Date.now()}`;
    contextManager.clearContext(conversationId);

    await orchestrator.processMessage({
      conversationId,
      message: 'Find me a gaming laptop under ₹90,000',
    });

    const selectRes = await orchestrator.processMessage({
      conversationId,
      message: 'the second one',
    });

    const execId = selectRes.executionId!;

    // Cancel the preparation
    const cancelRes = await orchestrator.processMessage({
      conversationId,
      message: 'cancel it',
    });

    assert.equal(cancelRes.agentState.phase, 'CANCELLED');
    assert.equal(cancelRes.executionStatus, 'CANCELLED');
    assert.match(cancelRes.message, /cancelled/i);

    // Context check: pendingExecution must be cleared
    const ctx = contextManager.getContext(conversationId);
    assert.equal(ctx.pendingExecution, undefined);

    // Gate state check
    const gateState = confirmationGate.getConfirmationState(execId);
    assert.equal(gateState?.status, 'CANCELLED');
  });

  // TEST 7: Confirmation after cancellation is blocked
  test('TEST 7: Confirmation after cancellation is blocked', async () => {
    const conversationId = `conv_e2e_t7_${Date.now()}`;
    contextManager.clearContext(conversationId);

    await orchestrator.processMessage({
      conversationId,
      message: 'Find me a gaming laptop under ₹90,000',
    });

    await orchestrator.processMessage({
      conversationId,
      message: 'the second one',
    });

    await orchestrator.processMessage({
      conversationId,
      message: 'cancel',
    });

    // Attempt to confirm after cancellation
    const confirmRes = await orchestrator.processMessage({
      conversationId,
      message: 'Yes, confirm it',
    });

    // Must not execute
    assert.equal(confirmRes.sandboxExecution, undefined);
    assert.match(confirmRes.message, /no active transaction|previously cancelled/i);
  });

  // TEST 8: Invalid selection does not fall back to option 1
  test('TEST 8: Invalid selection ("option 99", "the tenth one") returns clarification/error', async () => {
    const conversationId = `conv_e2e_t8_${Date.now()}`;
    contextManager.clearContext(conversationId);

    await orchestrator.processMessage({
      conversationId,
      message: 'Find me a gaming laptop under ₹90,000',
    });

    // Out-of-bounds selection 1: "option 99"
    const outRes1 = await orchestrator.processMessage({
      conversationId,
      message: 'option 99',
    });

    assert.equal(outRes1.confirmationRequired, false);
    assert.equal(outRes1.executionPreparation, undefined);
    assert.match(outRes1.message, /option 99 was not found/i);

    // Out-of-bounds selection 2: "the tenth one"
    const outRes2 = await orchestrator.processMessage({
      conversationId,
      message: 'the tenth one',
    });

    assert.equal(outRes2.confirmationRequired, false);
    assert.equal(outRes2.executionPreparation, undefined);
    assert.match(outRes2.message, /option 10 was not found/i);
  });

  // TEST 9: Confirmation without pending execution
  test('TEST 9: Confirmation without pending execution returns clarification without executing', async () => {
    const conversationId = `conv_e2e_t9_${Date.now()}`;
    contextManager.clearContext(conversationId);

    const res = await orchestrator.processMessage({
      conversationId,
      message: 'Yes, confirm it',
    });

    assert.equal(res.confirmationRequired, false);
    assert.equal(res.sandboxExecution, undefined);
    assert.match(res.message, /no active transaction preparation/i);
  });

  // TEST 10: Expired execution
  test('TEST 10: Expired execution preparation is blocked from execution', async () => {
    const conversationId = `conv_e2e_t10_${Date.now()}`;
    contextManager.clearContext(conversationId);

    const item = createMockVerifiedProduct('prod-exp-1');
    const prepRes = ExecutionPreparer.prepareProductOrder(item, undefined, undefined, {
      skipDeliveryCheck: true,
      expiryMinutes: -1, // Expired 1 minute ago
    });

    confirmationGate.registerPreparation(prepRes.preparation!);
    contextManager.updateContext(conversationId, {
      pendingExecution: prepRes.preparation,
    });

    const confirmRes = await orchestrator.processMessage({
      conversationId,
      message: 'Yes, confirm it',
    });

    assert.equal(confirmRes.sandboxExecution, undefined);
    assert.match(confirmRes.message, /expired/i);
  });

  // TEST 11: Unverified item blocked
  test('TEST 11: Unverified item is blocked from preparation', async () => {
    const conversationId = `conv_e2e_t11_${Date.now()}`;
    contextManager.clearContext(conversationId);

    const unverifiedItem: SelectedItem = {
      id: 'prod-unver-1',
      title: 'Unverified Cheap Laptop',
      category: 'Electronics',
      price: { amount: 35000, currency: 'INR' },
      provider: { id: 'mock_omnistore', name: 'OmniStore' },
      availability: 'In Stock',
      verification: {
        status: 'UNVERIFIED',
        priceVerified: false,
        availabilityVerified: false,
        providerVerified: false,
      },
    };

    contextManager.updateContext(conversationId, {
      previousRecommendations: [{ item: unverifiedItem }],
    });

    const selectRes = await orchestrator.processMessage({
      conversationId,
      message: 'the first one',
    });

    assert.equal(selectRes.executionPreparation, undefined);
    assert.match(selectRes.message, /has not been verified/i);
  });

  // TEST 12: Unavailable item blocked
  test('TEST 12: Unavailable item is blocked from preparation', async () => {
    const conversationId = `conv_e2e_t12_${Date.now()}`;
    contextManager.clearContext(conversationId);

    const outOfStockItem: SelectedItem = {
      id: 'prod-oos-1',
      title: 'Out of Stock Laptop',
      category: 'Electronics',
      price: { amount: 55000, currency: 'INR' },
      provider: { id: 'mock_omnistore', name: 'OmniStore' },
      availability: 'UNAVAILABLE',
      verification: {
        status: 'UNAVAILABLE',
        priceVerified: true,
        availabilityVerified: false,
        providerVerified: true,
      },
    };

    contextManager.updateContext(conversationId, {
      previousRecommendations: [{ item: outOfStockItem }],
    });

    const selectRes = await orchestrator.processMessage({
      conversationId,
      message: 'the first one',
    });

    assert.equal(selectRes.executionPreparation, undefined);
    assert.match(selectRes.message, /unavailable/i);
  });

  // TEST 13: Provider failure isolation
  test('TEST 13: Provider failure isolation does not crash multi-provider search', async () => {
    const conversationId = `conv_e2e_t13_${Date.now()}`;
    contextManager.clearContext(conversationId);

    let omniProvider = providerRegistry.getProvider('mock_omnistore') as MockProductProvider;
    let registeredMock = false;
    if (!omniProvider) {
      omniProvider = new MockProductProvider();
      providerRegistry.register(omniProvider);
      registeredMock = true;
    }
    omniProvider.setShouldFail(true);

    try {
      const res = await orchestrator.processMessage({
        conversationId,
        message: 'Find me a gaming laptop under ₹90,000',
      });

      // Search succeeds using remaining available providers
      assert.equal(res.agentState.intent, 'PRODUCT_SEARCH');
      assert.ok(res.normalizedResults !== undefined);
    } finally {
      omniProvider.setShouldFail(false);
      if (registeredMock) {
        providerRegistry.unregister('mock_omnistore');
      }
    }
  });

  // TEST 14: Sandbox execution failure recovery
  test('TEST 14: Sandbox execution gracefully handles invalid execution preparation', async () => {
    const fakeExecId = 'exec_prod_non_existent_999';
    const res = await sandboxExecutor.execute(fakeExecId);

    assert.equal(res.success, false);
    assert.equal(res.status, 'FAILED');
    assert.ok(res.error?.includes('does not exist') || res.message?.includes('No active transaction preparation'));
  });

  // TEST 15: Sequential duplicate execution (Idempotency)
  test('TEST 15: Sequential duplicate execution returns DUPLICATE without creating second order', async () => {
    const item = createMockVerifiedProduct('prod-idem-1');
    const prepRes = ExecutionPreparer.prepareProductOrder(item, undefined, undefined, { skipDeliveryCheck: true });
    const execId = prepRes.preparation!.executionId;

    confirmationGate.registerPreparation(prepRes.preparation!);
    confirmationGate.confirm(execId);

    const firstRes = await sandboxExecutor.execute(execId);
    assert.equal(firstRes.status, 'COMPLETED');
    const firstOrderId = firstRes.sandboxExecutionId;

    // Second execution with same ID
    const secondRes = await sandboxExecutor.execute(execId);
    assert.equal(secondRes.status, 'DUPLICATE');
    assert.equal(secondRes.isDuplicate, true);
    assert.equal(secondRes.sandboxExecutionId, firstOrderId);
    assert.equal(secondRes.receipt?.receiptId, firstRes.receipt?.receiptId);
  });

  // TEST 16: Concurrent duplicate execution
  test('TEST 16: Concurrent duplicate executions are locked and unified', async () => {
    const item = createMockVerifiedProduct('prod-conc-1');
    const prepRes = ExecutionPreparer.prepareProductOrder(item, undefined, undefined, { skipDeliveryCheck: true });
    const execId = prepRes.preparation!.executionId;

    confirmationGate.registerPreparation(prepRes.preparation!);
    confirmationGate.confirm(execId);

    const [resA, resB] = await Promise.all([
      sandboxExecutor.execute(execId),
      sandboxExecutor.execute(execId),
    ]);

    // One is COMPLETED, other is DUPLICATE
    const completed = [resA, resB].find((r) => r.status === 'COMPLETED');
    const duplicate = [resA, resB].find((r) => r.status === 'DUPLICATE');

    assert.ok(completed, 'One execution must complete');
    assert.ok(duplicate, 'The concurrent execution must return as duplicate');
    assert.equal(duplicate.sandboxExecutionId, completed.sandboxExecutionId);
  });

  // TEST 17: Complete lifecycle audit events
  test('TEST 17: Audit events record complete lifecycle from preparation to completion', async () => {
    const conversationId = `conv_e2e_t17_${Date.now()}`;
    contextManager.clearContext(conversationId);

    await orchestrator.processMessage({
      conversationId,
      message: 'Find me a gaming laptop under ₹90,000',
    });

    const selectRes = await orchestrator.processMessage({
      conversationId,
      message: 'the second one',
    });

    const execId = selectRes.executionId!;

    await orchestrator.processMessage({
      conversationId,
      message: 'Yes, confirm it',
    });

    const events = sandboxExecutor.getAuditEvents().filter((e) => e.executionId === execId);
    const eventTypes = events.map((e) => e.eventType);

    assert.ok(eventTypes.includes('PREPARATION_CREATED'), 'Must log PREPARATION_CREATED');
    assert.ok(eventTypes.includes('CONFIRMATION_REQUESTED'), 'Must log CONFIRMATION_REQUESTED');
    assert.ok(eventTypes.includes('CONFIRMED'), 'Must log CONFIRMED');
    assert.ok(eventTypes.includes('EXECUTION_STARTED'), 'Must log EXECUTION_STARTED');
    assert.ok(eventTypes.includes('EXECUTION_COMPLETED'), 'Must log EXECUTION_COMPLETED');
  });

  // TEST 18: Financial credential rejection
  test('TEST 18: Financial credentials (cards, CVV, UPI PIN) are strictly rejected', async () => {
    const fakeCard = '4111222233334444';
    const testPayload = {
      cardNumber: fakeCard,
      cvv: '123',
      upiPin: '1234',
    };

    const secCheck = InputValidator.inspectForForbiddenFinancialCredentials(testPayload);
    assert.equal(secCheck.isClean, false);
    assert.equal(secCheck.containsFinancialSecrets, true);
    assert.ok(secCheck.violation && secCheck.violation.includes('SECURITY VIOLATION'));

    // Verify sandbox executor rejects if passed in options
    const item = createMockVerifiedProduct('prod-sec-1');
    const prepRes = ExecutionPreparer.prepareProductOrder(item, undefined, undefined, { skipDeliveryCheck: true });
    const execId = prepRes.preparation!.executionId;

    confirmationGate.registerPreparation(prepRes.preparation!);
    confirmationGate.confirm(execId);

    const execRes = await sandboxExecutor.execute(execId, { cardNumber: fakeCard });
    assert.equal(execRes.success, false);
    assert.equal(execRes.status, 'FAILED');
    assert.match(execRes.message, /never accepts or stores financial credentials/i);
  });

  // TEST 19: Sandbox invariant
  test('TEST 19: Sandbox invariant holds on all execution objects and receipts', async () => {
    const item = createMockVerifiedProduct('prod-inv-1');
    const prepRes = ExecutionPreparer.prepareProductOrder(item, undefined, undefined, { skipDeliveryCheck: true });
    const execId = prepRes.preparation!.executionId;

    confirmationGate.registerPreparation(prepRes.preparation!);
    confirmationGate.confirm(execId);

    const execRes = await sandboxExecutor.execute(execId);

    assert.equal(execRes.order?.sandbox, true);
    assert.equal(execRes.receipt?.sandbox, true);
    assert.equal(
      execRes.receipt?.safetyStatement,
      'No real payment was processed and no real order or booking was created.'
    );
  });

  // TEST 20: Full regression with multi-turn conversation state consistency
  test('TEST 20: Multi-turn conversation state remains consistent across sequential calls', async () => {
    const conversationId = `conv_e2e_t20_${Date.now()}`;
    contextManager.clearContext(conversationId);

    // Turn 1: Search
    const t1 = await orchestrator.processMessage({
      conversationId,
      message: 'Find me a gaming laptop under ₹90,000',
    });
    assert.ok(t1.recommendations && t1.recommendations.length > 0);

    // Turn 2: Natural selection
    const t2 = await orchestrator.processMessage({
      conversationId,
      message: 'option 2',
    });
    assert.equal(t2.executionStatus, 'AWAITING_CONFIRMATION');
    assert.ok(t2.executionId);

    // Turn 3: Natural confirmation
    const t3 = await orchestrator.processMessage({
      conversationId,
      message: 'Proceed',
    });
    assert.equal(t3.executionStatus, 'CONFIRMED');
    assert.equal(t3.sandboxExecutionStatus, 'COMPLETED');
    assert.ok(t3.executionReceipt);
  });
});
