/**
 * Phase 3B — map unified cash/bank ledger rows → Cash Flow preview summary (read-only).
 */

import type { UnifiedLedgerRow } from '@/app/services/unifiedLedgerService';
import {
  computeCashFlowSummary,
  filterCashFlowRowsBySourceModule,
  inferCashFlowSourceModule,
  type CashFlowSourceModule,
  type CashFlowSummary,
} from '@/app/lib/cashFlowReportLogic';

export type CashFlowUnifiedPreviewResult = {
  previewOnly: true;
  needsFinanceGoldenApproval: true;
  summary: CashFlowSummary;
  rowCount: number;
  sourceModuleFilter: CashFlowSourceModule | 'all';
  auditMode: boolean;
  accountingRuleNotes: string[];
};

export function mapUnifiedRowsToCashFlowPreview(args: {
  unifiedRows: UnifiedLedgerRow[];
  openingBalance: number;
  sourceModuleFilter: CashFlowSourceModule | 'all';
  auditMode: boolean;
}): CashFlowUnifiedPreviewResult {
  let rows = args.unifiedRows.map((row) => ({
    cashIn: row.debit,
    cashOut: row.credit,
    sourceModule: inferCashFlowSourceModule({
      rowType: row.referenceType || 'journal',
      referenceType: row.referenceType,
      rowId: row.journalEntryLineId || row.journalEntryId,
    }),
  }));
  rows = filterCashFlowRowsBySourceModule(rows, args.sourceModuleFilter);
  const summary = computeCashFlowSummary(rows, args.openingBalance);

  return {
    previewOnly: true,
    needsFinanceGoldenApproval: true,
    summary,
    rowCount: rows.length,
    sourceModuleFilter: args.sourceModuleFilter,
    auditMode: args.auditMode,
    accountingRuleNotes: [
      'PREVIEW_ONLY — not finance-approved golden totals.',
      'Derived from get_unified_cash_bank_ledger (unified Roznamcha preview path).',
      'Legacy getCashFlowReport → roznamchaService.getRoznamcha remains main.',
      'Cash Flow screen does not use unified Roznamcha main loader when ON — preview-only parity compare.',
      'NEEDS_FINANCE_GOLDEN_APPROVAL before any loader swap.',
    ],
  };
}
