import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getLLMProvider } from '../llm/provider';
import { GroqProvider } from '../llm/groqProvider';
import { OpenAIProvider } from '../llm/openaiProvider';
import { llmService } from '../llm/llmService';
import { validateEnvironment } from '../config/env';
import { isSupabaseConfigured, getSupabaseServerClient } from '../db/supabaseClient';
import { supabaseDbService } from '../db/supabaseService';
import { orchestrator } from '../agent/orchestrator';
import { contextManager } from '../agent/contextManager';

describe('LifeOps Infrastructure — Groq LLM & Supabase Database Configuration', () => {
  // 1. Groq Provider Selection & Configuration
  describe('1. Groq LLM Provider Selection', () => {
    it('defaults to Groq provider with active Groq model', () => {
      const originalProvider = process.env.LLM_PROVIDER;
      const originalModel = process.env.LLM_MODEL;
      const originalGroqModel = process.env.GROQ_MODEL;
      try {
        delete process.env.LLM_PROVIDER;
        delete process.env.LLM_MODEL;
        delete process.env.GROQ_MODEL;

        const provider = getLLMProvider();
        assert.strictEqual(provider.name, 'groq');
        assert.strictEqual(provider.model, 'openai/gpt-oss-120b');
      } finally {
        if (originalProvider) process.env.LLM_PROVIDER = originalProvider;
        if (originalModel) process.env.LLM_MODEL = originalModel;
        if (originalGroqModel) process.env.GROQ_MODEL = originalGroqModel;
      }
    });

    it('dynamically reads LLM_MODEL from environment variable', () => {
      const originalModel = process.env.LLM_MODEL;
      const originalGroqModel = process.env.GROQ_MODEL;
      try {
        delete process.env.GROQ_MODEL;
        process.env.LLM_MODEL = 'openai/gpt-oss-120b';
        const groq = new GroqProvider();
        assert.strictEqual(groq.model, 'openai/gpt-oss-120b');
      } finally {
        if (originalModel) {
          process.env.LLM_MODEL = originalModel;
        } else {
          delete process.env.LLM_MODEL;
        }
        if (originalGroqModel) {
          process.env.GROQ_MODEL = originalGroqModel;
        }
      }
    });

    it('instantiates OpenAIProvider when LLM_PROVIDER=openai without crashing if key is empty', () => {
      const originalProvider = process.env.LLM_PROVIDER;
      const originalKey = process.env.OPENAI_API_KEY;
      try {
        process.env.LLM_PROVIDER = 'openai';
        delete process.env.OPENAI_API_KEY;

        const provider = getLLMProvider('openai');
        assert.strictEqual(provider.name, 'openai');
        assert.strictEqual(provider.isAvailable(), false);
      } finally {
        if (originalProvider) process.env.LLM_PROVIDER = originalProvider;
        if (originalKey) process.env.OPENAI_API_KEY = originalKey;
      }
    });
  });

  // 2. Missing Key Handling & Validation
  describe('2. Missing GROQ_API_KEY Handling & Startup Validation', () => {
    it('returns a clear error message when GROQ_API_KEY is missing on chatCompletion', async () => {
      const originalKey = process.env.GROQ_API_KEY;
      try {
        delete process.env.GROQ_API_KEY;
        const groq = new GroqProvider();
        assert.strictEqual(groq.isAvailable(), false);

        await assert.rejects(
          async () => {
            await groq.chatCompletion([{ role: 'user', content: 'Hello' }]);
          },
          {
            name: 'Error',
            message: 'Missing GROQ_API_KEY. Add it to .env.',
          }
        );
      } finally {
        if (originalKey) process.env.GROQ_API_KEY = originalKey;
      }
    });

    it('validateEnvironment reports missing GROQ_API_KEY when LLM_PROVIDER is groq', () => {
      const originalProvider = process.env.LLM_PROVIDER;
      const originalKey = process.env.GROQ_API_KEY;
      try {
        process.env.LLM_PROVIDER = 'groq';
        delete process.env.GROQ_API_KEY;

        const result = validateEnvironment();
        assert.strictEqual(result.valid, false);
        assert.ok(result.errors.some((e) => e.includes('Missing GROQ_API_KEY. Add it to .env.')));
      } finally {
        if (originalProvider) process.env.LLM_PROVIDER = originalProvider;
        if (originalKey) process.env.GROQ_API_KEY = originalKey;
      }
    });

    it('validateEnvironment does NOT require OPENAI_API_KEY when LLM_PROVIDER is groq', () => {
      const originalProvider = process.env.LLM_PROVIDER;
      const originalGroq = process.env.GROQ_API_KEY;
      const originalOpenAI = process.env.OPENAI_API_KEY;
      try {
        process.env.LLM_PROVIDER = 'groq';
        process.env.GROQ_API_KEY = 'gsk_test_groq_key';
        delete process.env.OPENAI_API_KEY;

        const result = validateEnvironment();
        assert.strictEqual(result.valid, true);
        assert.strictEqual(result.errors.length, 0);
      } finally {
        if (originalProvider) process.env.LLM_PROVIDER = originalProvider;
        if (originalGroq) process.env.GROQ_API_KEY = originalGroq;
        if (originalOpenAI) process.env.OPENAI_API_KEY = originalOpenAI;
      }
    });
  });

  // 3. Supabase Configuration & Security
  describe('3. Supabase Database Configuration & Client Security', () => {
    it('detects when Supabase is unconfigured and operates with in-memory fallback', () => {
      const originalUrl = process.env.SUPABASE_URL;
      const originalAnon = process.env.SUPABASE_ANON_KEY;
      const originalService = process.env.SUPABASE_SERVICE_ROLE_KEY;
      try {
        delete process.env.SUPABASE_URL;
        delete process.env.SUPABASE_ANON_KEY;
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;

        assert.strictEqual(isSupabaseConfigured(), false);
        assert.strictEqual(getSupabaseServerClient(), null);
      } finally {
        if (originalUrl) process.env.SUPABASE_URL = originalUrl;
        if (originalAnon) process.env.SUPABASE_ANON_KEY = originalAnon;
        if (originalService) process.env.SUPABASE_SERVICE_ROLE_KEY = originalService;
      }
    });

    it('supabaseDbService gracefully returns null without throwing when unconfigured', async () => {
      const profile = await supabaseDbService.getProfile('non_existent_user');
      assert.strictEqual(profile, null);
    });

    it('never leaks SUPABASE_SERVICE_ROLE_KEY or GROQ_API_KEY in agent response payload', async () => {
      const convId = `security_leak_test_${Date.now()}`;
      contextManager.clearContext(convId);

      const res = await orchestrator.processMessage({
        conversationId: convId,
        message: 'Find me a gaming laptop',
      });

      const serialized = JSON.stringify(res);
      assert.ok(!serialized.includes('SUPABASE_SERVICE_ROLE_KEY'));
      assert.ok(!serialized.includes('GROQ_API_KEY'));
      assert.ok(!serialized.includes('OPENAI_API_KEY'));
    });
  });

  // 4. LLM Service Interface Compatibility & Workflow
  describe('4. LLM Service Interface Compatibility', () => {
    it('llmService exposes active provider getters and maintains classification interface', async () => {
      assert.strictEqual(typeof llmService.activeProviderName, 'string');
      assert.strictEqual(typeof llmService.activeModel, 'string');

      const intentRes = await llmService.classifyIntent('Find me a laptop');
      assert.strictEqual(intentRes.intent, 'PRODUCT_SEARCH');

      const reqRes = await llmService.extractRequirements('Find me a bus from Hyderabad to Bangalore', 'BUS_SEARCH');
      assert.strictEqual(reqRes.requirements.category, 'bus');
      assert.strictEqual(reqRes.requirements.source, 'Hyderabad');
      assert.strictEqual(reqRes.requirements.destination, 'Bangalore');
    });

    it('end-to-end agent query executes smoothly with Groq provider configuration', async () => {
      const convId = `e2e_groq_flow_${Date.now()}`;
      contextManager.clearContext(convId);

      const res = await orchestrator.processMessage({
        conversationId: convId,
        message: 'Find me an ASUS gaming laptop under 75000',
      });

      assert.strictEqual(res.agentState.intent, 'PRODUCT_SEARCH');
      assert.ok(res.recommendations && res.recommendations.length > 0);
      assert.ok(res.message.includes('ASUS') || res.message.includes('laptop') || res.message.includes('option'));
    });
  });
});
