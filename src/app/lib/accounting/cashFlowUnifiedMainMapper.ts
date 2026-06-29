/**
 * Phase 3B-M — map unified cash/bank ledger rows → Cash Flow main report (finance-aligned).
 * Applies approved rules Q4=A, Q5=C, Q7=B when unified loader is active.
 */

import type { UnifiedLedgerRow } from '@/app/services/unifiedLedgerService';
import type { CashFlowReportResult, CashFlowRow } from '@/app/services/cashFlowReportService';
import {
  CASH_FLOW_SOURCE_MODULE_LABELS,
  computeCashFlowSummary,
  filterCashFlowRowsBySourceModule,
  inferCashFlowSourceModule,
  recomputeCashFlowRunningBalance,
  resolveCashFlowRowStatus,
  type CashFlowSourceModule,
} from '@/app/lib/cashFlowReportLogic';
import {
  CASH_FLOW_APPROVED_FINANCE_RULES,
  classifyPreviewFinanceAlignment,
  excludeFromNormalPreviewPeriodTotals,
} from '@/app/lib/accounting/cashFlowPreviewFinanceAlignment';

export type CashFlowUnifiedMainResult = CashFlowReportResult & {
  unifiedMain: true;
  financeAlignmentApplied: true;
  financeRules: typeof CASH_FLOW_APPROVED_FINANCE_RULES;
  totalUnifiedRows: number;
};

function mapUnifiedRowToCashFlowRow(row: UnifiedLedgerRow): CashFlowRow {
  const sourceModule = inferCashFlowSourceModule({
    rowType: row.referenceType || 'journal',
    referenceType: row.referenceType,
    rowId: row.journalEntryLineId || row.journalEntryId,
  });
  const status = resolveCashFlowRowStatus({
    id: row.journalEntryLineId || row.journalEntryId,
    details: row.description,
    rowType: row.referenceType || 'journal',
    referenceType: row.referenceType,
    sourcePaymentId: row.paymentId,
    sourceJournalEntryId: row.journalEntryId,
  });
  const cashAccount = row.accountName?.trim() || row.accountCode?.trim() || '—';

  return {
    id: row.journalEntryLineId || row.journalEntryId,
    date: row.entryDate,
    time: '',
    reference: row.entryNo || '—',
    journalEntryNo: row.entryNo,
    party: row.partyResolved,
    sourceModule,
    sourceModuleLabel: CASH_FLOW_SOURCE_MODULE_LABELS[sourceModule],
    cashAccount,
    cashIn: row.debit,
    cashOut: row.credit,
    runningBalance: row.runningBalance,
    status,
    branchId: row.branchId,
    branchName: row.branchName,
    details: row.description || '—',
    referenceType: row.referenceType,
    sourcePaymentId: row.paymentId,
    sourceJournalEntryId: row.journalEntryId,
    sourceRentalPaymentId: null,
  };
}

export function mapUnifiedRowsToCashFlowMain(args: {
  unifiedRows: UnifiedLedgerRow[];
  openingBalance: number;
  sourceModuleFilter: CashFlowSourceModule | 'all';
  auditMode: boolean;
}): CashFlowUnifiedMainResult {
  const auditMode = args.auditMode === true;
  const mapped = args.unifiedRows.map((row) => mapUnifiedRowToCashFlowRow(row));

  let displayRows = mapped;
  if (!auditMode) {
    displayRows = mapped.filter((row) => {
      const alignment = classifyPreviewFinanceAlignment({
        referenceType: row.referenceType,
        sourceModule: row.sourceModule,
      });
      return !excludeFromNormalPreviewPeriodTotals(alignment);
    });
  }

  displayRows = filterCashFlowRowsBySourceModule(displayRows, args.sourceModuleFilter);
  displayRows = recomputeCashFlowRunningBalance(displayRows, args.openingBalance);
  const summary = computeCashFlowSummary(displayRows, args.openingBalance);

  return {
    rows: displayRows,
    summary,
    auditMode,
    unifiedMain: true,
    financeAlignmentApplied: true,
    financeRules: CASH_FLOW_APPROVED_FINANCE_RULES,
    totalUnifiedRows: args.unifiedRows.length,
  };
}
