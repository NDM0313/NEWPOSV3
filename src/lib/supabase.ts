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
// Localhost / other origins: hit supabase.dincouture.pk directly so auth returns JSON (erp.dincouture.pk from another origin can return 5xx/HTML).
if (typeof window !== 'undefined') {
  if (window.location.origin.includes('erp.dincouture.pk')) {
    supabaseUrl = window.location.origin;
  } else if (supabaseUrl.includes('erp.dincouture.pk')) {
    supabaseUrl = 'https://supabase.dincouture.pk';
  }
}
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ||
                        import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
                        import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || '').trim();

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
