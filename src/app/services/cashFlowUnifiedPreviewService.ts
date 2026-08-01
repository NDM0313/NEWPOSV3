/**
 * Phase 3B — Cash Flow unified preview loader (parallel fetch only).
 * Never replaces cashFlowReportService.getCashFlowReport main path.
 */

import type { UnifiedLedgerBasis } from '@/app/lib/unifiedLedgerBasisFilter';
import type { CashFlowSourceModule } from '@/app/lib/cashFlowReportLogic';
import { mapUnifiedRowsToCashFlowPreview } from '@/app/lib/accounting/cashFlowUnifiedPreviewMapper';
import type { CashFlowUnifiedPreviewResult } from '@/app/lib/accounting/cashFlowUnifiedPreviewMapper';
import { previewBasisFromVoidedToggle } from '@/app/lib/roznamchaUnifiedPreviewDiff';
import type { AccountFilter } from '@/app/services/roznamchaService';
import {
  loadRoznamchaUnifiedPreview,
  type RoznamchaUnifiedPreviewResult,
} from '@/app/services/roznamchaUnifiedPreviewService';

export type CashFlowUnifiedPreviewLoadResult = {
  preview: CashFlowUnifiedPreviewResult | null;
  roznamchaPreview: RoznamchaUnifiedPreviewResult;
  basis: UnifiedLedgerBasis;
};

export async function loadCashFlowUnifiedPreview(params: {
  companyId: string;
  branchId: string | null;
  dateFrom: string;
  dateTo: string;
  accountFilter: AccountFilter;
  paymentLedgerAccountId: string | null;
  paymentAccountOptions: Array<{ id: string; label: string }>;
  auditMode: boolean;
  sourceModuleFilter: CashFlowSourceModule | 'all';
  basis?: UnifiedLedgerBasis;
}): Promise<CashFlowUnifiedPreviewLoadResult> {
  const auditMode = params.auditMode === true;
  const basis = previewBasisFromVoidedToggle(auditMode, params.basis);

  const roznamchaPreview = await loadRoznamchaUnifiedPreview({
    companyId: params.companyId,
    branchId: params.branchId,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    accountFilter: params.accountFilter ?? 'all',
    includeVoidedReversed: auditMode,
    paymentLedgerAccountId: params.paymentLedgerAccountId,
    paymentAccountOptions: params.paymentAccountOptions,
    basis,
  });

  if (roznamchaPreview.blockedByKillSwitch) {
    return { preview: null, roznamchaPreview, basis };
  }

  const preview = mapUnifiedRowsToCashFlowPreview({
    unifiedRows: roznamchaPreview.unifiedRows,
    openingBalance: roznamchaPreview.openingBalance,
    sourceModuleFilter: params.sourceModuleFilter ?? 'all',
    auditMode,
  });

  return { preview, roznamchaPreview, basis };
}
