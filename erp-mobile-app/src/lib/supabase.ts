import { Capacitor } from '@capacitor/core';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { RealtimeClient } from '@supabase/realtime-js';
import { clearSecure } from './secureStorage';
import { syncCounterRefreshTokenForUserId } from './counterUserVault';
import { maintainCounterVaultTokens } from './counterVaultMaintenance';
import {
  installNativeStaleTokenConsoleFilter,
  isStaleRefreshTokenError,
  noteRefreshFailure,
  recoverStaleAuthSession,
  recoverStaleAuthSessionFromBootstrap,
} from './authSessionRecovery';

/** Vite defines `import.meta.env`; Node (e.g. tsx --test) does not — avoid crashing on import. */
const env =
  typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string | boolean | undefined> }).env
    ? ((import.meta as { env: Record<string, string | boolean | undefined> }).env)
    : ({} as Record<string, string | boolean | undefined>);

let supabaseUrl = String(env.VITE_SUPABASE_URL ?? '').trim();
const origin = typeof window !== 'undefined' ? window.location.origin : '';

const isNativeCapacitor = Capacitor.isNativePlatform();

/**
 * Local Vite dev (localhost / LAN IP): Kong CORS only allows erp.dincouture.pk, so direct
 * calls to supabase.dincouture.pk fail. Use same-origin URL — vite.config.ts proxies
 * /auth/v1, /rest/v1, etc. to https://supabase.dincouture.pk.
 */
const isViteDevLocal =
  Boolean(env.DEV) &&
  origin &&
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
const isViteDevLan =
  Boolean(env.DEV) &&
  origin &&
  /^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(origin);

/**
 * Native Android/iOS: NEVER substitute window.location.origin (often http://localhost or
 * capacitor://localhost) — that targets the device, not the VPS.
 * @see docs/infra/MOBILE_APK_LOCKED_PATTERN.md
 *
 * PWA on erp.dincouture.pk: use VITE_SUPABASE_URL (direct supabase.dincouture.pk) — not
 * same-origin erp nginx /storage proxy (Traefik/nginx upload bottleneck on VPS).
 */
if (isNativeCapacitor) {
  supabaseUrl = String(env.VITE_SUPABASE_URL ?? '').trim();
} else if (isViteDevLocal || isViteDevLan) {
  supabaseUrl = origin;
} else {
  supabaseUrl = String(env.VITE_SUPABASE_URL ?? '').trim();
}
const supabaseAnonKey = String(env.VITE_SUPABASE_ANON_KEY ?? '').trim();

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
  hasConfig && env.VITE_DISABLE_REALTIME !== 'true' && !isDemoSupabaseAnonKey(supabaseAnonKey);

let mobileRealtimeRuntimeDisabled = false;
let mobileRealtimeFailureCount = 0;
const MOBILE_REALTIME_MAX_FAILURES = 3;

export function noteMobileRealtimeConnectionFailure(): void {
  if (!env.DEV) return;
  mobileRealtimeFailureCount += 1;
  if (mobileRealtimeFailureCount >= MOBILE_REALTIME_MAX_FAILURES) {
    mobileRealtimeRuntimeDisabled = true;
    console.warn('[ERP Mobile] Realtime disabled for this session after repeated WebSocket failures');
  }
}

export function resetMobileRealtimeFailureCount(): void {
  mobileRealtimeFailureCount = 0;
}

export function mobileCanSubscribeRealtime(): boolean {
  return erpMobileCanUseRealtime && !mobileRealtimeRuntimeDisabled;
}

export const mobileRealtimeHealth = {
  configured: hasConfig,
  get canUseRealtime() {
    return mobileCanSubscribeRealtime();
  },
  reason: !hasConfig
    ? 'missing-env'
    : isDemoSupabaseAnonKey(supabaseAnonKey)
      ? 'demo-anon-key'
      : env.VITE_DISABLE_REALTIME === 'true'
        ? 'disabled-by-env'
        : mobileRealtimeRuntimeDisabled
          ? 'runtime-ws-failures'
          : 'ok',
} as const;

/**
 * REST/Auth stay same-origin in dev (Vite proxy). Realtime WebSockets through that proxy are
 * fragile; use a direct wss:// URL to VITE_SUPABASE_HOST when in dev on localhost/LAN.
 */
function attachDirectRealtimeInLocalDev(client: SupabaseClient): void {
  if (typeof window === 'undefined' || !env.DEV || isNativeCapacitor) return;
  if (!isViteDevLocal && !isViteDevLan) return;
  if (!hasConfig || isDemoSupabaseAnonKey(supabaseAnonKey)) return;

  const configured = String(env.VITE_SUPABASE_URL ?? '').trim().replace(/\/$/, '');
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

if (isNativeCapacitor) {
  installNativeStaleTokenConsoleFilter();
}

let counterVaultSyncTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleCounterVaultTokenSync(session: { user: { id: string }; refresh_token?: string } | null): void {
  const uid = session?.user?.id;
  const rt = session?.refresh_token;
  if (!uid || !rt) return;
  if (counterVaultSyncTimer) clearTimeout(counterVaultSyncTimer);
  counterVaultSyncTimer = setTimeout(() => {
    counterVaultSyncTimer = null;
    void syncCounterRefreshTokenForUserId(uid, rt).catch(() => {});
  }, 400);
}

/** Auto-fix: when session is lost (refresh failed, CORS, etc.), clear PIN vault and notify app */
if (hasConfig) {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
      if (session) scheduleCounterVaultTokenSync(session);
    }
    if (event === 'SIGNED_OUT' && !session) {
      clearSecure().catch(() => {});
      window.dispatchEvent(new CustomEvent('erp-auth-signed-out'));
    }
    if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
      void supabase.auth.getSession().then(({ error }) => {
        if (error) {
          const stale = isStaleRefreshTokenError(error);
          const tripped = stale || noteRefreshFailure();
          if (tripped) void recoverStaleAuthSession();
        }
      });
    }
  });
  void recoverStaleAuthSessionFromBootstrap();
}

if (hasConfig && typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void maintainCounterVaultTokens();
    }
  });
}

if (env.DEV) {
  console.info('[ERP Mobile] Realtime health:', mobileRealtimeHealth);
}
