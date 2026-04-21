import { createClient } from '@supabase/supabase-js';
import { clearSecure } from './secureStorage';

let supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const origin = typeof window !== 'undefined' ? window.location.origin : '';

/**
 * Local Vite dev (localhost / LAN IP): Kong CORS only allows erp.dincouture.pk, so direct
 * calls to supabase.dincouture.pk fail. Use same-origin URL — vite.config.ts proxies
 * /auth/v1, /rest/v1, etc. to https://supabase.dincouture.pk.
 */
const isViteDevLocal =
  import.meta.env.DEV &&
  origin &&
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
const isViteDevLan =
  import.meta.env.DEV &&
  origin &&
  /^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(origin);

if (isViteDevLocal || isViteDevLan) {
  supabaseUrl = origin;
}

// Production: when app is served from erp.dincouture.pk/m, always use Supabase API at supabase.dincouture.pk (fixes localhost works / production fails)
if (origin.includes('erp.dincouture.pk')) {
  supabaseUrl = 'https://supabase.dincouture.pk';
}
// Build had wrong URL (e.g. erp proxy): replace so auth gets JSON not redirect
if (supabaseUrl.includes('erp.dincouture.pk')) {
  supabaseUrl = 'https://supabase.dincouture.pk';
}
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

const hasConfig = Boolean(supabaseUrl && supabaseAnonKey && !supabaseUrl.startsWith('http://placeholder'));
if (!hasConfig) {
  const onProduction = typeof window !== 'undefined' && window.location.origin.includes('erp.dincouture.pk');
  console.warn(
    onProduction
      ? '[ERP Mobile] Missing Supabase config on production. Redeploy: on VPS run git pull && bash deploy/deploy.sh so build gets VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from .env.production.'
      : '[ERP Mobile] Set VITE_SUPABASE_ANON_KEY in erp-mobile-app/.env (copy from main project .env.production or .env.local). Restart dev server after editing .env.'
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
