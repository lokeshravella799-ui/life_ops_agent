import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

let serverClientInstance: SupabaseClient | null = null;

/**
 * Checks if Supabase URL and a valid API key (service-role or anon key) are configured.
 */
export function isSupabaseConfigured(): boolean {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  return Boolean(url && url.trim() !== '' && key && key.trim() !== '');
}

/**
 * Creates or returns the singleton server-side Supabase client.
 * Strictly server-side only: never expose service-role credentials to the client.
 */
export function getSupabaseServerClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (serverClientInstance) {
    return serverClientInstance;
  }

  const url = process.env.SUPABASE_URL!;
  // Prefer service role key on server for privileged operations, fallback to anon key
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)!;

  try {
    serverClientInstance = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    logger.info('Initialized server-side Supabase client');
    return serverClientInstance;
  } catch (err: any) {
    logger.error('Failed to initialize Supabase client', { error: err?.message });
    return null;
  }
}
