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
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 
                        import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
                        import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing. Please check your .env file.');
  console.warn('Required variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
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
