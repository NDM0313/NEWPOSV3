import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

const hasConfig = Boolean(supabaseUrl && supabaseAnonKey && !supabaseUrl.startsWith('http://placeholder'));
if (!hasConfig) {
  console.warn(
    '[ERP Mobile] Set VITE_SUPABASE_ANON_KEY in erp-mobile-app/.env (copy from main project .env.production or .env.local). Restart dev server after editing .env.'
  );
}

const url = hasConfig ? supabaseUrl : 'https://placeholder.supabase.co';
const key = hasConfig ? supabaseAnonKey : 'placeholder-key';

export const isSupabaseConfigured = hasConfig;

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
