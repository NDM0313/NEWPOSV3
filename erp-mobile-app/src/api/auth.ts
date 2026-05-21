import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import type { User as SupabaseAuthUser } from '@supabase/supabase-js';
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
import { normalizeAppRole, type AssignableAppRole } from '../config/functionalRoles';
import { getOAuthRedirectTo } from '../lib/oauthRedirect';
import { syncCounterRefreshTokenForUserId, syncCounterVaultDisplayMetadataForUserId } from '../lib/counterUserVault';

export { getOAuthRedirectTo } from '../lib/oauthRedirect';

const SESSION_POLL_MS = 200;

type UsersNameRow = { full_name?: string | null; email?: string | null };

/** Prefer ERP `users.full_name`, then auth metadata, then email local-part. */
function displayNameFromAuthUserAndRow(user: SupabaseAuthUser, row: UsersNameRow): string {
  const full = row.full_name?.trim();
  if (full) return full;
  const md = user.user_metadata as Record<string, unknown> | undefined;
  if (typeof md?.full_name === 'string' && md.full_name.trim()) return String(md.full_name).trim();
  if (typeof md?.name === 'string' && md.name.trim()) return String(md.name).trim();
  const ae = user.email?.trim();
  if (ae) return ae.split('@')[0] || ae;
  const re = row.email?.trim();
  if (re) return re.split('@')[0] || re;
  return 'User';
}

/**
 * Wait until Supabase client has an access token (required before authenticated RPCs).
 */
export async function ensureAuthenticatedSession(maxWaitMs = 8000): Promise<{ ok: boolean; message?: string }> {
  if (!isSupabaseConfigured) {
    return { ok: false, message: 'App is not configured.' };
  }
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    if (error) {
      return { ok: false, message: error.message };
    }
    if (session?.access_token) {
      return { ok: true };
    }
    await new Promise((r) => setTimeout(r, SESSION_POLL_MS));
  }
  return {
    ok: false,
    message: 'Auth session missing. Confirm your email code and try again.',
  };
}

export async function signInWithGoogle(): Promise<{
  error: { message: string } | null;
  /** True when user must finish in external browser; listen for `erp-auth-oauth-complete`. */
  pendingExternalBrowser?: boolean;
}> {
  if (!isSupabaseConfigured) {
    return {
      error: {
        message:
          'App not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in erp-mobile-app/.env, then restart.',
      },
    };
  }
  const redirectTo = getOAuthRedirectTo();
  const queryParams = { access_type: 'offline', prompt: 'select_account' as const };

  if (Capacitor.isNativePlatform()) {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true,
        queryParams,
      },
    });
    if (error) return { error: { message: error.message } };
    if (!data?.url) return { error: { message: 'No OAuth URL returned. Check Supabase Google provider.' } };
    await Browser.open({ url: data.url });
    return { error: null, pendingExternalBrowser: true };
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams,
    },
  });
  if (error) return { error: { message: error.message } };
  return { error: null };
}

export async function signUpForNewBusiness(params: {
  email: string;
  password: string;
  ownerName: string;
  phone?: string;
  businessName?: string;
  businessType?: string;
}): Promise<{
  needsEmailVerification: boolean;
  hasSession: boolean;
  error: { message: string } | null;
}> {
  if (!isSupabaseConfigured) {
    return {
      needsEmailVerification: false,
      hasSession: false,
      error: {
        message:
          'App not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in erp-mobile-app/.env, then restart.',
      },
    };
  }
  const { data, error } = await supabase.auth.signUp({
    email: params.email,
    password: params.password,
    options: {
      data: {
        full_name: params.ownerName,
        phone: params.phone,
        business_name: params.businessName,
        business_type: params.businessType,
      },
    },
  });
  if (error) {
    let msg = error.message;
    if (msg.toLowerCase().includes('already registered')) {
      msg = 'This email is already registered. Sign in, or use a different email.';
    }
    return { needsEmailVerification: false, hasSession: false, error: { message: msg } };
  }
  const hasSession = Boolean(data.session);
  const needsEmailVerification = Boolean(data.user) && !hasSession;
  return { needsEmailVerification, hasSession, error: null };
}

/** Confirm email after signUp (6-digit code or similar). Tries `signup` then `email` OTP types. */
export async function verifySignupEmailOtp(
  email: string,
  token: string
): Promise<{ error: { message: string } | null; sessionEstablished: boolean }> {
  const clean = token.replace(/\D/g, '').trim();
  if (!clean) return { error: { message: 'Enter the verification code.' }, sessionEstablished: false };
  let result = await supabase.auth.verifyOtp({
    email,
    token: clean,
    type: 'signup',
  });
  if (result.error) {
    const alt = await supabase.auth.verifyOtp({
      email,
      token: clean,
      type: 'email',
    } as Parameters<typeof supabase.auth.verifyOtp>[0]);
    result = alt;
  }
  if (result.error) {
    return { error: { message: result.error.message }, sessionEstablished: false };
  }
  if (result.data?.session?.access_token) {
    return { error: null, sessionEstablished: true };
  }
  const ensured = await ensureAuthenticatedSession();
  return {
    error: null,
    sessionEstablished: ensured.ok,
  };
}

