import { supabase, isSupabaseConfigured } from '../lib/supabase';

export type UserRole = 'admin' | 'manager' | 'staff' | 'viewer';

export interface AuthProfile {
  name: string;
  email: string;
  role: UserRole;
  companyId: string | null;
  userId: string;
}

export async function signIn(email: string, password: string): Promise<{ data: AuthProfile | null; error: { message: string } | null }> {
  if (!isSupabaseConfigured) {
    return {
      data: null,
      error: {
        message: 'App not configured. In erp-mobile-app/.env set VITE_SUPABASE_ANON_KEY (copy from main project .env.production or .env.local). Then restart: npm run dev.',
      },
    };
  }
  const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) {
    let msg = signInError.message;
    if (msg.includes('Invalid login credentials')) msg = 'Invalid email or password.';
    else if (msg.includes('Email not confirmed')) msg = 'Please confirm your email first.';
    else if (/Failed to fetch|NetworkError|Load failed|fetch failed/i.test(msg)) {
      msg = 'Cannot reach the server. Check network or contact admin.';
    }
    return { data: null, error: { message: msg } };
  }
  const user = authData.user;
  if (!user?.id) return { data: null, error: { message: 'Login failed.' } };

  const { data: row, error: profileError } = await supabase
    .from('users')
    .select('company_id, role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !row) {
    return {
      data: null,
      error: { message: 'User profile not found. Create a business in the web app first.' },
    };
  }

  const role = (row.role?.toLowerCase() || 'staff') as UserRole;
  const validRoles: UserRole[] = ['admin', 'manager', 'staff', 'viewer'];
  const finalRole = validRoles.includes(role) ? role : 'staff';

  return {
    data: {
      name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
      email: user.email || email,
      role: finalRole,
      companyId: row.company_id || null,
      userId: user.id,
    },
    error: null,
  };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function getSession(): Promise<{ userId: string; email: string } | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;
  return { userId: session.user.id, email: session.user.email || '' };
}

export async function getProfile(userId: string): Promise<AuthProfile | null> {
  const { data: row, error } = await supabase
    .from('users')
    .select('company_id, role')
    .eq('id', userId)
    .maybeSingle();
  if (error || !row) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const role = (row.role?.toLowerCase() || 'staff') as UserRole;
  const validRoles: UserRole[] = ['admin', 'manager', 'staff', 'viewer'];
  return {
    name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
    email: user.email || '',
    role: validRoles.includes(role) ? role : 'staff',
    companyId: row.company_id || null,
    userId: user.id,
  };
}
