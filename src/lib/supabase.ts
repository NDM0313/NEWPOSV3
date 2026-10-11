// ============================================
// 🎯 SUPABASE CLIENT CONFIGURATION
// ============================================
// Supabase connection for Din Collection ERP

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { RealtimeClient } from '@supabase/realtime-js';
import { getBrowserStorage } from '@/app/lib/safeBrowserStorage';
import {
  getBridgeAccessToken,
  getBridgeSession,
  setResolvedSupabaseConfig,
} from '@/app/lib/supabaseSessionBridge';

// ============================================
// CONFIGURATION
// ============================================

// Get these from Supabase Dashboard → Project Settings → API
// Support both Vite and Next.js variable formats
// IMPORTANT: Vite inlines these at BUILD time. For production Docker build,
// pass VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY as build args (see deploy/Dockerfile).
let supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const NDMCORE_API = 'https://api.ndmcore.com';
const SUPABASE_API_BASE_MARKER = 'erp_supabase_api_base';

function isLegacyDincoutureApiUrl(url: string): boolean {
  return /(?:erp|supabase)\.dincouture\.pk/i.test(url);
}

/** http://192.168.x / 10.x / 172.16–31.x — causes Mixed Content on https://erp.ndmcore.com */
function isInsecureLanApiUrl(url: string): boolean {
  const raw = String(url || '').trim();
  if (!raw) return false;
  if (/192\.168\.86\.235(?::8000)?/i.test(raw)) return true;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:') return false;
    const h = u.hostname;
    return (
      /^192\.168\./.test(h) ||
      /^10\./.test(h) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(h)
    );
  } catch {
    return false;
  }
}

/**
 * Drop GoTrue keys from a prior LAN/Kong bake when the resolved API base changes.
 * Stale sb-*-auth-token entries otherwise keep auto-refresh pointed at http://192.168…:8000.
 */
function purgeStaleAuthStorageIfEndpointMismatch(expectedBase: string): void {
  if (typeof window === 'undefined') return;
  const expected = expectedBase.replace(/\/$/, '');
  const prev = (() => {
    try {
      return window.localStorage.getItem(SUPABASE_API_BASE_MARKER);
    } catch {
      return null;
    }
  })();
  const endpointChanged = Boolean(prev && prev !== expected);

  const storages: Storage[] = [];
  try {
    storages.push(window.localStorage);
  } catch {
    /* blocked */
  }
  try {
    storages.push(window.sessionStorage);
  } catch {
    /* blocked */
  }

  const looksLikeLanAuth = (key: string, value: string | null): boolean =>
    /192\.168\.86\.235|192\.168\.|sb-192168/i.test(key) ||
    /192\.168\.86\.235|http:\/\/192\.168\./i.test(value || '');

  for (const storage of storages) {
    let keys: string[] = [];
    try {
      keys = Object.keys(storage);
    } catch {
      continue;
    }
    for (const key of keys) {
      if (!/^sb-/i.test(key) && key !== SUPABASE_API_BASE_MARKER) continue;
      let value: string | null = null;
      try {
        value = storage.getItem(key);
      } catch {
        value = null;
      }
      if (endpointChanged || looksLikeLanAuth(key, value)) {
        try {
          storage.removeItem(key);
        } catch {
          /* ignore */
        }
      }
    }
  }

  try {
    window.localStorage.setItem(SUPABASE_API_BASE_MARKER, expected);
  } catch {
    /* ignore */
  }
}

// Never ship a LAN Kong URL into a production/HTTPS client (Mixed Content → stuck on Loading…).
if (
  isInsecureLanApiUrl(supabaseUrl) &&
  (!import.meta.env.DEV ||
    (typeof window !== 'undefined' && window.location.protocol === 'https:'))
) {
  supabaseUrl = NDMCORE_API;
}

