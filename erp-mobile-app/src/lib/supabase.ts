import { createClient } from '@supabase/supabase-js';
import { clearSecure } from './secureStorage';

let supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
// erp.dincouture.pk auth proxy returns 308 redirect → "Unexpected token '/', \"/auth\" is not valid JSON"
if (supabaseUrl.includes('erp.dincouture.pk')) {
  supabaseUrl = supabaseUrl.replace(/https?:\/\/erp\.dincouture\.pk\/?/i, 'https://supabase.dincouture.pk');
}
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

/** Auto-fix: when session is lost (refresh failed, CORS, etc.), clear PIN vault and notify app */
if (hasConfig) {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' && !session) {
      clearSecure().catch(() => {});
      window.dispatchEvent(new CustomEvent('erp-auth-signed-out'));
    }
  });
}
