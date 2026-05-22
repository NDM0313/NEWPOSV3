/**
 * Keeps counter vault refresh tokens aligned with the active Supabase session
 * (rotation-safe) while the app is in use or a persisted session still exists.
 */

import * as authApi from '../api/auth';

/** Background sync interval while a user is logged in. */
export const COUNTER_VAULT_MAINTENANCE_INTERVAL_MS = 20 * 60 * 1000;

let maintenanceInFlight: Promise<void> | null = null;

export async function maintainCounterVaultTokens(): Promise<void> {
  if (maintenanceInFlight) return maintenanceInFlight;
  maintenanceInFlight = (async () => {
    try {
      const session = await authApi.getSessionWithRefresh();
      if (!session?.refreshToken) return;
      await authApi.syncCurrentSessionToCounterVault();
    } catch {
      /* ignore */
    } finally {
      maintenanceInFlight = null;
    }
  })();
  return maintenanceInFlight;
}
