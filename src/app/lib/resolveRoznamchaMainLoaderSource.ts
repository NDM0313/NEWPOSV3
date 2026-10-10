/**
 * Phase 2.14 — Roznamcha main table loader resolution.
 * Only `unified_ledger_loader_roznamcha` may switch the default main loader from legacy.
 * Session-caches resolution per company to avoid 6–8 serial flag reads on every date change.
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

const resolveCache = new Map<string, { at: number; value: ResolveRoznamchaMainLoaderSourceResult }>();
const RESOLVE_CACHE_TTL_MS = 60_000;

export function clearRoznamchaMainLoaderSourceCache(companyId?: string): void {
  if (!companyId) {
    resolveCache.clear();
    return;
  }
  resolveCache.delete(companyId);
}

export async function resolveRoznamchaMainLoaderSource(
  companyId: string,
  reader: FlagReader = defaultFlagReader,
): Promise<ResolveRoznamchaMainLoaderSourceResult> {
  const cached = companyId ? resolveCache.get(companyId) : undefined;
  if (cached && Date.now() - cached.at < RESOLVE_CACHE_TTL_MS) {
    return cached.value;
  }

  const killSwitchActive = await isUnifiedLedgerKillSwitchActive(companyId, reader);
  if (killSwitchActive) {
    const killed: ResolveRoznamchaMainLoaderSourceResult = {
      source: 'killed',
      killSwitchActive: true,
      loaderFlagEnabled: false,
      companyEngineEnabled: false,
      screenFlagEnabled: false,
    };
    if (companyId) resolveCache.set(companyId, { at: Date.now(), value: killed });
    return killed;
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

  const [loaderFlagEnabled, companyEngineEnabled, screenFlagEnabled] = await Promise.all([
    reader.isEnabled(companyId, UNIFIED_LEDGER_FLAG_KEYS.LOADER_ROZNAMCHA),
    reader.isEnabled(companyId, UNIFIED_LEDGER_FLAG_KEYS.ENGINE),
    reader.isEnabled(companyId, UNIFIED_LEDGER_FLAG_KEYS.SCREEN_ROZNAMCHA),
  ]);

  const unified = loaderFlagEnabled && companyEngineEnabled && screenFlagEnabled;

  const value: ResolveRoznamchaMainLoaderSourceResult = {
    source: unified ? 'unified' : 'legacy',
    killSwitchActive: false,
    loaderFlagEnabled,
    companyEngineEnabled,
    screenFlagEnabled,
  };
  resolveCache.set(companyId, { at: Date.now(), value });
  return value;
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
