/**
 * Phase 2.12 — Trial Balance preview compare source when main loader swaps.
 */

import type { TrialBalanceResult } from '@/app/services/accountingReportsService';
import type { UnifiedTrialBalanceAccount } from '@/app/services/unifiedLedgerService';

export type TrialBalancePreviewCompareSource = 'unified_compare' | 'legacy_shadow';

export type TrialBalancePreviewCompareLabels = {
  panelTitle: string;
  loadingText: string;
  previewTableLabel: string;
  oldEngineName: string;
  newEngineName: string;
  missingInNewTitle: string;
  extraInNewTitle: string;
};

export function resolveTrialBalancePreviewCompareSource(
  mainLoader: 'legacy' | 'unified',
): TrialBalancePreviewCompareSource {
  return mainLoader === 'unified' ? 'legacy_shadow' : 'unified_compare';
}

export function trialBalancePreviewCompareLabels(
  compareSource: TrialBalancePreviewCompareSource,
  args: { legacyEngineLabel: string; unifiedBasisLabel: string },
): TrialBalancePreviewCompareLabels {
  if (compareSource === 'legacy_shadow') {
    return {
      panelTitle: 'Legacy shadow compare (preview only)',
      loadingText: 'Loading legacy shadow compare…',
      previewTableLabel: 'Legacy shadow table (compare only — not official)',
      oldEngineName: args.legacyEngineLabel,
      newEngineName: 'Unified main (active loader)',
      missingInNewTitle: 'Missing in unified main',
      extraInNewTitle: 'Extra in unified main',
    };
  }
  return {
    panelTitle: 'Unified engine preview (compare only)',
    loadingText: 'Loading unified preview…',
    previewTableLabel: 'Unified preview table (not official)',
    oldEngineName: args.legacyEngineLabel,
    newEngineName: `Unified RPC (${args.unifiedBasisLabel})`,
    missingInNewTitle: 'Missing in unified preview',
    extraInNewTitle: 'Extra in unified preview',
  };
}

export function buildTrialBalancePreviewCompareArgs(args: {
  compareSource: TrialBalancePreviewCompareSource;
  mainData: TrialBalanceResult;
  mainAccounts: UnifiedTrialBalanceAccount[];
  shadowData: TrialBalanceResult;
  shadowAccounts: UnifiedTrialBalanceAccount[];
}): {
  legacy: TrialBalanceResult;
  unifiedAccounts: UnifiedTrialBalanceAccount[];
  unifiedTotalDebit: number;
  unifiedTotalCredit: number;
  unifiedDifference: number;
} {
  if (args.compareSource === 'legacy_shadow') {
    return {
      legacy: args.shadowData,
      unifiedAccounts: args.mainAccounts,
      unifiedTotalDebit: args.mainData.totalDebit,
      unifiedTotalCredit: args.mainData.totalCredit,
      unifiedDifference: args.mainData.difference,
    };
  }
  return {
    legacy: args.mainData,
    unifiedAccounts: args.shadowAccounts,
    unifiedTotalDebit: args.shadowData.totalDebit,
    unifiedTotalCredit: args.shadowData.totalCredit,
    unifiedDifference: args.shadowData.difference,
  };
}
