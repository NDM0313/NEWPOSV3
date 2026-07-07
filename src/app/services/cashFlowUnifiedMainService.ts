/**
 * Phase 3B-M — Cash Flow unified engine main loader.
 * Finance-aligned totals (Q4=A, Q5=C, Q7=B) when loader flag is ON.
 */

import type { UnifiedLedgerBasis } from '@/app/lib/unifiedLedgerBasisFilter';
import { enrichRowsWithTransactionAttachments } from '@/app/lib/roznamchaAttachments';
import { mapUnifiedRowsToCashFlowMain } from '@/app/lib/accounting/cashFlowUnifiedMainMapper';
import type { CashFlowUnifiedMainResult } from '@/app/lib/accounting/cashFlowUnifiedMainMapper';
import { previewBasisFromVoidedToggle } from '@/app/lib/roznamchaUnifiedPreviewDiff';
import type { CashFlowSourceModule } from '@/app/lib/cashFlowReportLogic';
import type { AccountFilter } from '@/app/services/roznamchaService';
import { loadRoznamchaUnifiedPreview } from '@/app/services/roznamchaUnifiedPreviewService';

export async function loadCashFlowUnifiedMain(params: {
  companyId: string;
  branchId: string | null;
  dateFrom: string;
  dateTo: string;
  accountFilter?: AccountFilter;
  paymentLedgerAccountId?: string | null;
  paymentAccountOptions: Array<{ id: string; label: string }>;
  auditMode?: boolean;
  sourceModuleFilter?: CashFlowSourceModule | 'all';
  basis?: UnifiedLedgerBasis;
}): Promise<CashFlowUnifiedMainResult> {
  const auditMode = params.auditMode === true;
  const basis = previewBasisFromVoidedToggle(auditMode, params.basis);

  const roznamchaPreview = await loadRoznamchaUnifiedPreview({
    companyId: params.companyId,
    branchId: params.branchId,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    accountFilter: params.accountFilter ?? 'all',
    includeVoidedReversed: auditMode,
    paymentLedgerAccountId: params.paymentLedgerAccountId?.trim()
      ? params.paymentLedgerAccountId.trim()
      : null,
    paymentAccountOptions: params.paymentAccountOptions,
    basis,
  });

  if (roznamchaPreview.blockedByKillSwitch) {
    throw new Error(roznamchaPreview.blockReason ?? 'Unified Cash Flow blocked by kill switch.');
  }

  const result = mapUnifiedRowsToCashFlowMain({
    unifiedRows: roznamchaPreview.unifiedRows,
    openingBalance: roznamchaPreview.openingBalance,
    sourceModuleFilter: params.sourceModuleFilter ?? 'all',
    auditMode,
  });
  await enrichRowsWithTransactionAttachments(params.companyId, result.rows);
  return result;
}
