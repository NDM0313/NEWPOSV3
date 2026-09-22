/**
 * Supabase signup + email OTP helpers for Create Business (web).
 * Mirrors erp-mobile-app/src/api/auth.ts signUp / verifyOtp flow.
 */

import { supabase } from '@/lib/supabase';
import {
  formatCreateBusinessSignupFallbackError,
  isReservedSystemEmail,
  RESERVED_SYSTEM_EMAIL_MESSAGE,
  shouldAttemptSignupSignInFallback,
} from '@/app/utils/authErrorMessages';

const SESSION_POLL_MS = 250;

export async function ensureAuthenticatedSession(maxWaitMs = 8000): Promise<{ ok: boolean; message?: string }> {
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
  userId?: string;
  error: string | null;
}> {
  const email = params.email.trim();
  if (isReservedSystemEmail(email)) {
    return { needsEmailVerification: false, hasSession: false, error: RESERVED_SYSTEM_EMAIL_MESSAGE };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password: params.password,
    options: {
      data: {
        full_name: params.ownerName.trim(),
        phone: params.phone?.trim() || undefined,
        business_name: params.businessName?.trim() || undefined,
        business_type: params.businessType || undefined,
      },
    },
  });

  if (error) {
    if (shouldAttemptSignupSignInFallback(error)) {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: params.password,
      });
      if (!signInError && signInData.session && signInData.user?.id) {
        return {
          needsEmailVerification: false,
          hasSession: true,
          userId: signInData.user.id,
          error: null,
        };
      }
      return {
        needsEmailVerification: false,
        hasSession: false,
        error: signInError
          ? formatCreateBusinessSignupFallbackError(error, signInError)
          : 'This email is already registered. Sign in with your password, or use a different email.',
      };
    }
    return { needsEmailVerification: false, hasSession: false, error: error.message };
  }

  const hasSession = Boolean(data.session);
  const needsEmailVerification = Boolean(data.user) && !hasSession;
  return {
    needsEmailVerification,
    hasSession,
    userId: data.user?.id,
    error: null,
  };
}

/** Confirm email after signUp. Tries `signup` then `email` OTP types. */
export async function verifySignupEmailOtp(
  email: string,
  token: string
): Promise<{ error: string | null; sessionEstablished: boolean }> {
  const clean = token.replace(/\D/g, '').trim();
  if (!clean) return { error: 'Enter the verification code.', sessionEstablished: false };

  let result = await supabase.auth.verifyOtp({
    email: email.trim(),
    token: clean,
    type: 'signup',
  });
  if (result.error) {
    const alt = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: clean,
      type: 'email',
    } as Parameters<typeof supabase.auth.verifyOtp>[0]);
    result = alt;
  }
  if (result.error) {
    return { error: result.error.message, sessionEstablished: false };
  }
  if (result.data?.session?.access_token) {
    return { error: null, sessionEstablished: true };
  }
  const ensured = await ensureAuthenticatedSession();
  return {
    error: ensured.ok ? null : ensured.message || 'Could not establish session after verification.',
    sessionEstablished: ensured.ok,
  };
}

export async function resendSignupEmailOtp(email: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim() });
  return error ? { error: error.message } : { error: null };
}
