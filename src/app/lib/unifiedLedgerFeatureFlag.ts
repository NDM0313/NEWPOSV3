/**
 * Unified Core Ledger Engine — feature flag (default OFF).
 * Runtime: DB feature_flags row + optional localStorage dev override.
 * Production ledger screens must NOT depend on this until explicit enablement.
 */

import {
  safeLocalStorageGetItem,
  safeLocalStorageSetItem,
} from '@/app/lib/safeBrowserStorage';

export const UNIFIED_LEDGER_FEATURE_KEY = 'unified_ledger_engine';

/** Build-time default — always false for safe rollback. */
export const UNIFIED_LEDGER_ENGINE_DEFAULT = false;

const STORAGE_KEY = 'erp_feature_unified_ledger_engine';

/**
 * Dev-only localStorage override (wins over DB when set).
 * Values: 'true' | 'false' | unset
 */
export function getUnifiedLedgerLocalOverride(): boolean | null {
  if (typeof window === 'undefined') return null;
  const stored = safeLocalStorageGetItem(STORAGE_KEY);
  if (stored === 'true') return true;
  if (stored === 'false') return false;
  return null;
}

export function setUnifiedLedgerLocalOverride(value: boolean | null): void {
  if (typeof window === 'undefined') return;
  if (value === null) {
    safeLocalStorageSetItem(STORAGE_KEY, '');
    return;
  }
  safeLocalStorageSetItem(STORAGE_KEY, value ? 'true' : 'false');
}

/**
 * Whether unified engine is enabled for normal app flows.
 * Tie-out UI may pass shadowForce to bypass this.
 */
export async function isUnifiedLedgerEngineEnabled(companyId: string): Promise<boolean> {
  const local = getUnifiedLedgerLocalOverride();
  if (local !== null) return local;

  if (!companyId) return UNIFIED_LEDGER_ENGINE_DEFAULT;

  try {
    const { featureFlagsService } = await import('@/app/services/featureFlagsService');
    const enabled = await featureFlagsService.isEnabled(companyId, UNIFIED_LEDGER_FEATURE_KEY);
    return enabled === true;
  } catch {
    return UNIFIED_LEDGER_ENGINE_DEFAULT;
  }
}

/** Synchronous check for tests / SSR — uses local override only. */
export function isUnifiedLedgerEngineEnabledSync(): boolean {
  const local = getUnifiedLedgerLocalOverride();
  if (local !== null) return local;
  return UNIFIED_LEDGER_ENGINE_DEFAULT;
}
