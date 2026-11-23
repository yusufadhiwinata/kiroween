import { AppState } from 'react-native';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL, isBackendConfigured } from '../config/env';
import { authStorage } from '../storage/mmkv';

let client: SupabaseClient | null = null;

/** Returns the Supabase client, or null when the app runs without a backend. */
export function getSupabase(): SupabaseClient | null {
  if (!isBackendConfigured()) return null;
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: authStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
    // Refresh tokens only while the app is in the foreground.
    AppState.addEventListener('change', state => {
      if (state === 'active') client?.auth.startAutoRefresh();
      else client?.auth.stopAutoRefresh();
    });
  }
  return client;
}

/** Network-level failures are retried; database/validation errors are not. */
export function isTransientError(error: unknown): boolean {
  if (!error) return false;
  const e = error as { code?: string; status?: number; message?: string; name?: string };
  if (e.status && e.status >= 500) return true;
  if (e.status === 429 || e.status === 408) return true;
  if (e.code && /^[0-9A-Z]{5}$/.test(e.code)) return false; // SQLSTATE
  if (e.status && e.status >= 400) return false;
  const msg = `${e.name ?? ''} ${e.message ?? ''}`.toLowerCase();
  return msg.includes('network') || msg.includes('fetch') || msg.includes('timeout') || msg.includes('abort') || !e.code;
}
