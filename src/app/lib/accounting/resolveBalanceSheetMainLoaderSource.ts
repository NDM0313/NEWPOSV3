/**
 * Phase 3D — Balance Sheet main loader resolution.
 * Only `unified_ledger_loader_balance_sheet` may switch the default main loader from legacy.
 */

import {
  isUnifiedLedgerKillSwitchActive,
  type UnifiedLedgerEngineState,
} from '@/app/lib/unifiedLedgerEngineState';
import { UNIFIED_LEDGER_FLAG_KEYS } from '@/app/lib/unifiedLedgerFlagKeys';

export type BalanceSheetMainLoaderSource = 'legacy' | 'unified' | 'killed';

export type BsPlMainLoaderReason =
  | 'unified_flags_on'
  | 'legacy_kill_switch'
  | 'legacy_loader_off'
  | 'legacy_screen_off'
  | 'legacy_flags_off'
  | 'legacy_error_fallback'
  | 'legacy_no_company';

export type ResolveBalanceSheetMainLoaderSourceResult = {
  source: BalanceSheetMainLoaderSource;
  reason: BsPlMainLoaderReason;
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

function resolveReason(args: {
  killSwitchActive: boolean;
  companyId: string;
  loaderFlagEnabled: boolean;
  companyEngineEnabled: boolean;
  screenFlagEnabled: boolean;
  unified: boolean;
}): BsPlMainLoaderReason {
  if (args.killSwitchActive) return 'legacy_kill_switch';
  if (!args.companyId) return 'legacy_no_company';
  if (!args.loaderFlagEnabled) return 'legacy_loader_off';
  if (!args.screenFlagEnabled) return 'legacy_screen_off';
  if (!args.companyEngineEnabled) return 'legacy_flags_off';
  if (args.unified) return 'unified_flags_on';
  return 'legacy_flags_off';
}

export async function resolveBalanceSheetMainLoaderSource(
  companyId: string,
  reader: FlagReader = defaultFlagReader,
): Promise<ResolveBalanceSheetMainLoaderSourceResult> {
  try {
    const killSwitchActive = await isUnifiedLedgerKillSwitchActive(companyId, reader);
    if (killSwitchActive) {
      return {
        source: 'killed',
        reason: 'legacy_kill_switch',
        killSwitchActive: true,
        loaderFlagEnabled: false,
        companyEngineEnabled: false,
        screenFlagEnabled: false,
      };
    }

    if (!companyId) {
      return {
        source: 'legacy',
        reason: 'legacy_no_company',
        killSwitchActive: false,
        loaderFlagEnabled: false,
        companyEngineEnabled: false,
        screenFlagEnabled: false,
      };
    }

    const loaderFlagEnabled = await reader.isEnabled(
      companyId,
      UNIFIED_LEDGER_FLAG_KEYS.LOADER_BALANCE_SHEET,
    );
    const companyEngineEnabled = await reader.isEnabled(
      companyId,
      UNIFIED_LEDGER_FLAG_KEYS.ENGINE,
    );
    const screenFlagEnabled = await reader.isEnabled(
      companyId,
      UNIFIED_LEDGER_FLAG_KEYS.SCREEN_BALANCE_SHEET,
    );

    const unified =
      loaderFlagEnabled && companyEngineEnabled && screenFlagEnabled;

    return {
      source: unified ? 'unified' : 'legacy',
      reason: resolveReason({
        killSwitchActive: false,
        companyId,
        loaderFlagEnabled,
        companyEngineEnabled,
        screenFlagEnabled,
        unified,
      }),
      killSwitchActive: false,
      loaderFlagEnabled,
      companyEngineEnabled,
      screenFlagEnabled,
    };
  } catch {
    return {
      source: 'legacy',
      reason: 'legacy_error_fallback',
      killSwitchActive: false,
      loaderFlagEnabled: false,
      companyEngineEnabled: false,
      screenFlagEnabled: false,
    };
  }
}

export function effectiveBalanceSheetMainLoaderSource(
  resolved: ResolveBalanceSheetMainLoaderSourceResult,
): 'legacy' | 'unified' {
  return resolved.source === 'unified' ? 'unified' : 'legacy';
}

export function resolveBalanceSheetMainLoaderFromFlags(args: {
  killSwitchActive: boolean;
  loaderFlagEnabled: boolean;
  companyEngineEnabled: boolean;
  screenFlagEnabled: boolean;
}): BalanceSheetMainLoaderSource {
  if (args.killSwitchActive) return 'killed';
  if (args.loaderFlagEnabled && args.companyEngineEnabled && args.screenFlagEnabled) {
    return 'unified';
  }
  return 'legacy';
}

export type { UnifiedLedgerEngineState };