/** Baked env host — used for direct Realtime WSS in Vite dev while REST uses /supabase proxy. */
const configuredSupabaseHost = supabaseUrl.replace(/\/$/, '');
// Vite dev: same-origin `/supabase` proxy.
// Production on erp.ndmcore.com: call Kong directly at https://api.ndmcore.com (Cloudflare Tunnel).
// Staging erp-stage.ndmcore.com: same-origin (nginx → erp-stage-gateway → erp_core).
// Do NOT use same-origin erp.ndmcore.com/auth (nginx upstream 502). Legacy VPS host keeps same-origin.
if (typeof window !== 'undefined') {
  const hostname = window.location.hostname;
  if (import.meta.env.DEV) {
    supabaseUrl = `${window.location.origin}/supabase`;
  } else if (hostname === 'erp-stage.ndmcore.com') {
    // Strict same-origin — never call api-stage.ndmcore.com from the browser
    supabaseUrl = window.location.origin;
  } else if (hostname === 'erp.ndmcore.com') {
    supabaseUrl = NDMCORE_API;
  } else if (hostname === 'erp.dincouture.pk' || window.location.origin.includes('erp.dincouture.pk')) {
    supabaseUrl = window.location.origin;
  } else if (isLegacyDincoutureApiUrl(supabaseUrl) || /(^|[/.])api\.ndmcore\.com([/:?]|$)/i.test(supabaseUrl)) {
    // Exact api.ndmcore.com only — do not match api-stage.ndmcore.com
    supabaseUrl = NDMCORE_API;
  } else if (isInsecureLanApiUrl(supabaseUrl)) {
    supabaseUrl = NDMCORE_API;
  }
  // Belt-and-suspenders: neutralize any baked api-stage URL on the stage host
  if (hostname === 'erp-stage.ndmcore.com' || /api-stage\.ndmcore\.com/i.test(supabaseUrl)) {
    if (hostname === 'erp-stage.ndmcore.com') {
      supabaseUrl = window.location.origin;
    }
  }
}

if (typeof window !== 'undefined') {
  purgeStaleAuthStorageIfEndpointMismatch(supabaseUrl);
}
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ||
                        import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
                        import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || '').trim();
const UPSTREAM_DEMO_ANON_SIGNATURE = 'uPWERzbv9FtmRpl0cBPDPox08YhjW_zTOXtwYNLWmuo';
function isDemoSupabaseAnonKey(key: string): boolean {
  const parts = key.split('.');
  if (parts.length !== 3) return false;
  return parts[2] === UPSTREAM_DEMO_ANON_SIGNATURE;
}

/** Decode JWT payload `iss` without verifying signature (client-side hint only). */
function decodeJwtIss(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = (4 - (b64.length % 4)) % 4;
    const json = atob(b64 + '='.repeat(pad));
    const payload = JSON.parse(json) as { iss?: string };
    return payload?.iss ?? null;
  } catch {
    return null;
  }
}

/** True when `VITE_SUPABASE_ANON_KEY` is the placeholder demo JWT (`iss=supabase-demo`). Realtime WS often fails against real Kong while REST via proxy may still work. */
export const isPlaceholderSupabaseAnonKey = decodeJwtIss(supabaseAnonKey) === 'supabase-demo';

const isValidSupabaseUrl = supabaseUrl.startsWith('http://') || supabaseUrl.startsWith('https://');

setResolvedSupabaseConfig(supabaseUrl, supabaseAnonKey);

/** Same URL the Supabase client uses (for session-bridge REST fallback). */
export function getResolvedSupabaseUrl(): string {
  return supabaseUrl.replace(/\/$/, '');
}

export function getSupabaseAnonKey(): string {
  return supabaseAnonKey;
}
// DEBUG: Log Supabase URL at runtime (localhost vs production)
if (import.meta.env?.DEV) {
  console.log('[SUPABASE] VITE_SUPABASE_URL at runtime:', import.meta.env.VITE_SUPABASE_URL);
  console.log('[SUPABASE] Resolved supabaseUrl:', supabaseUrl);
}
if (!supabaseUrl || !isValidSupabaseUrl || !supabaseAnonKey) {
  const msg =
    '[Supabase] Missing or invalid config. Set VITE_SUPABASE_URL (full https URL) and VITE_SUPABASE_ANON_KEY. ' +
    'In production these must be set at BUILD time (e.g. docker compose build with --env-file .env.production).';
  console.error(msg);
  throw new Error(msg);
}

if (import.meta.env.DEV && (isPlaceholderSupabaseAnonKey || isDemoSupabaseAnonKey(supabaseAnonKey))) {
  throw new Error(
    '[Supabase] VITE_SUPABASE_ANON_KEY is the public demo JWT. Run: bash scripts/sync-local-env-from-vps.sh then restart npm run dev.'
  );
}

const isDemoAnonKey = isDemoSupabaseAnonKey(supabaseAnonKey);
const isPlaceholderUrl = /placeholder/i.test(supabaseUrl);
const isRealtimeDisabledByEnv = import.meta.env.VITE_DISABLE_REALTIME === 'true';
const erpWebCanUseRealtime = !isPlaceholderUrl && !isDemoAnonKey && !isRealtimeDisabledByEnv;

