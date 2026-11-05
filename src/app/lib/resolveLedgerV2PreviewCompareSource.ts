/**
 * Phase 2.10C-FIX — Ledger V2 preview compare source when main loader swaps.
 *
 * Loader OFF → main legacy, preview loads unified compare (Stage 2.3 behavior).
 * Loader ON  → main unified, preview loads legacy shadow compare.
 */

export type LedgerV2PreviewCompareSource = 'unified_compare' | 'legacy_shadow';

export type LedgerV2PreviewCompareLabels = {
  panelTitle: string;
  loadingText: string;
  previewTableLabel: string;
  oldEngineName: string;
  newEngineName: string;
  missingInNewTitle: string;
  extraInNewTitle: string;
};

export function resolveLedgerV2PreviewCompareSource(
  mainLoader: 'legacy' | 'unified',
): LedgerV2PreviewCompareSource {
  return mainLoader === 'unified' ? 'legacy_shadow' : 'unified_compare';
}

export function ledgerV2PreviewCompareLabels(
  compareSource: LedgerV2PreviewCompareSource,
  args: {
    legacyEngineLabel: string;
    unifiedBasisLabel: string;
  },
): LedgerV2PreviewCompareLabels {
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

/** Map main + shadow rows into compareLedgerV2UnifiedPreview arguments. */
export function buildLedgerV2PreviewCompareRows(args: {
  compareSource: LedgerV2PreviewCompareSource;
  mainRows: import('@/app/features/ledger-statement-center-v2/types').LedgerStatementV2Row[];
  shadowRows: import('@/app/features/ledger-statement-center-v2/types').LedgerStatementV2Row[];
}): {
  legacyRows: import('@/app/features/ledger-statement-center-v2/types').LedgerStatementV2Row[];
  previewRows: import('@/app/features/ledger-statement-center-v2/types').LedgerStatementV2Row[];
} {
  if (args.compareSource === 'legacy_shadow') {
    return { legacyRows: args.shadowRows, previewRows: args.mainRows };
  }
  return { legacyRows: args.mainRows, previewRows: args.shadowRows };
}
