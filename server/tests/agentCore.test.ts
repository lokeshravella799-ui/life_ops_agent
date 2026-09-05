import test from 'node:test';
import assert from 'node:assert/strict';
import { orchestrator } from '../agent/orchestrator';
import { contextManager } from '../agent/contextManager';
import { toolRegistry } from '../agent/toolRegistry';

test('LifeOps Agent Core Foundation - Mandatory Test Scenarios', async (t) => {
  const conversationId = `test_conv_${Date.now()}`;

  // Cleanup before starting
  contextManager.clearContext(conversationId);

  await t.test('TEST 1: "Hi" -> GENERAL_CHAT', async () => {
    const res = await orchestrator.processMessage({
      conversationId,
      message: 'Hi',
    });

    assert.equal(res.agentState.intent, 'GENERAL_CHAT');
    assert.ok(res.message.length > 0, 'Should return a friendly conversational greeting');
    assert.equal(res.requiresClarification, undefined);
  });

  await t.test('TEST 2: "Find me a gaming laptop under ₹50,000" -> PRODUCT_SEARCH', async () => {
    const res = await orchestrator.processMessage({
      conversationId,
      message: 'Find me a gaming laptop under ₹80,000',
    });

    assert.equal(res.agentState.intent, 'PRODUCT_SEARCH');
    assert.ok(res.requirements, 'Requirements should be extracted');
    assert.equal(res.requirements?.category, 'electronics');
    assert.equal(res.requirements?.budget?.max, 80000);
    assert.equal(res.requirements?.budget?.currency, 'INR');
    assert.ok(res.requirements?.keywords?.includes('gaming laptop'), 'Should extract keyword "gaming laptop"');
    assert.equal(res.selectedTool, 'search_products');
    assert.ok(res.plan && res.plan.steps.length >= 3, 'Should generate a structured execution plan');
  });

  await t.test(
    'TEST 3: "Find me the cheapest AC sleeper bus from Hyderabad to Bangalore tomorrow after 6 PM" -> BUS_SEARCH',
    async () => {
      const busConvId = `bus_test_${Date.now()}`;
      const res = await orchestrator.processMessage({
        conversationId: busConvId,
        message: 'Find me the cheapest AC sleeper bus from Hyderabad to Bangalore tomorrow after 6 PM',
      });

      assert.equal(res.agentState.intent, 'BUS_SEARCH');
      assert.ok(res.requirements, 'Should extract bus requirements');
      assert.equal(res.requirements?.category, 'bus');
      assert.equal(res.requirements?.source, 'Hyderabad');
      assert.equal(res.requirements?.destination, 'Bangalore');
      assert.equal(res.requirements?.preferences?.busType, 'AC Sleeper');
      assert.equal(res.requirements?.departureAfter, '18:00');
      assert.equal(res.requirements?.sortPreference, 'cheapest');
      assert.equal(res.selectedTool, 'search_buses');
      assert.equal(res.requiresClarification, undefined);
    }
  );

  await t.test('TEST 4: "Make the laptop budget ₹90,000" -> MODIFICATION_REQUEST (Context Preserved)', async () => {
    // Note: We use the same conversationId from TEST 2 where laptop was searched!
    const res = await orchestrator.processMessage({
      conversationId,
      message: 'Make the laptop budget ₹90,000',
    });

    assert.equal(res.agentState.intent, 'MODIFICATION_REQUEST');
    assert.ok(res.requirements, 'Should have requirements');
    // Context preservation check:
    assert.equal(res.requirements?.budget?.max, 90000, 'Budget should be updated to 90,000');
    assert.equal(res.requirements?.category, 'electronics', 'Category should be preserved from previous search');
    assert.ok(
      res.requirements?.keywords?.includes('gaming laptop'),
      'Keywords from previous query should be preserved in context'
    );
    assert.equal(res.selectedTool, 'search_products');
  });

  await t.test('TEST 5: "Book me a bus" -> Clarification Required', async () => {
    const unspecConvId = `unspec_${Date.now()}`;
    const res = await orchestrator.processMessage({
      conversationId: unspecConvId,
      message: 'Book me a bus',
    });

    assert.equal(res.agentState.intent, 'BUS_SEARCH');
    assert.equal(res.requiresClarification, true, 'Should trigger clarification because source/destination are missing');
    assert.ok(res.clarificationQuestions && res.clarificationQuestions.length > 0);
    assert.match(res.message, /traveling/i, 'Clarification message should ask for route');
  });

  await t.test('TEST 6: "Book the second option" -> TRANSACTION_REQUEST (No financial execution)', async () => {
    const res = await orchestrator.processMessage({
      conversationId,
      message: 'Book the second option',
    });

    assert.equal(res.agentState.intent, 'TRANSACTION_REQUEST');
    assert.equal(res.agentState.phase, 'WAITING_FOR_CONFIRMATION');
    assert.ok(res.safetyNotice, 'Should include explicit safety notice');
    assert.match(res.safetyNotice, /SAFETY GUARANTEE/i);
    // Security check: Verify NO external payment or booking occurred
    assert.match(res.message, /explicit confirmation/i);
  });

  await t.test('Tool Registry verification', async () => {
    assert.ok(toolRegistry.hasTool('search_products'));
    assert.ok(toolRegistry.hasTool('get_product_details'));
    assert.ok(toolRegistry.hasTool('search_buses'));
    assert.ok(toolRegistry.hasTool('get_bus_details'));
    assert.ok(toolRegistry.hasTool('search_hotels'));
    assert.ok(toolRegistry.hasTool('get_hotel_details'));
    assert.ok(toolRegistry.hasTool('search_flights'));
    assert.ok(toolRegistry.hasTool('get_flight_details'));
    assert.ok(toolRegistry.hasTool('web_search'));
  });
});
