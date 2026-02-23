import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  hasSecurePayload,
  saveSecurePayload,
  verifyPinAndUnlock,
  clearSecure,
  getLockedUntil,
  type SecurePayload,
  type VerifyResult,
} from '../lib/secureStorage';

export type UserRole = 'admin' | 'manager' | 'staff' | 'viewer';

export interface AuthProfile {
  name: string;
  email: string;
  role: UserRole;
  companyId: string | null;
  userId: string;
  /** Set when admin assigned user to a branch; then branch selector is hidden and locked */
  branchId: string | null;
  branchLocked: boolean;
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

  // users table has company_id, role. branch_id does not exist; branch lock uses user_branches.
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
  // branch_id not on users; branch lock would come from user_branches (future)
  const branchId: string | null = null;
  const branchLocked = false;

  return {
    data: {
      name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
      email: user.email || email,
      role: finalRole,
      companyId: row.company_id || null,
      userId: user.id,
      branchId,
      branchLocked,
    },
    error: null,
  };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
  await clearSecure();
}

export async function getSession(): Promise<{ userId: string; email: string } | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;
  return { userId: session.user.id, email: session.user.email || '' };
}

/** Returns session with refresh_token for storing in secure vault. */
export async function getSessionWithRefresh(): Promise<{ userId: string; email: string; refreshToken: string } | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id || !session.refresh_token) return null;
  return {
    userId: session.user.id,
    email: session.user.email || '',
    refreshToken: session.refresh_token,
  };
}

/** Restore Supabase session from refresh token (e.g. after PIN unlock when session was lost). */
export async function refreshSessionFromRefreshToken(refreshToken: string): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
  if (error) return { ok: false, error: error.message };
  if (!data?.session) return { ok: false, error: 'No session returned.' };
  return { ok: true };
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
  const branchId: string | null = null;
  const branchLocked = false;
  return {
    name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
    email: user.email || '',
    role: validRoles.includes(role) ? role : 'staff',
    companyId: row.company_id || null,
    userId: user.id,
    branchId,
    branchLocked,
  };
}

// --- PIN: secure storage (IndexedDB + encrypted). No raw token in localStorage. ---

export async function hasPinSet(): Promise<boolean> {
  return hasSecurePayload();
}

export async function setPinWithPayload(pin: string, payload: Omit<SecurePayload, 'savedAt'>): Promise<void> {
  await saveSecurePayload(pin, { ...payload, savedAt: Date.now() });
}

export async function verifyPin(pin: string): Promise<VerifyResult> {
  return verifyPinAndUnlock(pin);
}

export async function getPinLockedUntil(): Promise<number> {
  return getLockedUntil();
}

export async function clearPin(): Promise<void> {
  await clearSecure();
}

/** Change PIN: verify current PIN, then save payload with new PIN. */
export async function changePin(oldPin: string, newPin: string): Promise<{ ok: boolean; error?: string }> {
  if (newPin.length < 4 || newPin.length > 6) {
    return { ok: false, error: 'New PIN must be 4–6 digits.' };
  }
  const result = await verifyPinAndUnlock(oldPin);
  if (result.success && 'payload' in result) {
    const payload = result.payload;
    await saveSecurePayload(newPin, { ...payload, savedAt: Date.now() });
    return { ok: true };
  }
  if (!result.success && 'locked' in result && result.locked) {
    return { ok: false, error: 'Too many attempts. Try again later.' };
  }
  return { ok: false, error: (result as { message?: string }).message || 'Wrong PIN.' };
}
