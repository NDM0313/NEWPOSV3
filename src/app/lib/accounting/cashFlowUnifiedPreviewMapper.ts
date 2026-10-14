/**
 * Phase 3B — map unified cash/bank ledger rows → Cash Flow preview summary (read-only).
 * Phase 3B-H — applies approved finance rules Q4=A, Q5=C to preview totals only.
 */

import type { UnifiedLedgerRow } from '@/app/services/unifiedLedgerService';
import {
  computeCashFlowSummary,
  filterCashFlowRowsBySourceModule,
  inferCashFlowSourceModule,
  type CashFlowSourceModule,
  type CashFlowSummary,
} from '@/app/lib/cashFlowReportLogic';
import {
  CASH_FLOW_APPROVED_FINANCE_RULES,
  CASH_FLOW_FINANCE_ALIGNMENT_NOTES,
  classifyPreviewFinanceAlignment,
  excludeFromNormalPreviewPeriodTotals,
} from '@/app/lib/accounting/cashFlowPreviewFinanceAlignment';

export type CashFlowUnifiedPreviewResult = {
  previewOnly: true;
  needsFinanceGoldenApproval: true;
  summary: CashFlowSummary;
  rowCount: number;
  sourceModuleFilter: CashFlowSourceModule | 'all';
  auditMode: boolean;
  accountingRuleNotes: string[];
  financeAlignmentApplied: true;
  financeRules: typeof CASH_FLOW_APPROVED_FINANCE_RULES;
  excludedFromNormalTotals: {
    internalTransferRows: number;
    openingBalanceRows: number;
    auditDetailRows: number;
  };
  totalUnifiedRows: number;
};

export function mapUnifiedRowsToCashFlowPreview(args: {
  unifiedRows: UnifiedLedgerRow[];
  openingBalance: number;
  sourceModuleFilter: CashFlowSourceModule | 'all';
  auditMode: boolean;
}): CashFlowUnifiedPreviewResult {
  const mapped = args.unifiedRows.map((row) => {
    const sourceModule = inferCashFlowSourceModule({
      rowType: row.referenceType || 'journal',
      referenceType: row.referenceType,
      rowId: row.journalEntryLineId || row.journalEntryId,
    });
    const alignment = classifyPreviewFinanceAlignment({
      referenceType: row.referenceType,
      sourceModule,
    });
    return {
      cashIn: row.debit,
      cashOut: row.credit,
      sourceModule,
      alignment,
    };
  });

  let excludedTransfers = 0;
  let excludedOpening = 0;
  const periodRows = mapped.filter((r) => {
    if (excludeFromNormalPreviewPeriodTotals(r.alignment)) {
      if (r.alignment === 'internal_transfer_excluded_normal') excludedTransfers += 1;
      if (r.alignment === 'opening_summary_only') excludedOpening += 1;
      return false;
    }
    return true;
  });

  const filtered = filterCashFlowRowsBySourceModule(
    periodRows.map(({ cashIn, cashOut, sourceModule }) => ({ cashIn, cashOut, sourceModule })),
    args.sourceModuleFilter
  );
  const summary = computeCashFlowSummary(filtered, args.openingBalance);

  return {
    previewOnly: true,
    needsFinanceGoldenApproval: true,
    summary,
    rowCount: filtered.length,
    sourceModuleFilter: args.sourceModuleFilter,
    auditMode: args.auditMode,
    financeAlignmentApplied: true,
    financeRules: CASH_FLOW_APPROVED_FINANCE_RULES,
    excludedFromNormalTotals: {
      internalTransferRows: excludedTransfers,
      openingBalanceRows: excludedOpening,
      auditDetailRows: excludedTransfers + excludedOpening,
    },
    totalUnifiedRows: args.unifiedRows.length,
    accountingRuleNotes: [
      'Phase 3B-M: unified main uses approved finance rules Q4=A, Q5=C, Q7=B when loader flag ON.',
      'Opening balance rows summary-only — not period cash-in (Q4=A).',
      'Internal transfers excluded from normal totals (Q5=C).',
      'Derived from get_unified_cash_bank_ledger (unified Roznamcha path).',
      'Legacy getCashFlowReport when loader flag OFF or kill switch ON.',
      ...CASH_FLOW_FINANCE_ALIGNMENT_NOTES,
    ],
  };
}
