import type { LLMProvider, ChatMessage, ChatCompletionOptions } from './provider';
import { logger } from '../utils/logger';

export class OpenAIProvider implements LLMProvider {
  readonly name = 'openai';

  get model(): string {
    return process.env.LLM_MODEL || 'gpt-4o-mini';
  }

  isAvailable(): boolean {
    const key = process.env.OPENAI_API_KEY;
    return Boolean(key && key.trim() !== '');
  }

  async chatCompletion(messages: ChatMessage[], options?: ChatCompletionOptions): Promise<string> {
    const key = process.env.OPENAI_API_KEY;
    if (!key || key.trim() === '') {
      throw new Error('Missing OPENAI_API_KEY. Add it to .env.');
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: options?.temperature ?? 0.2,
          max_tokens: options?.max_tokens,
          response_format: options?.response_format,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`OpenAI API HTTP ${response.status}: ${errorBody}`);
      }

      const json = await response.json();
      return json.choices?.[0]?.message?.content || '';
    } catch (err: any) {
      logger.error('OpenAI API completion error', { error: err?.message, model: this.model });
      throw err;
    }
  }
}

export const openaiProvider = new OpenAIProvider();
