/**
 * Central unified ledger engine state resolver (Phase 2.1).
 * Resolution: env kill → DB kill → localStorage → per-screen → company engine → legacy default.
 * Engine remains OFF by default; no feature_flags writes in this module.
 */

import {
  getUnifiedLedgerLocalOverride,
  UNIFIED_LEDGER_ENGINE_DEFAULT,
} from '@/app/lib/unifiedLedgerFeatureFlag';
import {
  unifiedLedgerScreenFlagKey,
  type UnifiedLedgerScreenId,
} from '@/app/lib/unifiedLedgerScreenFlags';
import { UNIFIED_LEDGER_FLAG_KEYS } from '@/app/lib/unifiedLedgerFlagKeys';

export type UnifiedLedgerEngineMode =
  | 'legacy'
  | 'preview'
  | 'unified'
  | 'killed'
  | 'disabled';

export type UnifiedLedgerEngineState = {
  mode: UnifiedLedgerEngineMode;
  killSwitchActive: boolean;
  companyEngineEnabled: boolean;
  screenFlagEnabled: boolean;
  pilotEnabled: boolean;
  localOverride: boolean | null;
  /** Whether unified RPC paths may run (shadowForce still allowed under kill). */
  rpcAllowed: boolean;
};

export type ResolveUnifiedLedgerEngineStateOptions = {
  screenId?: UnifiedLedgerScreenId;
  /** Admin tie-out / shadow compare surface — shows preview mode when not killed. */
  adminTieOut?: boolean;
  shadowForce?: boolean;
};

/** Build-time or ops redeploy kill — no DB required. */
export function isUnifiedLedgerEnvKillActive(): boolean {
  const viteVal =
    typeof import.meta !== 'undefined' &&
    import.meta.env &&
    String(import.meta.env.VITE_UNIFIED_LEDGER_ENGINE_KILLED || '').toLowerCase() === 'true';
  const nodeVal =
    typeof process !== 'undefined' &&
    String(process.env.VITE_UNIFIED_LEDGER_ENGINE_KILLED || '').toLowerCase() === 'true';
  return viteVal || nodeVal;
}

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
 * True when env or DB kill switch forces legacy-only paths.
 */
export async function isUnifiedLedgerKillSwitchActive(
  companyId: string,
  reader: FlagReader = defaultFlagReader
): Promise<boolean> {
  if (isUnifiedLedgerEnvKillActive()) return true;
  if (!companyId) return false;
  return reader.isEnabled(companyId, UNIFIED_LEDGER_FLAG_KEYS.KILL_SWITCH);
}

function resolveMode(args: {
  killSwitchActive: boolean;
  companyEngineEnabled: boolean;
  screenFlagEnabled: boolean;
  adminTieOut: boolean;
  hasScreenId: boolean;
}): UnifiedLedgerEngineMode {
  if (args.killSwitchActive) return 'killed';
  if (args.adminTieOut) return 'preview';
  if (args.companyEngineEnabled && args.hasScreenId && args.screenFlagEnabled) return 'unified';
  if (!args.companyEngineEnabled) return 'legacy';
  if (args.companyEngineEnabled && args.hasScreenId && !args.screenFlagEnabled) return 'legacy';
  return 'disabled';
}

/**
 * Single resolver for engine mode, flags snapshot, and RPC allowance.
 */
export async function resolveUnifiedLedgerEngineState(
  companyId: string,
  options: ResolveUnifiedLedgerEngineStateOptions = {},
  reader: FlagReader = defaultFlagReader
): Promise<UnifiedLedgerEngineState> {
  const localOverride = getUnifiedLedgerLocalOverride();
  const killSwitchActive = await isUnifiedLedgerKillSwitchActive(companyId, reader);

  let companyEngineEnabled = UNIFIED_LEDGER_ENGINE_DEFAULT;
  let screenFlagEnabled = false;
  let pilotEnabled = false;

  if (!killSwitchActive && companyId) {
    if (localOverride !== null) {
      companyEngineEnabled = localOverride;
    } else {
      companyEngineEnabled = await reader.isEnabled(companyId, UNIFIED_LEDGER_FLAG_KEYS.ENGINE);
    }

    pilotEnabled = await reader.isEnabled(companyId, UNIFIED_LEDGER_FLAG_KEYS.PILOT);

    if (options.screenId) {
      screenFlagEnabled = await reader.isEnabled(
        companyId,
        unifiedLedgerScreenFlagKey(options.screenId)
      );
    }
  }

  const adminTieOut = options.adminTieOut === true;
  const mode = resolveMode({
    killSwitchActive,
    companyEngineEnabled,
    screenFlagEnabled,
    adminTieOut,
    hasScreenId: Boolean(options.screenId),
  });

  const shadowForce = options.shadowForce === true;
  const rpcAllowed = killSwitchActive ? shadowForce : companyEngineEnabled || shadowForce;

  return {
    mode,
    killSwitchActive,
    companyEngineEnabled,
    screenFlagEnabled,
    pilotEnabled,
    localOverride,
    rpcAllowed,
  };
}

/** Company-level engine enabled (ignores per-screen gate). Respects kill switch. */
export async function isUnifiedLedgerCompanyEngineEnabled(
  companyId: string,
  reader: FlagReader = defaultFlagReader
): Promise<boolean> {
  const killSwitchActive = await isUnifiedLedgerKillSwitchActive(companyId, reader);
  if (killSwitchActive) return false;

  const localOverride = getUnifiedLedgerLocalOverride();
  if (localOverride !== null) return localOverride;
  if (!companyId) return UNIFIED_LEDGER_ENGINE_DEFAULT;

  return reader.isEnabled(companyId, UNIFIED_LEDGER_FLAG_KEYS.ENGINE);
}
