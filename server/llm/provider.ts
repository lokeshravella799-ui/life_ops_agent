import { groqProvider } from './groqProvider';
import { openaiProvider } from './openaiProvider';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: 'json_object' | 'text' };
}

export interface LLMProvider {
  readonly name: string;
  readonly model: string;
  isAvailable(): boolean;
  chatCompletion(messages: ChatMessage[], options?: ChatCompletionOptions): Promise<string>;
}

export function getLLMProvider(_providerName?: string): LLMProvider {
  // Groq is the ONLY LLM provider in LifeOps Agent
  return groqProvider;
}
