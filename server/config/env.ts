import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootEnvPath = path.resolve(__dirname, '../../.env');
const serverEnvPath = path.resolve(__dirname, '../.env');

if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
} else if (fs.existsSync(serverEnvPath)) {
  dotenv.config({ path: serverEnvPath });
} else {
  dotenv.config();
}

export interface EnvironmentConfig {
  PORT: number;
  NODE_ENV: string;
  LLM_PROVIDER: string;
  LLM_MODEL: string;
  GROQ_MODEL?: string;
  GROQ_API_KEY?: string;
  OPENAI_API_KEY?: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  FLIPKART_API_KEY?: string;
  FLIPKART_AFFILIATE_ID?: string;
  AMAZON_API_KEY?: string;
  AMAZON_PARTNER_TAG?: string;
  BUS_PROVIDER_API_KEY?: string;
  HOTEL_PROVIDER_API_KEY?: string;
  FLIGHT_PROVIDER_API_KEY?: string;
}

export const env: EnvironmentConfig = {
  PORT: parseInt(process.env.PORT || '3001', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  LLM_PROVIDER: (process.env.LLM_PROVIDER || 'groq').toLowerCase(),
  LLM_MODEL: process.env.GROQ_MODEL || process.env.LLM_MODEL || 'openai/gpt-oss-120b',
  GROQ_MODEL: process.env.GROQ_MODEL || process.env.LLM_MODEL || 'openai/gpt-oss-120b',
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  FLIPKART_API_KEY: process.env.FLIPKART_API_KEY,
  FLIPKART_AFFILIATE_ID: process.env.FLIPKART_AFFILIATE_ID,
  AMAZON_API_KEY: process.env.AMAZON_API_KEY,
  AMAZON_PARTNER_TAG: process.env.AMAZON_PARTNER_TAG,
  BUS_PROVIDER_API_KEY: process.env.BUS_PROVIDER_API_KEY,
  HOTEL_PROVIDER_API_KEY: process.env.HOTEL_PROVIDER_API_KEY,
  FLIGHT_PROVIDER_API_KEY: process.env.FLIGHT_PROVIDER_API_KEY,
};

export interface EnvironmentValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateEnvironment(strict = false): EnvironmentValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const activeProvider = (process.env.LLM_PROVIDER ?? env.LLM_PROVIDER ?? 'groq').toLowerCase();
  const groqKey = process.env.GROQ_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  // Validate LLM provider keys
  if (activeProvider === 'groq') {
    if (!groqKey || groqKey.trim() === '') {
      errors.push('Missing GROQ_API_KEY. Add it to .env.');
    }
  } else if (activeProvider === 'openai') {
    if (!openaiKey || openaiKey.trim() === '') {
      errors.push('Missing OPENAI_API_KEY. Add it to .env.');
    }
  }

  // Validate Supabase configuration (optional warning if not set)
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    warnings.push('Supabase database credentials not configured in .env. Operating with in-memory persistence store.');
  }

  const valid = errors.length === 0;

  if (strict && !valid) {
    throw new Error(`Environment validation failed:\n${errors.map((e) => `• ${e}`).join('\n')}`);
  }

  return {
    valid,
    errors,
    warnings,
  };
}
