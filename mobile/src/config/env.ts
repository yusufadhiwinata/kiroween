/**
 * Public client configuration.
 *
 * Only the Supabase project URL and the *anon* key belong here. The anon key is
 * designed to be public: every table is protected by Row Level Security and all
 * rewards are computed by server functions. Never put the service-role key or
 * the LLM API key in the app — the LLM key lives in Edge Function secrets.
 */
export const SUPABASE_URL = 'https://ggqzwmuthchgqywzbokf.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_3f7Z3sZs3a0WP8RPJEUvkg_zJa16TX_';

export const isBackendConfigured = (): boolean =>
  SUPABASE_URL.startsWith('https://') && SUPABASE_ANON_KEY.length > 20;
