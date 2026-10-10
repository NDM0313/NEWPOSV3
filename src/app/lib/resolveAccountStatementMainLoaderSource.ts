/**
 * Phase 2.11 — Account Statement main table loader resolution.
 * Only `unified_ledger_loader_account_statement` may switch the default main loader from legacy.
 */

import {
  isUnifiedLedgerKillSwitchActive,
  type UnifiedLedgerEngineState,
} from '@/app/lib/unifiedLedgerEngineState';
import { UNIFIED_LEDGER_FLAG_KEYS } from '@/app/lib/unifiedLedgerFlagKeys';

export type AccountStatementMainLoaderSource = 'legacy' | 'unified' | 'killed';

export type ResolveAccountStatementMainLoaderSourceResult = {
  source: AccountStatementMainLoaderSource;
  killSwitchActive: boolean;
  loaderFlagEnabled: boolean;
  companyEngineEnabled: boolean;
  screenFlagEnabled: boolean;
};

type FlagReader = {
  isEnabled: (companyId: string, key: string) => Promise<boolean>;
};

const defaultFlagReader: FlagReader = {
  async isEnabled(companyId, key) {
    const { featureFlagsService } = await import('@/app/services/featureFlagsService');
    return featureFlagsService.isEnabled(companyId, key);
  },
};

/**
 * Resolve which loader feeds the Account Statement main table (not preview panel).
 *
 * Priority:
 * 1. Kill switch → killed (use legacy loader)
 * 2. Loader flag OFF/absent → legacy
 * 3. Engine OFF → legacy
 * 4. Screen account_statement OFF → legacy
 * 5. All gates ON → unified
 */
export async function resolveAccountStatementMainLoaderSource(
  companyId: string,
  reader: FlagReader = defaultFlagReader,
): Promise<ResolveAccountStatementMainLoaderSourceResult> {
  const killSwitchActive = await isUnifiedLedgerKillSwitchActive(companyId, reader);
  if (killSwitchActive) {
    return {
      source: 'killed',
      killSwitchActive: true,
      loaderFlagEnabled: false,
      companyEngineEnabled: false,
      screenFlagEnabled: false,
    };
  }

  if (!companyId) {
    return {
      source: 'legacy',
      killSwitchActive: false,
      loaderFlagEnabled: false,
      companyEngineEnabled: false,
      screenFlagEnabled: false,
    };
  }

  const loaderFlagEnabled = await reader.isEnabled(
    companyId,
    UNIFIED_LEDGER_FLAG_KEYS.LOADER_ACCOUNT_STATEMENT,
  );
  const companyEngineEnabled = await reader.isEnabled(
    companyId,
    UNIFIED_LEDGER_FLAG_KEYS.ENGINE,
  );
  const screenFlagEnabled = await reader.isEnabled(
    companyId,
    UNIFIED_LEDGER_FLAG_KEYS.SCREEN_ACCOUNT_STATEMENT,
  );

  const unified =
    loaderFlagEnabled && companyEngineEnabled && screenFlagEnabled;

  return {
    source: unified ? 'unified' : 'legacy',
    killSwitchActive: false,
    loaderFlagEnabled,
    companyEngineEnabled,
    screenFlagEnabled,
  };
}

/** Map resolver result to effective main-table loader (killed → legacy). */
export function effectiveAccountStatementMainLoaderSource(
  resolved: ResolveAccountStatementMainLoaderSourceResult,
): 'legacy' | 'unified' {
  return resolved.source === 'unified' ? 'unified' : 'legacy';
}

/** Test helper: derive main loader from engine state snapshot + loader flag. */
export function resolveAccountStatementMainLoaderFromFlags(args: {
  killSwitchActive: boolean;
  loaderFlagEnabled: boolean;
  companyEngineEnabled: boolean;
  screenFlagEnabled: boolean;
}): AccountStatementMainLoaderSource {
  if (args.killSwitchActive) return 'killed';
  if (args.loaderFlagEnabled && args.companyEngineEnabled && args.screenFlagEnabled) {
    return 'unified';
  }
  return 'legacy';
}

export type { UnifiedLedgerEngineState };