let webRealtimeRuntimeDisabled = false;
let webRealtimeFailureCount = 0;
const WEB_REALTIME_MAX_FAILURES = 3;

export function noteWebRealtimeConnectionFailure(): void {
  if (!import.meta.env.DEV) return;
  webRealtimeFailureCount += 1;
  if (webRealtimeFailureCount >= WEB_REALTIME_MAX_FAILURES) {
    webRealtimeRuntimeDisabled = true;
    console.warn('[Supabase] Realtime disabled for this session after repeated WebSocket failures');
  }
}

export function resetWebRealtimeFailureCount(): void {
  webRealtimeFailureCount = 0;
}

export function webCanSubscribeRealtime(): boolean {
  return erpWebCanUseRealtime && !webRealtimeRuntimeDisabled;
}

export const webRealtimeHealth = {
  configured: Boolean(supabaseUrl && supabaseAnonKey && !isPlaceholderUrl),
  get canUseRealtime() {
    return webCanSubscribeRealtime();
  },
  reason: !supabaseUrl || !isValidSupabaseUrl || !supabaseAnonKey
    ? 'missing-env'
    : isPlaceholderUrl
      ? 'placeholder-url'
      : isDemoAnonKey
        ? 'demo-anon-key'
        : isRealtimeDisabledByEnv
          ? 'disabled-by-env'
          : webRealtimeRuntimeDisabled
            ? 'runtime-ws-failures'
            : 'ok',
} as const;

// Self-hosted stack / local dev: demo anon key → Realtime WS and auth refresh often fail while REST via proxy may work.
if (typeof window !== 'undefined' && isPlaceholderSupabaseAnonKey) {
  const msg =
    '[Supabase] VITE_SUPABASE_ANON_KEY is the demo JWT (iss=supabase-demo). Set your project anon key for Realtime and auth refresh; dev Realtime subscriptions are skipped to reduce console noise.';
  const host = window.location.hostname;
  if (/ndmcore\.com$/i.test(host) || /dincouture\.pk$/i.test(host)) {
    console.warn(msg + ' Rebuild the ERP image with your project anon JWT for production.');
  } else if (import.meta.env.DEV) {
    console.warn(msg);
  }
}

// Self-hosted stack: if the SPA was built without a real project anon key, JWT iss stays "supabase-demo"
// → realtime WebSocket and /auth/v1/token refresh often fail with 502/HTML while REST may still work.
if (
  typeof window !== 'undefined' &&
  (/ndmcore\.com$/i.test(window.location.hostname) ||
    /dincouture\.pk$/i.test(window.location.hostname))
) {
  try {
    const parts = supabaseAnonKey.split('.');
    if (parts.length === 3) {
      const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const pad = (4 - (b64.length % 4)) % 4;
      const json = atob(b64 + '='.repeat(pad));
      const payload = JSON.parse(json) as { iss?: string };
      if (payload?.iss === 'supabase-demo') {
        console.warn(
          '[Supabase] VITE_SUPABASE_ANON_KEY decodes to iss=supabase-demo. Rebuild the ERP image with your project anon JWT; otherwise Realtime and auth refresh will fail on erp.ndmcore.com.'
        );
      }
    }
  } catch {
    /* ignore decode errors */
  }
}
if (typeof window !== 'undefined' && isDemoAnonKey) {
  console.warn(
    '[Supabase] Realtime disabled: anon key matches public demo signature. Rebuild with real VITE_SUPABASE_ANON_KEY from VPS .env.production.'
  );
}
if (import.meta.env?.DEV) {
  console.info('[Supabase] Realtime health:', webRealtimeHealth);
}

// ============================================
// SAFE STORAGE (avoids SecurityError when localStorage is denied, e.g. iframe/strict privacy)
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

function safeStorage(): Storage {
  if (typeof window === 'undefined') return memoryFallback();
  const ls = getBrowserStorage('local');
  if (ls && probeStorage(ls)) {
    authStorageKind = 'localStorage';
    return ls;
  }
  const ss = getBrowserStorage('session');
  if (ss && probeStorage(ss)) {
    authStorageKind = 'sessionStorage';
    return ss;
  }
  return memoryFallback();
}

