import type { CashBookReportColumn } from '@/app/components/reports/shared/CashBookReportPreview';
import {
  roznamchaJournalSubtitle,
  roznamchaRefDisplay,
  type RoznamchaRowWithBalance,
} from '@/app/lib/roznamchaRefDisplay';
import type { RoznamchaSummary } from '@/app/services/roznamchaService';
import { formatRoznamchaRowDateTimeDisplay } from '@/app/utils/transactionEventDateTime';
import { journalDescriptionForDisplay } from '@/app/utils/journalDescriptionDisplay';

export const ROZNAMCHA_PRINT_COLUMNS: CashBookReportColumn[] = [
  { key: 'date', label: 'Date & Time' },
  { key: 'ref', label: 'Ref / Journal', mono: true },
  { key: 'details', label: 'Details' },
  { key: 'account', label: 'Account' },
  { key: 'in', label: 'Cash In', align: 'right' },
  { key: 'out', label: 'Cash Out', align: 'right' },
  { key: 'balance', label: 'Balance', align: 'right' },
];

export function buildRoznamchaPrintRows(
  rows: RoznamchaRowWithBalance[],
  detailsForDisplay: (r: RoznamchaRowWithBalance) => string,
): (string | number)[][] {
  return rows.map((r) => {
    const meta = [r.referenceDisplay, r.partyLine, r.createdBy ? `by ${r.createdBy}` : '']
      .filter(Boolean)
      .join(' • ');
    const jeSub = roznamchaJournalSubtitle(r);
    const refCol = jeSub ? `${roznamchaRefDisplay(r)} / ${jeSub}` : roznamchaRefDisplay(r);
    const details = meta
      ? `${detailsForDisplay(r)} — ${meta}`
      : detailsForDisplay(r);
    return [
      r.date ? formatRoznamchaRowDateTimeDisplay(r.date, r.time || '') : '—',
      refCol,
      details,
      (r.accountName ?? r.accountLabel) || '—',
      r.cashIn > 0 ? r.cashIn : '',
      r.cashOut > 0 ? r.cashOut : '',
      r.runningBalance,
    ];
  });
}

export function buildRoznamchaSummaryStats(
  summary: RoznamchaSummary,
  formatCurrency: (n: number) => string,
): { label: string; value: string }[] {
  return [
    { label: 'Opening', value: formatCurrency(summary.openingBalance) },
    { label: 'Cash In', value: formatCurrency(summary.cashIn) },
    { label: 'Cash Out', value: formatCurrency(summary.cashOut) },
    { label: 'Closing', value: formatCurrency(summary.closingBalance) },
  ];
}

export function roznamchaDetailsForDisplay(r: RoznamchaRowWithBalance): string {
  return journalDescriptionForDisplay(r.details, r.type || 'Payment');
}
