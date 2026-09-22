/**
 * Pure diff helpers for Roznamcha unified preview compare (Phase 2.6).
 */

import type { UnifiedLedgerBasis } from '@/app/lib/unifiedLedgerBasisFilter';
import { balancePasses, round2 } from '@/app/lib/unifiedLedgerCompareDiff';
import type { CompareRowMismatch, CompareRowSummary } from '@/app/lib/unifiedLedgerCompareTypes';
import { diffCashBankLedgerRows } from '@/app/lib/roznamchaCashBankCompareMappers';
import type { RoznamchaResult } from '@/app/services/roznamchaService';
import type { UnifiedLedgerRow } from '@/app/services/unifiedLedgerService';
import { defaultUnifiedBasisForRoznamcha } from '@/app/lib/roznamchaUnifiedPreviewScope';

export type RoznamchaUnifiedPreviewDiff = {
  oldOpening: number;
  newOpening: number;
  oldClosing: number;
  newClosing: number;
  difference: number;
  oldCashIn: number;
  newCashIn: number;
  oldCashOut: number;
  newCashOut: number;
  totalsPass: boolean;
  pass: boolean;
  missingInNew: CompareRowSummary[];
  extraInNew: CompareRowSummary[];
  amountMismatches: CompareRowMismatch[];
  oldRowCount: number;
  newRowCount: number;
};

export { defaultUnifiedBasisForRoznamcha };

function sumUnifiedCashIn(rows: UnifiedLedgerRow[]): number {
  return round2(rows.reduce((s, r) => s + (r.debit || 0), 0));
}

function sumUnifiedCashOut(rows: UnifiedLedgerRow[]): number {
  return round2(rows.reduce((s, r) => s + (r.credit || 0), 0));
}

export function compareRoznamchaUnifiedPreview(args: {
  legacy: RoznamchaResult;
  unifiedRows: UnifiedLedgerRow[];
  unifiedClosingBalance: number;
  unifiedOpeningBalance: number;
}): RoznamchaUnifiedPreviewDiff {
  const oldOpening = round2(args.legacy.summary.openingBalance);
  const newOpening = round2(args.unifiedOpeningBalance);
  const oldClosing = round2(args.legacy.summary.closingBalance);
  const newClosing = round2(args.unifiedClosingBalance);
  const difference = round2(oldClosing - newClosing);

  const oldCashIn = round2(args.legacy.summary.cashIn);
  const oldCashOut = round2(args.legacy.summary.cashOut);
  const newCashIn = sumUnifiedCashIn(args.unifiedRows);
  const newCashOut = sumUnifiedCashOut(args.unifiedRows);

  const openingDelta = round2(oldOpening - newOpening);
  const cashInDelta = round2(oldCashIn - newCashIn);
  const cashOutDelta = round2(oldCashOut - newCashOut);

  const totalsPass =
    balancePasses(difference) &&
    balancePasses(openingDelta) &&
    balancePasses(cashInDelta) &&
    balancePasses(cashOutDelta);

  const rowDiff = diffCashBankLedgerRows({
    oldRows: args.legacy.rows,
    newRows: args.unifiedRows,
  });

  const hasRowDiffs =
    rowDiff.missingInNew.length > 0 ||
    rowDiff.extraInNew.length > 0 ||
    rowDiff.amountMismatches.length > 0;

  const pass = totalsPass && !hasRowDiffs;

  return {
    oldOpening,
    newOpening,
    oldClosing,
    newClosing,
    difference,
    oldCashIn,
    newCashIn,
    oldCashOut,
    newCashOut,
    totalsPass,
    pass,
    missingInNew: rowDiff.missingInNew,
    extraInNew: rowDiff.extraInNew,
    amountMismatches: rowDiff.amountMismatches,
    oldRowCount: args.legacy.rows.length,
    newRowCount: args.unifiedRows.length,
  };
}

export function previewBasisFromVoidedToggle(
  includeVoidedReversed: boolean,
  override?: UnifiedLedgerBasis
): UnifiedLedgerBasis {
  return override ?? defaultUnifiedBasisForRoznamcha(includeVoidedReversed);
}
