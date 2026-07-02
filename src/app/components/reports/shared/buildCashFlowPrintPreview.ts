import type { CashBookReportColumn } from '@/app/components/reports/shared/CashBookReportPreview';
import type { CashFlowRow } from '@/app/services/cashFlowReportService';
import type { CashFlowSummary } from '@/app/lib/cashFlowReportLogic';
import { formatRoznamchaRowDateTimeDisplay } from '@/app/utils/transactionEventDateTime';

export const CASH_FLOW_PRINT_COLUMNS: CashBookReportColumn[] = [
  { key: 'date', label: 'Date' },
  { key: 'reference', label: 'Reference' },
  { key: 'party', label: 'Party' },
  { key: 'account', label: 'Cash/bank' },
  { key: 'in', label: 'In', align: 'right' },
  { key: 'out', label: 'Out', align: 'right' },
  { key: 'balance', label: 'Running balance', align: 'right' },
  { key: 'source', label: 'Source' },
  { key: 'branch', label: 'Branch' },
];

export function buildCashFlowPrintRows(rows: CashFlowRow[]): (string | number)[][] {
  return rows.map((r) => {
    const refLine = r.journalEntryNo ? `${r.reference} (${r.journalEntryNo})` : r.reference;
    return [
      formatRoznamchaRowDateTimeDisplay(r.date, r.time || ''),
      refLine,
      r.party || '—',
      r.cashAccount,
      r.cashIn > 0 ? r.cashIn : '',
      r.cashOut > 0 ? r.cashOut : '',
      r.runningBalance,
      r.sourceModuleLabel,
      r.branchName || '—',
    ];
  });
}

export function buildCashFlowSummaryStats(
  summary: CashFlowSummary,
  formatCurrency: (n: number) => string,
): { label: string; value: string }[] {
  return [
    { label: 'Opening', value: formatCurrency(summary.opening) },
    { label: 'Cash In', value: formatCurrency(summary.cashIn) },
    { label: 'Cash Out', value: formatCurrency(summary.cashOut) },
    { label: 'Closing', value: formatCurrency(summary.closing) },
  ];
}
