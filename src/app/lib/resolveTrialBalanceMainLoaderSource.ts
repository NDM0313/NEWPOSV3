/**
 * Phase 2.12 — Trial Balance main table loader resolution.
 * Only `unified_ledger_loader_trial_balance` may switch the default main loader from legacy.
 */

import {
  isUnifiedLedgerKillSwitchActive,
  type UnifiedLedgerEngineState,
} from '@/app/lib/unifiedLedgerEngineState';
import { UNIFIED_LEDGER_FLAG_KEYS } from '@/app/lib/unifiedLedgerFlagKeys';

export type TrialBalanceMainLoaderSource = 'legacy' | 'unified' | 'killed';

export type ResolveTrialBalanceMainLoaderSourceResult = {
  source: TrialBalanceMainLoaderSource;
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

export async function resolveTrialBalanceMainLoaderSource(
  companyId: string,
  reader: FlagReader = defaultFlagReader,
): Promise<ResolveTrialBalanceMainLoaderSourceResult> {
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
    UNIFIED_LEDGER_FLAG_KEYS.LOADER_TRIAL_BALANCE,
  );
  const companyEngineEnabled = await reader.isEnabled(
    companyId,
    UNIFIED_LEDGER_FLAG_KEYS.ENGINE,
  );
  const screenFlagEnabled = await reader.isEnabled(
    companyId,
    UNIFIED_LEDGER_FLAG_KEYS.SCREEN_TRIAL_BALANCE,
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

export function effectiveTrialBalanceMainLoaderSource(
  resolved: ResolveTrialBalanceMainLoaderSourceResult,
): 'legacy' | 'unified' {
  return resolved.source === 'unified' ? 'unified' : 'legacy';
}

export function resolveTrialBalanceMainLoaderFromFlags(args: {
  killSwitchActive: boolean;
  loaderFlagEnabled: boolean;
  companyEngineEnabled: boolean;
  screenFlagEnabled: boolean;
}): TrialBalanceMainLoaderSource {
  if (args.killSwitchActive) return 'killed';
  if (args.loaderFlagEnabled && args.companyEngineEnabled && args.screenFlagEnabled) {
    return 'unified';
  }
  return 'legacy';
}

export type { UnifiedLedgerEngineState };
