import { clearAllPending } from './offlineStore';
import { clearSecure } from './secureStorage';

const BRANCH_STORAGE_KEY = 'erp_mobile_branch';

/**
 * Clears device-local data that must not leak across companies/users.
 * Call after successful new-business RPC, before entering main app / PIN setup.
 * Does not sign out Supabase (caller already has the correct session).
 */
export async function resetLocalDataPlaneForNewCompany(): Promise<void> {
  try {
    await clearSecure();
  } catch {
    /* ignore */
  }
  try {
    await clearAllPending();
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(BRANCH_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
