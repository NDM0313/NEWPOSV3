/**
 * Map unified cash/bank RPC rows → RoznamchaResult for main loader (Phase 2.14).
 */

import { liquidityKindMatchesAccount } from '@/app/lib/unifiedLedgerLiquidityAccount';
import type {
  RoznamchaCashSplit,
  RoznamchaResult,
  RoznamchaRowWithBalance,
  RoznamchaSummary,
} from '@/app/services/roznamchaService';
import type { UnifiedLedgerResult, UnifiedLedgerRow } from '@/app/services/unifiedLedgerService';

function inferAccountType(row: UnifiedLedgerRow): 'cash' | 'bank' | 'wallet' | null {
  const acc = { code: row.accountCode, name: row.accountName, type: null };
  if (liquidityKindMatchesAccount('cash', acc)) return 'cash';
  if (liquidityKindMatchesAccount('bank', acc)) return 'bank';
  if (liquidityKindMatchesAccount('wallet', acc)) return 'wallet';
  return null;
}

export function mapUnifiedRowToRoznamchaRow(row: UnifiedLedgerRow): RoznamchaRowWithBalance {
  const cashIn = row.debit;
  const cashOut = row.credit;
  const direction: 'IN' | 'OUT' = cashIn > cashOut || (cashIn > 0 && cashOut === 0) ? 'IN' : 'OUT';
  const amount = Math.max(cashIn, cashOut);
  const accountLabel = row.accountName?.trim() || row.accountCode?.trim() || '—';
  const accountType = inferAccountType(row);

  return {
    id: row.journalEntryLineId || row.journalEntryId,
    date: row.entryDate,
    time: '00:00:00',
    ref: row.entryNo || '—',
    details: row.description || '—',
    referenceDisplay: row.entryNo || '—',
    createdBy: null,
    partyLine: row.partyResolved,
    journalEntryNo: row.entryNo,
    cashIn,
    cashOut,
    direction,
    amount,
    accountType,
    accountLabel,
    accountName: row.accountName,
    paymentAccountId: row.paymentId,
    runningBalance: row.runningBalance,
  };
}

function buildSummary(
  unified: UnifiedLedgerResult,
  rows: RoznamchaRowWithBalance[],
): RoznamchaSummary {
  let cashIn = 0;
  let cashOut = 0;
  for (const row of rows) {
    cashIn += row.cashIn;
    cashOut += row.cashOut;
  }
  return {
    openingBalance: unified.meta.periodOpeningBalance,
    cashIn,
    cashOut,
    closingBalance: unified.closingBalance,
  };
}

function buildCashSplit(rows: RoznamchaRowWithBalance[]): RoznamchaCashSplit {
  let cash = 0;
  let bank = 0;
  let wallet = 0;
  for (const row of rows) {
    const net = row.cashIn - row.cashOut;
    if (row.accountType === 'cash') cash += net;
    else if (row.accountType === 'bank') bank += net;
    else if (row.accountType === 'wallet') wallet += net;
  }
  return { cash, bank, wallet, total: cash + bank + wallet };
}

export function mapUnifiedToRoznamchaResult(args: {
  unified: UnifiedLedgerResult;
  rows: UnifiedLedgerRow[];
}): RoznamchaResult & { unifiedRows: UnifiedLedgerRow[] } {
  const mappedRows = args.rows.map(mapUnifiedRowToRoznamchaRow);
  return {
    rows: mappedRows,
    summary: buildSummary(args.unified, mappedRows),
    cashSplit: buildCashSplit(mappedRows),
    unifiedRows: args.rows,
  };
}
