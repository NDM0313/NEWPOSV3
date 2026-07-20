import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import type { User as SupabaseAuthUser } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured, authStorageIsEphemeral } from '../lib/supabase';
import { loginWithPasswordGrant } from '../lib/authPasswordGrant';
import { withBootTimeout } from '../lib/bootTimeout';
import {
  hasSecurePayload,
  saveSecurePayload,
  verifyPinAndUnlock,
  clearSecure,
  getLockedUntil,
  type SecurePayload,
  type VerifyResult,
} from '../lib/secureStorage';
import {
  isPlatformCompanyOperator,
  normalizeAppRole,
  type AssignableAppRole,
  type PlatformAppRole,
} from '../config/functionalRoles';
import { getEffectiveCompanyId } from './platformCompany';
import { getOAuthRedirectTo } from '../lib/oauthRedirect';
import {
  isStaleRefreshTokenError,
  noteRefreshFailure,
  recoverStaleAuthSession,
  resetRefreshFailureCount,
} from '../lib/authSessionRecovery';
import { isAuthAbortError, withAuthRefreshMutex } from '../lib/authRefreshMutex';
import { getUserAccessibleBranchIds } from './permissions';
import {
  formatCreateBusinessSignInFallbackError,
  isReservedSystemEmail,
  RESERVED_SYSTEM_EMAIL_MESSAGE,
  shouldAttemptSignupSignInFallback,
} from '../utils/authErrorMessages';

export { getOAuthRedirectTo } from '../lib/oauthRedirect';

const SESSION_POLL_MS = 200;
const GET_SESSION_TIMEOUT_MS = 8000;

function isProductionMobileHost(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hostname.includes('erp.dincouture.pk');
}

function isStorageOrSecurityError(err: unknown): boolean {
  if (!err) return false;
  const msg = String(
    typeof err === 'object' && err !== null && 'message' in err
      ? (err as { message?: string }).message
      : err,
  ).toLowerCase();
  const name = String(
    typeof err === 'object' && err !== null && 'name' in err ? (err as { name?: string }).name : '',
  ).toLowerCase();
  return (
    name === 'securityerror' ||
    msg.includes('securityerror') ||
    msg.includes('request was denied') ||
    msg.includes('access is denied')
  );
}

function formatSignInErrorMessage(msg: string): string {
  if (msg.includes('Invalid login credentials')) return 'Invalid email or password.';
  if (/invalid authentication credentials/i.test(msg)) {
    return 'API key mismatch: copy VITE_SUPABASE_ANON_KEY from .env.production (VPS ANON_KEY) into erp-mobile-app/.env, restart npm run dev.';
  }
  if (msg.includes('Email not confirmed')) return 'Please confirm your email first.';
  if (/Failed to fetch|NetworkError|Load failed|fetch failed/i.test(msg)) {
    const base = 'Cannot reach the server. Check network or contact admin.';
    if (Capacitor.isNativePlatform()) {
      return `${base} If https://erp.dincouture.pk/m/ works, install the latest APK build.`;
    }
    return base;
  }
  if (isStorageOrSecurityError({ message: msg })) {
    return 'Browser blocked site storage. Allow cookies/storage for this site or use a normal (non-private) window.';
  }
  return msg;
}

function formatAuthRefreshError(message: string | undefined): string {
  if (!message) return 'Session expired. Sign in with email/password.';
  const m = message.toLowerCase();
  if (m.includes('aborted') || m.includes('abort')) {
    return 'Sign-in was interrupted. Try again.';
  }
  if (
    m.includes('refresh token not found') ||
    m.includes('invalid refresh token') ||
    m.includes('invalid_grant') ||
    m.includes('bad request') ||
    m.includes('already used') ||
    m.includes('revoked')
  ) {
    return 'Session expired. Sign in with email/password.';
  }
  return message;
}

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
      if (isStaleRefreshTokenError(error)) {
        await recoverStaleAuthSession();
        return { ok: false, message: formatAuthRefreshError(error.message) };
      }
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

