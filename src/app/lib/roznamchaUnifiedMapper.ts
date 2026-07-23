/**
 * Map unified cash/bank RPC rows → full RoznamchaResult for main display (perf path).
 */

import type { UnifiedLedgerRow } from '@/app/services/unifiedLedgerService';
import type {
  AccountFilter,
  RoznamchaCashSplit,
  RoznamchaResult,
  RoznamchaRow,
  RoznamchaRowWithBalance,
  RoznamchaSummary,
} from '@/app/services/roznamchaService';

export type RoznamchaPreviewRow = {
  id: string;
  date: string;
  ref: string;
  details: string;
  type: string;
  accountLabel: string;
  cashIn: number;
  cashOut: number;
  runningBalance: number;
};

function inferAccountType(row: UnifiedLedgerRow): 'cash' | 'bank' | 'wallet' | null {
  const blob = `${row.accountCode || ''} ${row.accountName || ''}`.toLowerCase();
  if (blob.includes('wallet') || blob.includes('jazz') || blob.includes('easypais')) return 'wallet';
  if (blob.includes('bank') || blob.includes('hbl') || blob.includes('ubl')) return 'bank';
  if (blob.includes('cash')) return 'cash';
  return 'cash';
}

export function mapUnifiedRowToRoznamchaPreview(row: UnifiedLedgerRow): RoznamchaPreviewRow {
  const accountLabel = row.accountName?.trim() || row.accountCode?.trim() || '—';
  return {
    id: row.journalEntryLineId || row.journalEntryId,
    date: row.entryDate,
    ref: row.entryNo || '—',
    details: row.description || '—',
    type: row.referenceType || 'journal',
    accountLabel,
    cashIn: row.debit,
    cashOut: row.credit,
    runningBalance: row.runningBalance,
  };
}

export function mapUnifiedRowsToRoznamchaPreview(rows: UnifiedLedgerRow[]): RoznamchaPreviewRow[] {
  return rows.map(mapUnifiedRowToRoznamchaPreview);
}

function mapUnifiedRowToRoznamchaRow(row: UnifiedLedgerRow): RoznamchaRow {
  const cashIn = Number(row.debit) || 0;
  const cashOut = Number(row.credit) || 0;
  const direction: 'IN' | 'OUT' = cashIn >= cashOut ? 'IN' : 'OUT';
  const amount = direction === 'IN' ? cashIn : cashOut;
  const accountType = inferAccountType(row);
  const accountLabel = row.accountName?.trim() || row.accountCode?.trim() || '—';
  return {
    id: row.journalEntryLineId || row.journalEntryId,
    date: (row.entryDate || '').slice(0, 10),
    time: '',
    ref: row.entryNo || '—',
    details: row.description || '—',
    referenceDisplay: row.entryNo || '—',
    createdBy: null,
    partyLine: row.partyResolved || null,
    journalEntryNo: row.entryNo,
    cashIn,
    cashOut,
    direction,
    amount,
    accountType,
    accountLabel,
    accountName: row.accountName,
    paymentAccountId: null,
    sourceJournalEntryId: row.journalEntryId,
    sourcePaymentId: row.paymentId,
    branchId: row.branchId ?? null,
    type: row.referenceType || 'journal',
    referenceType: row.referenceType,
    paymentIdOnJournal: row.paymentId,
  };
}

function buildSummaryFromUnified(
  rows: RoznamchaRow[],
  openingBalance: number,
  preferredRunning?: number[],
): { rowsWithBalance: RoznamchaRowWithBalance[]; summary: RoznamchaSummary; cashSplit: RoznamchaCashSplit } {
  let running = openingBalance;
  const rowsWithBalance = rows.map((r, i) => {
    if (preferredRunning && preferredRunning[i] != null) {
      running = preferredRunning[i]!;
      return { ...r, runningBalance: running };
    }
    if (r.direction === 'IN') running += r.amount;
    else running -= r.amount;
    return { ...r, runningBalance: running };
  });

  const cashIn = rows.reduce((s, r) => s + (r.direction === 'IN' ? r.amount : 0), 0);
  const cashOut = rows.reduce((s, r) => s + (r.direction === 'OUT' ? r.amount : 0), 0);
  const closingBalance = openingBalance + cashIn - cashOut;

  let cash = openingBalance;
  let bank = 0;
  let wallet = 0;
  for (const r of rows) {
    const delta = r.direction === 'IN' ? r.amount : -r.amount;
    if (r.accountType === 'wallet') wallet += delta;
    else if (r.accountType === 'bank') bank += delta;
    else cash += delta;
  }

  return {
    rowsWithBalance,
    summary: { openingBalance, cashIn, cashOut, closingBalance },
    cashSplit: {
      cash: Math.round(cash * 100) / 100,
      bank: Math.round(bank * 100) / 100,
      wallet: Math.round(wallet * 100) / 100,
      total: closingBalance,
    },
  };
}

/** Build main RoznamchaResult from unified cash/bank ledger (single RPC path). */
export function mapUnifiedLedgerToRoznamchaResult(
  rows: UnifiedLedgerRow[],
  openingBalance: number,
  _accountFilter: AccountFilter = 'all',
): RoznamchaResult {
  const mapped = rows.map(mapUnifiedRowToRoznamchaRow);
  const preferredRunning = rows.map((r) => Number(r.runningBalance));
  const built = buildSummaryFromUnified(mapped, openingBalance, preferredRunning);
  return {
    rows: built.rowsWithBalance,
    summary: built.summary,
    cashSplit: built.cashSplit,
  };
}
