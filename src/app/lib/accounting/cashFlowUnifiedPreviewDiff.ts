/**
 * Phase 3B — pure diff helpers for Cash Flow unified preview compare.
 */

import { balancePasses, round2 } from '@/app/lib/unifiedLedgerCompareDiff';
import type { UnifiedLedgerBasis } from '@/app/lib/unifiedLedgerBasisFilter';
import type { CashFlowReportResult } from '@/app/services/cashFlowReportService';
import type { CashFlowUnifiedPreviewResult } from '@/app/lib/accounting/cashFlowUnifiedPreviewMapper';

export const DEFAULT_CASH_FLOW_PREVIEW_BASIS: UnifiedLedgerBasis = 'official_gl';

export type CashFlowUnifiedPreviewDiff = {
  legacyOpening: number;
  previewOpening: number;
  openingDelta: number;
  legacyCashIn: number;
  previewCashIn: number;
  cashInDelta: number;
  legacyCashOut: number;
  previewCashOut: number;
  cashOutDelta: number;
  legacyNetMovement: number;
  previewNetMovement: number;
  netMovementDelta: number;
  legacyClosing: number;
  previewClosing: number;
  closingDelta: number;
  legacyRowCount: number;
  previewRowCount: number;
  rowCountDelta: number;
  pass: boolean;
  previewOnly: true;
  needsFinanceGoldenApproval: true;
};

export function compareCashFlowUnifiedPreview(args: {
  legacy: CashFlowReportResult;
  preview: CashFlowUnifiedPreviewResult;
}): CashFlowUnifiedPreviewDiff {
  const ls = args.legacy.summary;
  const ps = args.preview.summary;
  const openingDelta = round2(ls.opening - ps.opening);
  const cashInDelta = round2(ls.cashIn - ps.cashIn);
  const cashOutDelta = round2(ls.cashOut - ps.cashOut);
  const netMovementDelta = round2(ls.netMovement - ps.netMovement);
  const closingDelta = round2(ls.closing - ps.closing);
  const legacyRowCount = args.legacy.rows.length;
  const previewRowCount = args.preview.rowCount;
  const rowCountDelta = legacyRowCount - previewRowCount;

  const pass =
    balancePasses(openingDelta) &&
    balancePasses(cashInDelta) &&
    balancePasses(cashOutDelta) &&
    balancePasses(netMovementDelta) &&
    balancePasses(closingDelta);

  return {
    legacyOpening: ls.opening,
    previewOpening: ps.opening,
    openingDelta,
    legacyCashIn: ls.cashIn,
    previewCashIn: ps.cashIn,
    cashInDelta,
    legacyCashOut: ls.cashOut,
    previewCashOut: ps.cashOut,
    cashOutDelta,
    legacyNetMovement: ls.netMovement,
    previewNetMovement: ps.netMovement,
    netMovementDelta,
    legacyClosing: ls.closing,
    previewClosing: ps.closing,
    closingDelta,
    legacyRowCount,
    previewRowCount,
    rowCountDelta,
    pass,
    previewOnly: true,
    needsFinanceGoldenApproval: true,
  };
}
