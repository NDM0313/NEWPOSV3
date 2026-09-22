/**
 * Phase 2.11 — Account Statement preview compare source when main loader swaps.
 *
 * Loader OFF → main legacy, preview loads unified compare (Stage 2.4 behavior).
 * Loader ON  → main unified, preview loads legacy shadow compare.
 */

import type { AccountLedgerEntry } from '@/app/services/accountingService';

export type AccountStatementPreviewCompareSource = 'unified_compare' | 'legacy_shadow';

export type AccountStatementPreviewCompareLabels = {
  panelTitle: string;
  loadingText: string;
  previewTableLabel: string;
  oldEngineName: string;
  newEngineName: string;
  missingInNewTitle: string;
  extraInNewTitle: string;
};

export function resolveAccountStatementPreviewCompareSource(
  mainLoader: 'legacy' | 'unified',
): AccountStatementPreviewCompareSource {
  return mainLoader === 'unified' ? 'legacy_shadow' : 'unified_compare';
}

export function accountStatementPreviewCompareLabels(
  compareSource: AccountStatementPreviewCompareSource,
  args: {
    legacyEngineLabel: string;
    unifiedBasisLabel: string;
  },
): AccountStatementPreviewCompareLabels {
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

/** Map main + shadow rows into compareAccountStatementUnifiedPreview arguments. */
export function buildAccountStatementPreviewCompareRows(args: {
  compareSource: AccountStatementPreviewCompareSource;
  mainEntries: AccountLedgerEntry[];
  shadowEntries: AccountLedgerEntry[];
}): {
  legacyEntries: AccountLedgerEntry[];
  previewEntries: AccountLedgerEntry[];
} {
  if (args.compareSource === 'legacy_shadow') {
    return { legacyEntries: args.shadowEntries, previewEntries: args.mainEntries };
  }
  return { legacyEntries: args.mainEntries, previewEntries: args.shadowEntries };
}