/** True when auth session is only in RAM (lost on full navigation unless sessionStorage works). */
export function authStorageIsEphemeral(): boolean {
  return authStorageKind === 'memory';
}

// Never throw – avoids "SecurityError: The request was denied" when storage is blocked (iframe, strict privacy)
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

// ============================================
// CREATE CLIENT
// ============================================

/** Attach JWT from in-memory bridge when GoTrue cannot read storage (production strict privacy). */
function supabaseFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = getBridgeAccessToken();
  if (!token) {
    return fetch(input, init);
  }
  const headers = new Headers(init?.headers);
  if (!headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('apikey')) {
    headers.set('apikey', supabaseAnonKey);
  }
  return fetch(input, { ...init, headers });
}

/** Bypass navigator.locks — SecurityError when cookies/storage blocked in strict browsers. */
async function authLockNoOp<T>(_name: string, _acquireTimeout: number, fn: () => Promise<T>): Promise<T> {
  return await fn();
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: supabaseFetch },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: safeStorage(),
    lock: authLockNoOp,
  },
});

/**
 * Vite dev proxies REST/auth to Kong via `/supabase`, but Realtime WebSockets through that
 * hop often fail (ws://localhost:5173/supabase/realtime/...). Keep HTTP on the proxy; attach
 * a direct wss:// client to the configured production Supabase host.
 */
function attachDirectRealtimeInLocalDev(client: SupabaseClient): void {
  if (typeof window === 'undefined' || !import.meta.env.DEV) return;
  if (!erpWebCanUseRealtime) return;
  if (!configuredSupabaseHost.startsWith('https://') || configuredSupabaseHost.includes('localhost')) {
    return;
  }
  const origin = window.location.origin;
  const isLocalDev =
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin) ||
    /^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(origin);
  if (!isLocalDev) return;
  if (!supabaseUrl.includes('/supabase') && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
    return;
  }

  const realtimeHref = `${configuredSupabaseHost.replace(/^https/i, 'wss')}/realtime/v1`;
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
    const token = data.session?.access_token ?? supabaseAnonKey;
    void rc.setAuth(token);
  });
  if (import.meta.env.DEV) {
    console.info('[Supabase] Realtime WebSocket (dev direct):', realtimeHref);
  }
}

attachDirectRealtimeInLocalDev(supabase);

/** SecurityError / storage denied – GoTrue cannot read persisted session. */
function isStorageSecurityError(err: unknown): boolean {
  if (!err) return false;
  const msg = String((err as { message?: string })?.message ?? err).toLowerCase();
  const name = String((err as { name?: string })?.name ?? '').toLowerCase();
  return (
    name === 'securityerror' ||
    msg.includes('securityerror') ||
    msg.includes('request was denied') ||
    msg.includes('access is denied')
  );
}

function bridgeSessionResult(): { data: { session: import('@supabase/supabase-js').Session }; error: null } | null {
  const bridged = getBridgeSession();
  if (!bridged) return null;
  return { data: { session: bridged }, error: null };
}

const originalGetSession = supabase.auth.getSession.bind(supabase.auth);
supabase.auth.getSession = async () => {
  try {
    const result = await originalGetSession();
    if (result.error && isStorageSecurityError(result.error)) {
      const fallback = bridgeSessionResult();
      if (fallback) return fallback;
    }
    if (!result.data.session) {
      const fallback = bridgeSessionResult();
      if (fallback) return fallback;
    }
    return result;
  } catch (e) {
    if (isStorageSecurityError(e)) {
      const fallback = bridgeSessionResult();
      if (fallback) return fallback;
      return { data: { session: null }, error: e as import('@supabase/supabase-js').AuthError };
    }
    throw e;
  }
};

const originalGetUser = supabase.auth.getUser.bind(supabase.auth);
supabase.auth.getUser = async () => {
  try {
    const result = await originalGetUser();
    if (result.error && isStorageSecurityError(result.error)) {
      const bridged = getBridgeSession();
      if (bridged?.user) return { data: { user: bridged.user }, error: null };
    }
    if (!result.data.user) {
      const bridged = getBridgeSession();
      if (bridged?.user) return { data: { user: bridged.user }, error: null };
    }
    return result;
  } catch (e) {
    if (isStorageSecurityError(e)) {
      const bridged = getBridgeSession();
      if (bridged?.user) return { data: { user: bridged.user }, error: null };
      return { data: { user: null }, error: e as import('@supabase/supabase-js').AuthError };
    }
    throw e;
  }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

export const getSession = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
};
