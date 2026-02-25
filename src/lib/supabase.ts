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
// erp.dincouture.pk auth proxy returns 308 redirect → "Unexpected token '/', \"/auth\" is not valid JSON"
if (supabaseUrl.includes('erp.dincouture.pk')) {
  supabaseUrl = supabaseUrl.replace(/https?:\/\/erp\.dincouture\.pk\/?/i, 'https://supabase.dincouture.pk');
}
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ||
                        import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
                        import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || '').trim();

const isValidSupabaseUrl = supabaseUrl.startsWith('http://') || supabaseUrl.startsWith('https://');
if (!supabaseUrl || !isValidSupabaseUrl || !supabaseAnonKey) {
  const msg =
    '[Supabase] Missing or invalid config. Set VITE_SUPABASE_URL (full https URL) and VITE_SUPABASE_ANON_KEY. ' +
    'In production these must be set at BUILD time (e.g. docker compose build with --env-file .env.production).';
  console.error(msg);
  throw new Error(msg);
}

// ============================================
// CREATE CLIENT
// ============================================

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
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
