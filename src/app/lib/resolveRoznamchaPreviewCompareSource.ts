/**
 * Phase 2.14 — Roznamcha preview compare source when main loader swaps.
 */

import type { RoznamchaResult } from '@/app/services/roznamchaService';
import type { UnifiedLedgerRow } from '@/app/services/unifiedLedgerService';

export type RoznamchaPreviewCompareSource = 'unified_compare' | 'legacy_shadow';

export type RoznamchaPreviewCompareLabels = {
  panelTitle: string;
  loadingText: string;
  previewTableLabel: string;
  oldEngineName: string;
  newEngineName: string;
  missingInNewTitle: string;
  extraInNewTitle: string;
};

export function resolveRoznamchaPreviewCompareSource(
  mainLoader: 'legacy' | 'unified',
): RoznamchaPreviewCompareSource {
  return mainLoader === 'unified' ? 'legacy_shadow' : 'unified_compare';
}

export function roznamchaPreviewCompareLabels(
  compareSource: RoznamchaPreviewCompareSource,
  args: {
    legacyEngineLabel: string;
    unifiedBasisLabel: string;
  },
): RoznamchaPreviewCompareLabels {
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

/** Map main + shadow rows into compareRoznamchaUnifiedPreview arguments. */
export function buildRoznamchaPreviewCompareArgs(args: {
  compareSource: RoznamchaPreviewCompareSource;
  mainResult: RoznamchaResult;
  mainUnifiedRows: UnifiedLedgerRow[];
  shadowLegacy: RoznamchaResult;
  shadowUnifiedRows: UnifiedLedgerRow[];
  shadowClosingBalance: number;
  shadowOpeningBalance: number;
}): {
  legacy: RoznamchaResult;
  unifiedRows: UnifiedLedgerRow[];
  unifiedClosingBalance: number;
  unifiedOpeningBalance: number;
} {
  if (args.compareSource === 'legacy_shadow') {
    return {
      legacy: args.shadowLegacy,
      unifiedRows: args.mainUnifiedRows,
      unifiedClosingBalance: args.mainResult.summary.closingBalance,
      unifiedOpeningBalance: args.mainResult.summary.openingBalance,
    };
  }
  return {
    legacy: args.mainResult,
    unifiedRows: args.shadowUnifiedRows,
    unifiedClosingBalance: args.shadowClosingBalance,
    unifiedOpeningBalance: args.shadowOpeningBalance,
  };
}