export async function resendSignupEmailOtp(email: string): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase.auth.resend({ type: 'signup', email });
  return error ? { error: { message: error.message } } : { error: null };
}

export type UserRole = AssignableAppRole | 'owner';

export interface AuthProfile {
  name: string;
  email: string;
  role: UserRole;
  companyId: string | null;
  userId: string;
  /** Public users.id (for user_branches.user_id). When present, use for branch access. */
  profileId?: string;
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

  // users table: match by id (legacy) OR auth_user_id (links to auth.users.id)
  const { data: row, error: profileError } = await supabase
    .from('users')
    .select('id, company_id, role, full_name, email')
    .or(`id.eq.${user.id},auth_user_id.eq.${user.id}`)
    .limit(1)
    .maybeSingle();

  if (profileError || !row) {
    return {
      data: null,
      error: { message: 'User profile not found. Use “Create account” on the login screen or complete setup in the web app.' },
    };
  }

  const normalized = normalizeAppRole(row.role);
  const finalRole: UserRole =
    normalized === 'owner' ? 'owner' : (normalized as AssignableAppRole);
  // branch_id not on users; branch lock would come from user_branches (future)
  const branchId: string | null = null;
  const branchLocked = false;

  const profile: AuthProfile = {
    name: displayNameFromAuthUserAndRow(user, row as UsersNameRow),
    email: user.email || email,
    role: finalRole,
    companyId: row.company_id || null,
    userId: user.id,
    profileId: (row as { id?: string }).id ?? undefined,
    branchId,
    branchLocked,
  };

  const rt = authData.session?.refresh_token;
  if (rt && user.id) {
    try {
      await syncCounterRefreshTokenForUserId(user.id, rt);
    } catch {
      /* ignore */
    }
  }

  return { data: profile, error: null };
}

/** Revoke refresh tokens on the server and clear the device PIN vault. */
export async function signOutGlobal(): Promise<void> {
  await supabase.auth.signOut({ scope: 'global' });
  await clearSecure();
}

/** Clear the client session only (does not revoke server refresh tokens). */
export async function signOutLocal(): Promise<void> {
  await supabase.auth.signOut({ scope: 'local' });
}

/** @deprecated Prefer `signOutGlobal` or `signOutLocal` for clarity. */
export async function signOut(): Promise<void> {
  await signOutGlobal();
}

/** After any successful login or refresh, push the current refresh token into counter vault rows for this user. */
export async function syncCurrentSessionToCounterVault(): Promise<void> {
  const s = await getSessionWithRefresh();
  if (!s) return;
  try {
    await syncCounterRefreshTokenForUserId(s.userId, s.refreshToken);
    const prof = await getProfile(s.userId);
    if (prof?.name) {
      await syncCounterVaultDisplayMetadataForUserId(s.userId, {
        displayName: prof.name,
        email: prof.email,
        role: prof.role,
        companyId: prof.companyId,
      });
    }
  } catch {
    /* ignore */
  }
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
  const rt = data.session.refresh_token;
  const uid = data.session.user?.id;
  if (rt && uid) {
    try {
      await syncCounterRefreshTokenForUserId(uid, rt);
    } catch {
      /* ignore */
    }
  }
  return { ok: true };
}

/** user_branches.user_id = public users.id (profileId). */
export async function getProfile(userId: string): Promise<AuthProfile | null> {
  const { data: row, error } = await supabase
    .from('users')
    .select('id, company_id, role, full_name, email')
    .or(`id.eq.${userId},auth_user_id.eq.${userId}`)
    .limit(1)
    .maybeSingle();
  if (error || !row) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const normalized = normalizeAppRole(row.role);
  const finalRole: UserRole =
    normalized === 'owner' ? 'owner' : (normalized as AssignableAppRole);
  const profileId = (row as { id?: string }).id ?? undefined;

  let branchId: string | null = null;
  let branchLocked = false;
  if (profileId && isSupabaseConfigured) {
    const { data: ubRows } = await supabase
      .from('user_branches')
      .select('branch_id')
      .eq('user_id', profileId);
    const branchIds = (ubRows ?? []).map((r: { branch_id: string }) => r.branch_id);
    if (branchIds.length === 1) {
      branchId = branchIds[0];
      branchLocked = true;
    }
  }

  return {
    name: displayNameFromAuthUserAndRow(user, row as UsersNameRow),
    email: user.email || '',
    role: finalRole,
    companyId: row.company_id || null,
    userId: user.id,
    profileId,
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
