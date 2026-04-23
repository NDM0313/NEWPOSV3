import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { RealtimeClient } from '@supabase/realtime-js';
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

/**
 * Public upstream Supabase *tutorial* anon JWT — will not work against self-hosted / real projects.
 *
 * NOTE: Self-hosted Supabase (via our deploy/gen-jwt-keys.cjs) also signs keys with iss='supabase-demo',
 * so relying only on `iss` gives false positives. The UPSTREAM demo signature below is the unique
 * fingerprint of the public tutorial key (signed with the well-known default secret
 * "super-secret-jwt-token-with-at-least-32-characters-long"). Matching the exact signature is the
 * only reliable way to detect the real "demo" case without flagging legitimately-regenerated keys.
 */
const UPSTREAM_DEMO_ANON_SIGNATURE = 'uPWERzbv9FtmRpl0cBPDPox08YhjW_zTOXtwYNLWmuo';
function isDemoSupabaseAnonKey(key: string): boolean {
  const parts = key.split('.');
  if (parts.length !== 3) return false;
  return parts[2] === UPSTREAM_DEMO_ANON_SIGNATURE;
}

if (typeof window !== 'undefined' && hasConfig && isDemoSupabaseAnonKey(supabaseAnonKey)) {
  console.warn(
    '[ERP Mobile] VITE_SUPABASE_ANON_KEY is the public Supabase demo JWT (iss supabase-demo). Copy the real anon key from your VPS / web .env.production. Realtime is disabled until fixed.'
  );
}

const url = hasConfig ? supabaseUrl : 'https://placeholder.supabase.co';
const key = hasConfig ? supabaseAnonKey : 'placeholder-key';

export const isSupabaseConfigured = hasConfig;

/** True when VITE_SUPABASE_ANON_KEY is the public tutorial JWT (iss supabase-demo). Fix: copy real anon key from web .env.production. */
export const erpMobileUsingDemoSupabaseAnonKey = hasConfig && isDemoSupabaseAnonKey(supabaseAnonKey);

/** Use postgres_changes / Realtime only when config is valid and not the demo anon key. */
export const erpMobileCanUseRealtime =
  hasConfig && import.meta.env.VITE_DISABLE_REALTIME !== 'true' && !isDemoSupabaseAnonKey(supabaseAnonKey);

/**
 * REST/Auth stay same-origin in dev (Vite proxy). Realtime WebSockets through that proxy are
 * fragile; use a direct wss:// URL to VITE_SUPABASE_HOST when in dev on localhost/LAN.
 */
function attachDirectRealtimeInLocalDev(client: SupabaseClient): void {
  if (typeof window === 'undefined' || !import.meta.env.DEV) return;
  if (!isViteDevLocal && !isViteDevLan) return;
  if (!hasConfig || isDemoSupabaseAnonKey(supabaseAnonKey)) return;

  const configured = (import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
  if (!configured.startsWith('https://') || configured.includes('localhost')) return;

  const realtimeHref = `${configured.replace(/^https/i, 'wss')}/realtime/v1`;
  try {
    client.realtime.disconnect();
  } catch {
    /* ignore */
  }
  const rc = new RealtimeClient(realtimeHref, {
    params: { apikey: supabaseAnonKey },
    accessToken: async () => {
      const { data } = await client.auth.getSession();
      return data.session?.access_token ?? supabaseAnonKey;
    },
  });
  (client as unknown as { realtime: RealtimeClient }).realtime = rc;
  void client.auth.getSession().then(({ data }) => {
    const t = data.session?.access_token ?? supabaseAnonKey;
    void rc.setAuth(t);
  });
}

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

attachDirectRealtimeInLocalDev(supabase);

/** Auto-fix: when session is lost (refresh failed, CORS, etc.), clear PIN vault and notify app */
if (hasConfig) {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' && !session) {
      clearSecure().catch(() => {});
      window.dispatchEvent(new CustomEvent('erp-auth-signed-out'));
    }
  });
}
