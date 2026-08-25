import { isFeatureFlagEnabled } from '../api/featureFlags';
import { UNIFIED_LEDGER_FLAG_KEYS } from './unifiedLedgerFlagKeys';

export function isUnifiedLedgerEnvKillActive(): boolean {
  const viteVal =
    typeof import.meta !== 'undefined' &&
    import.meta.env &&
    String(import.meta.env.VITE_UNIFIED_LEDGER_ENGINE_KILLED || '').toLowerCase() === 'true';
  return viteVal;
}

export async function isUnifiedLedgerKillSwitchActive(companyId: string): Promise<boolean> {
  if (isUnifiedLedgerEnvKillActive()) return true;
  if (!companyId) return false;
  return isFeatureFlagEnabled(companyId, UNIFIED_LEDGER_FLAG_KEYS.KILL_SWITCH);
}
