import { Capacitor } from '@capacitor/core';
import { createClient } from '@supabase/supabase-js';
import { clearSecure } from './secureStorage';
import {
  installNativeStaleTokenConsoleFilter,
  installStaleTokenRecoveryForWeb,
  isStaleRefreshTokenError,
  noteRefreshFailure,
  recoverStaleAuthSession,
  recoverStaleAuthSessionAfterInitCheck,
  recoverStaleAuthSessionFromBootstrap,
  recoverStaleAuthSessionIfNeeded,
} from './authSessionRecovery';
import { resolveSupabaseApiUrl } from './resolveSupabaseApiUrl';

/** Vite defines `import.meta.env`; Node (e.g. tsx --test) does not — avoid crashing on import. */
const env =
  typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string | boolean | undefined> }).env
    ? ((import.meta as { env: Record<string, string | boolean | undefined> }).env)
    : ({} as Record<string, string | boolean | undefined>);

const isNativeCapacitor = Capacitor.isNativePlatform();

const supabaseUrl = resolveSupabaseApiUrl(String(env.VITE_SUPABASE_URL ?? ''), {
  isNativeCapacitor,
  isDev: Boolean(env.DEV),
});

/**
 * Production PWA/native: direct supabase.dincouture.pk (never erp nginx /storage proxy).
 * Vite dev browser: same-origin localhost → Vite proxy → Kong (auth, REST, storage, Realtime WS).
 * @see resolveSupabaseApiUrl.ts
 */
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
let lastMobileRealtimeFailureAt = 0;
let mobileRealtimeTeardownDone = false;
const MOBILE_REALTIME_MAX_FAILURES = env.DEV ? 5 : 3;
const MOBILE_REALTIME_FAILURE_DEBOUNCE_MS = 3000;

export function resetMobileRealtimeFailureCount(): void {
  mobileRealtimeFailureCount = 0;
  lastMobileRealtimeFailureAt = 0;
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

// ============================================
// SAFE STORAGE (avoids SecurityError when localStorage is denied)
// ============================================

const memoryStore: Record<string, string> = {};
let authStorageKind: 'localStorage' | 'sessionStorage' | 'memory' = 'memory';

function probeStorage(storage: Storage): boolean {
  try {
    const probe = '__sb_probe__';
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

function memoryFallback(): Storage {
  authStorageKind = 'memory';
  return {
    getItem: (key: string) => {
      try { return memoryStore[key] ?? null; } catch { return null; }
    },
    setItem: (key: string, value: string) => {
      try { memoryStore[key] = value; } catch { /* no-op */ }
    },
    removeItem: (key: string) => {
      try { delete memoryStore[key]; } catch { /* no-op */ }
    },
    key: (i: number) => {
      try { return Object.keys(memoryStore)[i] ?? null; } catch { return null; }
    },
    get length() {
      try { return Object.keys(memoryStore).length; } catch { return 0; }
    },
    clear: () => {
      try { for (const k of Object.keys(memoryStore)) delete memoryStore[k]; } catch { /* no-op */ }
    },
  };
}

function safeStorage(): Storage {
  if (typeof window === 'undefined') return memoryFallback();
  try {
    if (probeStorage(localStorage)) {
      authStorageKind = 'localStorage';
      return localStorage;
    }
  } catch { /* ignore */ }
  try {
    if (probeStorage(sessionStorage)) {
      authStorageKind = 'sessionStorage';
      return sessionStorage;
    }
  } catch { /* ignore */ }
  return memoryFallback();
}

/** True when auth session is only in RAM (lost on full navigation unless sessionStorage works). */
export function authStorageIsEphemeral(): boolean {
  return authStorageKind === 'memory';
}

export function getResolvedSupabaseUrl(): string {
  return url;
}

export function getResolvedAnonKey(): string {
  return key;
}

/** Bypass navigator.locks — SecurityError when cookies/storage blocked in strict browsers. */
async function authLockNoOp<T>(_name: string, _acquireTimeout: number, fn: () => Promise<T>): Promise<T> {
  return await fn();
}

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: safeStorage(),
    lock: authLockNoOp,
  },
});

export function noteMobileRealtimeConnectionFailure(): void {
  if (!env.DEV || mobileRealtimeRuntimeDisabled) return;
  const now = Date.now();
  if (now - lastMobileRealtimeFailureAt < MOBILE_REALTIME_FAILURE_DEBOUNCE_MS) return;
  lastMobileRealtimeFailureAt = now;
  mobileRealtimeFailureCount += 1;
  if (mobileRealtimeFailureCount >= MOBILE_REALTIME_MAX_FAILURES) {
    mobileRealtimeRuntimeDisabled = true;
    console.warn('[ERP Mobile] Realtime disabled for this session after repeated WebSocket failures');
    if (!mobileRealtimeTeardownDone) {
      mobileRealtimeTeardownDone = true;
      void supabase.removeAllChannels().catch(() => {});
      console.info('[ERP Mobile] Realtime unavailable in dev — using 45s polling fallback');
    }
  }
}

if (isNativeCapacitor) {
  installNativeStaleTokenConsoleFilter();
} else {
  installStaleTokenRecoveryForWeb();
}

/** Auto-fix: when session is lost (refresh failed, CORS, etc.), clear PIN vault and notify app */
if (hasConfig) {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' && !session) {
      clearSecure().catch(() => {});
      window.dispatchEvent(new CustomEvent('erp-auth-signed-out'));
    }
    if (event === 'INITIAL_SESSION') {
      void recoverStaleAuthSessionAfterInitCheck();
    } else if (event === 'TOKEN_REFRESHED') {
      void supabase.auth.getSession().then(({ error }) => {
        if (error) {
          const stale = isStaleRefreshTokenError(error);
          const tripped = stale || noteRefreshFailure(error);
          if (tripped) {
            void (stale ? recoverStaleAuthSessionIfNeeded(error) : recoverStaleAuthSession());
          }
        }
      });
    }
  });
  void recoverStaleAuthSessionFromBootstrap();
}

if (env.DEV && typeof window !== 'undefined') {
  console.info('[ERP Mobile] Realtime health:', mobileRealtimeHealth);
}
