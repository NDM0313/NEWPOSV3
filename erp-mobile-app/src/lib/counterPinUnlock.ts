/**
 * Counter PIN → Supabase session with vault token refresh retry.
 */

import * as authApi from '../api/auth';
import type { AuthProfile } from '../api/auth';
import {
  getCounterUserForPin,
  formatCounterPinAuthError,
  COUNTER_WRONG_COMPANY_MESSAGE,
} from './counterUserVault';
import { markUnlocked } from './pinLock';
import { supabase } from './supabase';

export type CounterPinUnlockResult =
  | { ok: true; profile: AuthProfile }
  | { ok: false; error: string };

async function profileFromLiveSession(
  userId: string,
  companyId?: string | null,
): Promise<CounterPinUnlockResult> {
  await authApi.syncCurrentSessionToCounterVault();
  const profile = await authApi.getProfile(userId);
  if (!profile) return { ok: false, error: 'Profile not found.' };
  if (companyId && profile.companyId !== companyId) {
    return { ok: false, error: COUNTER_WRONG_COMPANY_MESSAGE };
  }
  markUnlocked();
  return { ok: true, profile };
}

export async function unlockWithCounterPin(
  pin: string,
  options?: { expectedUserId?: string | null; companyId?: string | null },
): Promise<CounterPinUnlockResult> {
  const payload = await getCounterUserForPin(pin);
  if (!payload?.refreshToken) {
    return { ok: false, error: 'Wrong PIN. Try again.' };
  }
  if (
    options?.expectedUserId &&
    payload.userId &&
    options.expectedUserId !== payload.userId
  ) {
    return { ok: false, error: 'PIN does not match this user.' };
  }

  const liveSession = await authApi.getSession();
  if (
    liveSession?.userId &&
    payload.userId &&
    liveSession.userId === payload.userId &&
    (!options?.expectedUserId || options.expectedUserId === liveSession.userId)
  ) {
    return profileFromLiveSession(liveSession.userId, options?.companyId);
  }

  await supabase.auth.stopAutoRefresh();
  try {
    await authApi.signOutLocal();
    let refreshed = await authApi.refreshSessionFromRefreshToken(payload.refreshToken, {
      allowGlobalRecovery: false,
    });
    if (!refreshed.ok) {
      const retryPayload = await getCounterUserForPin(pin);
      if (
        retryPayload?.refreshToken &&
        retryPayload.refreshToken !== payload.refreshToken
      ) {
        refreshed = await authApi.refreshSessionFromRefreshToken(retryPayload.refreshToken, {
          allowGlobalRecovery: false,
        });
      }
    }

    if (!refreshed.ok) {
      return { ok: false, error: formatCounterPinAuthError(refreshed.error) };
    }

    const session = await authApi.getSession();
    if (!session) {
      return { ok: false, error: 'No session after sign-in.' };
    }
    return profileFromLiveSession(session.userId, options?.companyId);
  } finally {
    await supabase.auth.startAutoRefresh();
  }
}
