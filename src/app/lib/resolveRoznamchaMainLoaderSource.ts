/**
 * Phase 2.14 — Roznamcha main table loader resolution.
 * Only `unified_ledger_loader_roznamcha` may switch the default main loader from legacy.
 */

import {
  isUnifiedLedgerKillSwitchActive,
  type UnifiedLedgerEngineState,
} from '@/app/lib/unifiedLedgerEngineState';
import { UNIFIED_LEDGER_FLAG_KEYS } from '@/app/lib/unifiedLedgerFlagKeys';

export type RoznamchaMainLoaderSource = 'legacy' | 'unified' | 'killed';

export type ResolveRoznamchaMainLoaderSourceResult = {
  source: RoznamchaMainLoaderSource;
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

export async function resolveRoznamchaMainLoaderSource(
  companyId: string,
  reader: FlagReader = defaultFlagReader,
): Promise<ResolveRoznamchaMainLoaderSourceResult> {
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
    UNIFIED_LEDGER_FLAG_KEYS.LOADER_ROZNAMCHA,
  );
  const companyEngineEnabled = await reader.isEnabled(
    companyId,
    UNIFIED_LEDGER_FLAG_KEYS.ENGINE,
  );
  const screenFlagEnabled = await reader.isEnabled(
    companyId,
    UNIFIED_LEDGER_FLAG_KEYS.SCREEN_ROZNAMCHA,
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

export function effectiveRoznamchaMainLoaderSource(
  resolved: ResolveRoznamchaMainLoaderSourceResult,
): 'legacy' | 'unified' {
  return resolved.source === 'unified' ? 'unified' : 'legacy';
}

export function resolveRoznamchaMainLoaderFromFlags(args: {
  killSwitchActive: boolean;
  loaderFlagEnabled: boolean;
  companyEngineEnabled: boolean;
  screenFlagEnabled: boolean;
}): RoznamchaMainLoaderSource {
  if (args.killSwitchActive) return 'killed';
  if (args.loaderFlagEnabled && args.companyEngineEnabled && args.screenFlagEnabled) {
    return 'unified';
  }
  return 'legacy';
}

export type { UnifiedLedgerEngineState };
