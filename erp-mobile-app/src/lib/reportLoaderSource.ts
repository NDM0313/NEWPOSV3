import { isFeatureFlagEnabled } from '../api/featureFlags';
import { isUnifiedLedgerKillSwitchActive } from './unifiedLedgerEngineState';
import {
  UNIFIED_LEDGER_FLAG_KEYS,
  type UnifiedReportScreenId,
  unifiedLoaderFlagKey,
  unifiedScreenFlagKey,
} from './unifiedLedgerFlagKeys';

export type ReportLoaderSource = 'legacy' | 'unified' | 'unavailable';

export type ResolveReportLoaderResult = {
  source: ReportLoaderSource;
  killSwitchActive: boolean;
  loaderFlagEnabled: boolean;
  companyEngineEnabled: boolean;
  screenFlagEnabled: boolean;
};

export function effectiveReportLoaderSource(
  resolved: ResolveReportLoaderResult,
): 'legacy' | 'unified' {
  return resolved.source === 'unified' ? 'unified' : 'legacy';
}

export async function resolveReportMainLoaderSource(
  companyId: string,
  screenId: UnifiedReportScreenId,
  options?: { legacyAvailable?: boolean },
): Promise<ResolveReportLoaderResult> {
  const legacyAvailable = options?.legacyAvailable !== false;
  const empty: ResolveReportLoaderResult = {
    source: legacyAvailable ? 'legacy' : 'unavailable',
    killSwitchActive: false,
    loaderFlagEnabled: false,
    companyEngineEnabled: false,
    screenFlagEnabled: false,
  };

  try {
    const killSwitchActive = await isUnifiedLedgerKillSwitchActive(companyId);
    if (killSwitchActive) {
      return { ...empty, killSwitchActive: true, source: legacyAvailable ? 'legacy' : 'unavailable' };
    }
    if (!companyId) return empty;

    const loaderFlagEnabled = await isFeatureFlagEnabled(companyId, unifiedLoaderFlagKey(screenId));
    const companyEngineEnabled = await isFeatureFlagEnabled(
      companyId,
      UNIFIED_LEDGER_FLAG_KEYS.ENGINE,
    );
    const screenFlagEnabled = await isFeatureFlagEnabled(companyId, unifiedScreenFlagKey(screenId));

    const unified = loaderFlagEnabled && companyEngineEnabled && screenFlagEnabled;
    if (unified) {
      return {
        source: 'unified',
        killSwitchActive: false,
        loaderFlagEnabled,
        companyEngineEnabled,
        screenFlagEnabled,
      };
    }
    return {
      source: legacyAvailable ? 'legacy' : 'unavailable',
      killSwitchActive: false,
      loaderFlagEnabled,
      companyEngineEnabled,
      screenFlagEnabled,
    };
  } catch {
    return { ...empty, source: legacyAvailable ? 'legacy' : 'unavailable' };
  }
}
