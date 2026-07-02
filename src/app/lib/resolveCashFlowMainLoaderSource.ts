/**
 * Phase 3B-M — Cash Flow main loader resolution.
 * Only `unified_ledger_loader_cash_flow` may switch the default main loader from legacy.
 */

import {
  isUnifiedLedgerKillSwitchActive,
  type UnifiedLedgerEngineState,
} from '@/app/lib/unifiedLedgerEngineState';
import { UNIFIED_LEDGER_FLAG_KEYS } from '@/app/lib/unifiedLedgerFlagKeys';

export type CashFlowMainLoaderSource = 'legacy' | 'unified' | 'killed';

export type ResolveCashFlowMainLoaderSourceResult = {
  source: CashFlowMainLoaderSource;
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

export async function resolveCashFlowMainLoaderSource(
  companyId: string,
  reader: FlagReader = defaultFlagReader,
): Promise<ResolveCashFlowMainLoaderSourceResult> {
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
    UNIFIED_LEDGER_FLAG_KEYS.LOADER_CASH_FLOW,
  );
  const companyEngineEnabled = await reader.isEnabled(
    companyId,
    UNIFIED_LEDGER_FLAG_KEYS.ENGINE,
  );
  const screenFlagEnabled = await reader.isEnabled(
    companyId,
    UNIFIED_LEDGER_FLAG_KEYS.SCREEN_CASH_FLOW,
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

export function effectiveCashFlowMainLoaderSource(
  resolved: ResolveCashFlowMainLoaderSourceResult,
): 'legacy' | 'unified' {
  return resolved.source === 'unified' ? 'unified' : 'legacy';
}

export function resolveCashFlowMainLoaderFromFlags(args: {
  killSwitchActive: boolean;
  loaderFlagEnabled: boolean;
  companyEngineEnabled: boolean;
  screenFlagEnabled: boolean;
}): CashFlowMainLoaderSource {
  if (args.killSwitchActive) return 'killed';
  if (args.loaderFlagEnabled && args.companyEngineEnabled && args.screenFlagEnabled) {
    return 'unified';
  }
  return 'legacy';
}

export type { UnifiedLedgerEngineState };