function isSignupExistingEmailError(authError: { message?: string; status?: number }): boolean {
  return shouldAttemptSignupSignInFallback(authError);
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
  if (isReservedSystemEmail(params.email)) {
    return {
      needsEmailVerification: false,
      hasSession: false,
      error: { message: RESERVED_SYSTEM_EMAIL_MESSAGE },
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
    if (isSignupExistingEmailError(error)) {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: params.email,
        password: params.password,
      });
      if (!signInError && signInData.session) {
        return { needsEmailVerification: false, hasSession: true, error: null };
      }
      return {
        needsEmailVerification: false,
        hasSession: false,
        error: {
          message: signInError
            ? formatCreateBusinessSignInFallbackError(signInError, error)
            : 'This email is already registered. Sign in with your password, or use a different email.',
        },
      };
    }
    return { needsEmailVerification: false, hasSession: false, error: { message: error.message } };
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

export type UserRole = AssignableAppRole | 'owner' | PlatformAppRole;

export interface AuthProfile {
  name: string;
  email: string;
  role: UserRole;
  companyId: string | null;
  /** Home users.company_id (before platform session override). */
  homeCompanyId?: string | null;
  userId: string;
  /** Public users.id (for user_branches.user_id). When present, use for branch access. */
  profileId?: string;
  /** Set when admin assigned user to a branch; then branch selector is hidden and locked */
  branchId: string | null;
  branchLocked: boolean;
}

async function profileFromAuthUser(
  user: SupabaseAuthUser,
  email: string,
): Promise<{ data: AuthProfile | null; error: { message: string } | null }> {
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
    normalized === 'owner'
      ? 'owner'
      : normalized === 'developer' || normalized === 'super_admin'
        ? (normalized as PlatformAppRole)
        : (normalized as AssignableAppRole);
  const branchId: string | null = null;
  const branchLocked = false;
  const homeCompanyId = row.company_id || null;
  let companyId = homeCompanyId;
  if (isPlatformCompanyOperator(row.role)) {
    const effective = await getEffectiveCompanyId();
    if (!effective.error && effective.data) companyId = effective.data;
  }

  const profile: AuthProfile = {
    name: displayNameFromAuthUserAndRow(user, row as UsersNameRow),
    email: user.email || email,
    role: finalRole,
    companyId,
    homeCompanyId,
    userId: user.id,
    profileId: (row as { id?: string }).id ?? undefined,
    branchId,
    branchLocked,
  };

  return { data: profile, error: null };
}

async function applyRestSignIn(
  email: string,
  password: string,
): Promise<{ data: AuthProfile | null; error: { message: string } | null }> {
  const { data, error } = await loginWithPasswordGrant(email, password);
  if (error || !data?.session) {
    const msg = error?.message ? formatSignInErrorMessage(error.message) : 'Login failed.';
    return { data: null, error: { message: msg } };
  }
  try {
    await supabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
  } catch (e: unknown) {
    if (!isStorageOrSecurityError(e)) throw e;
  }
  return profileFromAuthUser(data.user, email);
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

  if (authStorageIsEphemeral() || isProductionMobileHost() || Capacitor.isNativePlatform()) {
    return applyRestSignIn(email, password);
  }

  let authData: { user: SupabaseAuthUser | null } | null = null;
  let signInError: { message: string } | null = null;
  try {
    const result = await supabase.auth.signInWithPassword({ email, password });
    authData = result.data;
    if (result.error) signInError = { message: result.error.message };
  } catch (e: unknown) {
    if (isStorageOrSecurityError(e)) {
      return applyRestSignIn(email, password);
    }
    throw e;
  }

  if (signInError && isStorageOrSecurityError(signInError)) {
    return applyRestSignIn(email, password);
  }

  if (signInError) {
    return { data: null, error: { message: formatSignInErrorMessage(signInError.message) } };
  }

  const user = authData?.user;
  if (!user?.id) return { data: null, error: { message: 'Login failed.' } };

  return profileFromAuthUser(user, email);
}

/** Clear local session + device PIN vault. Never revokes server refresh tokens (counter vault safe). */
export async function signOutGlobal(): Promise<void> {
  await supabase.auth.signOut({ scope: 'local' });
  await clearSecure();
}

/** Clear the client session only (does not revoke server refresh tokens). */
export async function signOutLocal(): Promise<void> {
  await supabase.auth.signOut({ scope: 'local' });
}

/** Counter tablet handoff — local sign-out only (legacy name). */
export async function signOutForTabletHandoff(_companyId?: string | null): Promise<void> {
  await signOutLocal();
}

/** @deprecated Prefer `signOutGlobal` or `signOutLocal` for clarity. */
export async function signOut(): Promise<void> {
  await signOutGlobal();
}

/** Refresh persisted Supabase session (if any). */
export async function refreshPersistedSessionIfPossible(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.refresh_token) return false;
    let { data, error } = await withAuthRefreshMutex(() =>
      supabase.auth.refreshSession({ refresh_token: session.refresh_token }),
    );
    if (error && isAuthAbortError(error)) {
      ({ data, error } = await withAuthRefreshMutex(() =>
        supabase.auth.refreshSession({ refresh_token: session.refresh_token }),
      ));
    }
    if (error) {
      if (isStaleRefreshTokenError(error)) {
        await recoverStaleAuthSession({ allowGlobalRecovery: false });
      }
      return false;
    }
    if (!data?.session) return false;
    return true;
  } catch {
    return false;
  }
}

