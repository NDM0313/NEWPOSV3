/**
 * Phase 2.13 — Party Ledger main table loader resolution.
 * Only `unified_ledger_loader_party_ledger` may switch the default main loader from legacy.
 */

import {
  isUnifiedLedgerKillSwitchActive,
  type UnifiedLedgerEngineState,
} from '@/app/lib/unifiedLedgerEngineState';
import { UNIFIED_LEDGER_FLAG_KEYS } from '@/app/lib/unifiedLedgerFlagKeys';

export type PartyLedgerMainLoaderSource = 'legacy' | 'unified' | 'killed';

export type ResolvePartyLedgerMainLoaderSourceResult = {
  source: PartyLedgerMainLoaderSource;
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

export async function resolvePartyLedgerMainLoaderSource(
  companyId: string,
  reader: FlagReader = defaultFlagReader,
): Promise<ResolvePartyLedgerMainLoaderSourceResult> {
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
    UNIFIED_LEDGER_FLAG_KEYS.LOADER_PARTY_LEDGER,
  );
  const companyEngineEnabled = await reader.isEnabled(
    companyId,
    UNIFIED_LEDGER_FLAG_KEYS.ENGINE,
  );
  const screenFlagEnabled = await reader.isEnabled(
    companyId,
    UNIFIED_LEDGER_FLAG_KEYS.SCREEN_PARTY_LEDGER,
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

export function effectivePartyLedgerMainLoaderSource(
  resolved: ResolvePartyLedgerMainLoaderSourceResult,
): 'legacy' | 'unified' {
  return resolved.source === 'unified' ? 'unified' : 'legacy';
}

export function resolvePartyLedgerMainLoaderFromFlags(args: {
  killSwitchActive: boolean;
  loaderFlagEnabled: boolean;
  companyEngineEnabled: boolean;
  screenFlagEnabled: boolean;
}): PartyLedgerMainLoaderSource {
  if (args.killSwitchActive) return 'killed';
  if (args.loaderFlagEnabled && args.companyEngineEnabled && args.screenFlagEnabled) {
    return 'unified';
  }
  return 'legacy';
}

export type { UnifiedLedgerEngineState };
