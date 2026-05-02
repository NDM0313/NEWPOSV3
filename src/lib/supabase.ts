// ============================================
// 🎯 SUPABASE CLIENT CONFIGURATION
// ============================================
// Supabase connection for Din Collection ERP

import { createClient } from '@supabase/supabase-js';

// ============================================
// CONFIGURATION
// ============================================

// Get these from Supabase Dashboard → Project Settings → API
// Support both Vite and Next.js variable formats
// IMPORTANT: Vite inlines these at BUILD time. For production Docker build,
// pass VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY as build args (see deploy/Dockerfile).
let supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
// Production (app served from erp.dincouture.pk): same-origin so /auth/, /rest/ go through nginx → Kong (avoids SecurityError).
// Vite dev: always use same-origin `/supabase` (see vite.config.ts proxy). LAN IPs (e.g. 192.168.x.x:5173) must not call
// https://supabase.dincouture.pk directly or Kong may reject the browser Origin with CORS (localhost-only bypass was insufficient).
if (typeof window !== 'undefined') {
  if (import.meta.env.DEV) {
    supabaseUrl = `${window.location.origin}/supabase`;
  } else if (window.location.origin.includes('erp.dincouture.pk')) {
    supabaseUrl = window.location.origin;
  } else if (supabaseUrl.includes('erp.dincouture.pk')) {
    supabaseUrl = 'https://supabase.dincouture.pk';
  }
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

const isDemoAnonKey = isDemoSupabaseAnonKey(supabaseAnonKey);
const isPlaceholderUrl = /placeholder/i.test(supabaseUrl);
const isRealtimeDisabledByEnv = import.meta.env.VITE_DISABLE_REALTIME === 'true';
const canUseRealtime = !isPlaceholderUrl && !isDemoAnonKey && !isRealtimeDisabledByEnv;

export const webRealtimeHealth = {
  configured: Boolean(supabaseUrl && supabaseAnonKey && !isPlaceholderUrl),
  canUseRealtime,
  reason: !supabaseUrl || !isValidSupabaseUrl || !supabaseAnonKey
    ? 'missing-env'
    : isPlaceholderUrl
      ? 'placeholder-url'
      : isDemoAnonKey
        ? 'demo-anon-key'
        : isRealtimeDisabledByEnv
          ? 'disabled-by-env'
          : 'ok',
} as const;

// Self-hosted stack / local dev: demo anon key → Realtime WS and auth refresh often fail while REST via proxy may work.
if (typeof window !== 'undefined' && isPlaceholderSupabaseAnonKey) {
  const msg =
    '[Supabase] VITE_SUPABASE_ANON_KEY is the demo JWT (iss=supabase-demo). Set your project anon key for Realtime and auth refresh; dev Realtime subscriptions are skipped to reduce console noise.';
  if (/dincouture\.pk$/i.test(window.location.hostname)) {
    console.warn(msg + ' Rebuild the ERP image with your project anon JWT for production.');
  } else if (import.meta.env.DEV) {
    console.warn(msg);
  }
}

// Self-hosted stack: if the SPA was built without a real project anon key, JWT iss stays "supabase-demo"
// → realtime WebSocket and /auth/v1/token refresh often fail with 502/HTML while REST may still work.
if (typeof window !== 'undefined' && /dincouture\.pk$/i.test(window.location.hostname)) {
  try {
    const parts = supabaseAnonKey.split('.');
    if (parts.length === 3) {
      const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const pad = (4 - (b64.length % 4)) % 4;
      const json = atob(b64 + '='.repeat(pad));
      const payload = JSON.parse(json) as { iss?: string };
      if (payload?.iss === 'supabase-demo') {
        console.warn(
          '[Supabase] VITE_SUPABASE_ANON_KEY decodes to iss=supabase-demo. Rebuild the ERP image with your project anon JWT; otherwise Realtime and auth refresh will fail on erp.dincouture.pk.'
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
function safeStorage(): Storage {
  try {
    if (typeof window === 'undefined') return memoryFallback();
    const storage = window.localStorage;
    storage.getItem('');
    return storage;
  } catch {
    return memoryFallback();
  }
}
// Never throw – avoids "SecurityError: The request was denied" when storage is blocked (iframe, strict privacy)
function memoryFallback(): Storage {
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

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: safeStorage(),
  },
});

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
