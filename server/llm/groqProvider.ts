import Groq from 'groq-sdk';
import type { LLMProvider, ChatMessage, ChatCompletionOptions } from './provider';
import { logger } from '../utils/logger';

export class GroqProvider implements LLMProvider {
  readonly name = 'groq';

  get model(): string {
    return process.env.GROQ_MODEL || process.env.LLM_MODEL || 'openai/gpt-oss-120b';
  }

  isAvailable(): boolean {
    const key = process.env.GROQ_API_KEY;
    return Boolean(key && key.trim() !== '');
  }

  async chatCompletion(messages: ChatMessage[], options?: ChatCompletionOptions): Promise<string> {
    const key = process.env.GROQ_API_KEY;
    if (!key || key.trim() === '') {
      console.error('[LLM] error: Missing GROQ_API_KEY in environment');
      throw new Error('Missing GROQ_API_KEY. Add it to .env.');
    }

    const targetModel = this.model;
    const isReasoningModel = targetModel.includes('oss') || targetModel.includes('r1') || targetModel.includes('compound');
    const tokenLimit = isReasoningModel ? Math.max(options?.max_tokens ?? 800, 800) : (options?.max_tokens ?? 650);

    console.log(`[LLM] PROVIDER: ${this.name}`);
    console.log(`[LLM] MODEL: ${targetModel}`);
    console.log(`[LLM] REQUEST STARTED: tokens=${tokenLimit}, temp=${options?.temperature ?? 0.3}`);

    try {
      const groq = new Groq({ apiKey: key, timeout: 25000 });
      const createParams: any = {
        model: targetModel,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: options?.temperature ?? 0.3,
        max_tokens: tokenLimit,
        response_format: options?.response_format,
      };

      if (isReasoningModel) {
        // Prevent reasoning output from consuming the token budget
        createParams.reasoning_format = 'hidden';
      }

      const response = await groq.chat.completions.create(createParams);

      const choice = response.choices?.[0];
      const content = choice?.message?.content?.trim() || (choice?.message as any)?.reasoning?.trim();
      if (content) {
        console.log(`[LLM] RESPONSE RECEIVED: length=${content.length} chars`);
        logger.info('[LLM] response received', { model: targetModel, length: content.length });
        return content;
      }
      throw new Error('Groq returned an empty response.');
    } catch (err: any) {
      console.error(`[LLM ERROR] status=${err?.status ?? 'N/A'}`);
      console.error(`[LLM ERROR] message=${err?.message ?? err}`);
      logger.error('[LLM] error', { model: targetModel, error: err?.message, status: err?.status });
      throw err;
    }
  }
}

export const groqProvider = new GroqProvider();