export async function getSession(): Promise<{ userId: string; email: string } | null> {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    const stale = isStaleRefreshTokenError(error);
    const tripped = stale || noteRefreshFailure(error);
    if (tripped) await recoverStaleAuthSession();
    return null;
  }
  if (!session?.user) return null;
  resetRefreshFailureCount();
  return { userId: session.user.id, email: session.user.email || '' };
}

/** getSession with timeout — avoids infinite spinner when GoTrue locks hang. */
export async function getSessionWithTimeout(
  timeoutMs = GET_SESSION_TIMEOUT_MS,
): Promise<{ userId: string; email: string } | null> {
  try {
    return await withBootTimeout(getSession(), timeoutMs, 'Session read timeout');
  } catch {
    return null;
  }
}

/** Returns session with refresh_token for storing in secure vault. */
export async function getSessionWithRefresh(options?: {
  allowGlobalRecovery?: boolean;
}): Promise<{ userId: string; email: string; refreshToken: string } | null> {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    const stale = isStaleRefreshTokenError(error);
    const tripped = stale || noteRefreshFailure(error);
    if (tripped && options?.allowGlobalRecovery !== false) {
      await recoverStaleAuthSession();
    }
    return null;
  }
  if (!session?.user?.id || !session.refresh_token) return null;
  resetRefreshFailureCount();
  return {
    userId: session.user.id,
    email: session.user.email || '',
    refreshToken: session.refresh_token,
  };
}

/** Restore Supabase session from refresh token (e.g. after PIN unlock when session was lost). */
export async function refreshSessionFromRefreshToken(
  refreshToken: string,
  options?: { allowGlobalRecovery?: boolean },
): Promise<{ ok: boolean; error?: string }> {
  let { data, error } = await withAuthRefreshMutex(() =>
    supabase.auth.refreshSession({ refresh_token: refreshToken }),
  );
  if (error && isAuthAbortError(error)) {
    ({ data, error } = await withAuthRefreshMutex(() =>
      supabase.auth.refreshSession({ refresh_token: refreshToken }),
    ));
  }
  if (error) {
    const stale = isStaleRefreshTokenError(error);
    const tripped = stale || noteRefreshFailure(error);
    if (tripped && options?.allowGlobalRecovery !== false) {
      await recoverStaleAuthSession();
    }
    if (stale || tripped) {
      return { ok: false, error: formatAuthRefreshError(error.message) };
    }
    return { ok: false, error: formatAuthRefreshError(error.message) };
  }
  resetRefreshFailureCount();
  if (!data?.session) return { ok: false, error: 'No session returned.' };
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
    normalized === 'owner'
      ? 'owner'
      : normalized === 'developer' || normalized === 'super_admin'
        ? (normalized as PlatformAppRole)
        : (normalized as AssignableAppRole);
  const profileId = (row as { id?: string }).id ?? undefined;
  const homeCompanyId = row.company_id || null;
  let companyId = homeCompanyId;
  if (isPlatformCompanyOperator(row.role)) {
    const effective = await getEffectiveCompanyId();
    if (!effective.error && effective.data) companyId = effective.data;
  }

  let branchId: string | null = null;
  let branchLocked = false;
  // Platform operators pick company then branch; do not lock from home-company assignments.
  if (profileId && isSupabaseConfigured && !isPlatformCompanyOperator(row.role)) {
    const branchIds = await getUserAccessibleBranchIds(user.id, profileId, companyId);
    if (branchIds.length === 1) {
      branchId = branchIds[0];
      branchLocked = true;
    }
  }

  return {
    name: displayNameFromAuthUserAndRow(user, row as UsersNameRow),
    email: user.email || '',
    role: finalRole,
    companyId,
    homeCompanyId,
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
