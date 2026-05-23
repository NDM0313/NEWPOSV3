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
import { maintainCounterVaultTokens } from './counterVaultMaintenance';
import { markUnlocked } from './pinLock';

export type CounterPinUnlockResult =
  | { ok: true; profile: AuthProfile }
  | { ok: false; error: string };

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

  let refreshed = await authApi.refreshSessionFromRefreshToken(payload.refreshToken);
  if (!refreshed.ok) {
    await maintainCounterVaultTokens();
    const retryPayload = await getCounterUserForPin(pin);
    if (retryPayload?.refreshToken) {
      refreshed = await authApi.refreshSessionFromRefreshToken(retryPayload.refreshToken);
    }
    if (!refreshed.ok) {
      const sess = await authApi.getSessionWithRefresh();
      if (sess?.userId && payload.userId && sess.userId === payload.userId) {
        await authApi.syncCurrentSessionToCounterVault();
        refreshed = await authApi.refreshSessionFromRefreshToken(sess.refreshToken);
      }
    }
  }

  if (!refreshed.ok) {
    return { ok: false, error: formatCounterPinAuthError(refreshed.error) };
  }

  const session = await authApi.getSession();
  if (!session) {
    return { ok: false, error: 'No session after sign-in.' };
  }
  const profile = await authApi.getProfile(session.userId);
  if (!profile) {
    return { ok: false, error: 'Profile not found.' };
  }
  if (options?.companyId && profile.companyId !== options.companyId) {
    return { ok: false, error: COUNTER_WRONG_COMPANY_MESSAGE };
  }

  await authApi.syncCurrentSessionToCounterVault();
  markUnlocked();
  return { ok: true, profile };
}
