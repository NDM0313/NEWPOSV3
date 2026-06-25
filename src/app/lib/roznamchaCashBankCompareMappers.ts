/**
 * Shared roznamcha ↔ unified cash/bank compare mappers (Phase 2.2 admin + Phase 2.6 preview).
 */

import { diffLedgerRows, round2, balancePasses } from '@/app/lib/unifiedLedgerCompareDiff';
import type { CompareRowSummary } from '@/app/lib/unifiedLedgerCompareTypes';
import type { RoznamchaRowWithBalance } from '@/app/services/roznamchaService';
import type { UnifiedLedgerRow } from '@/app/services/unifiedLedgerService';

/** Normalize roznamcha expense refs (EP2026/0009) to unified style (EXP-0009). */
export function normalizeCashBankEntryNo(entryNo: string | null | undefined): string {
  const raw = String(entryNo || '').trim().toUpperCase();
  const expSlash = raw.match(/^EP\d{4}\/(\d+)$/);
  if (expSlash) return `EXP-${expSlash[1].padStart(4, '0')}`;
  return raw;
}

/** Ref + date + liquidity magnitude — roznamcha and unified often link different JE ids for same receipt. */
export function cashBankEconomicRowKey(
  entryNo: string | null | undefined,
  entryDate: string,
  debit: number,
  credit: number
): string {
  const ref = normalizeCashBankEntryNo(entryNo);
  const date = String(entryDate || '').slice(0, 10);
  const mag = round2(Math.max(Number(debit) || 0, Number(credit) || 0));
  if (ref && date && mag > 0) return `econ:${ref}|${date}|${mag}`;
  return '';
}

export function cashBankAmountsEquivalent(old: CompareRowSummary, neu: CompareRowSummary): boolean {
  const od = round2(old.debit);
  const oc = round2(old.credit);
  const nd = round2(neu.debit);
  const nc = round2(neu.credit);
  if (od === nd && oc === nc) return true;
  // Internal transfer: roznamcha cash-in vs unified liquidity line on opposite Dr/Cr.
  if (od === nc && oc === nd) return true;
  return false;
}

export function roznamchaRowKey(r: RoznamchaRowWithBalance): string {
  const debit = round2(r.cashIn || 0);
  const credit = round2(r.cashOut || 0);
  const economic = cashBankEconomicRowKey(r.ref, r.date, debit, credit);
  if (economic) return economic;
  const jeId = String(r.sourceJournalEntryId || '').trim();
  if (jeId) return jeId;
  return r.id;
}

export function roznamchaToCompareSummary(r: RoznamchaRowWithBalance): CompareRowSummary {
  const debit = round2(r.cashIn || 0);
  const credit = round2(r.cashOut || 0);
  return {
    journalEntryId: r.sourceJournalEntryId || r.id,
    entryNo: r.ref || null,
    entryDate: r.date,
    referenceType: r.type || null,
    debit,
    credit,
    description: r.details || r.referenceDisplay || '—',
  };
}

export function unifiedCashBankRowKey(r: UnifiedLedgerRow): string {
  const economic = cashBankEconomicRowKey(r.entryNo, r.entryDate, r.debit, r.credit);
  if (economic) return economic;
  const jeId = String(r.journalEntryId || '').trim();
  if (jeId) return jeId;
  return r.journalEntryLineId || '';
}

export function unifiedCashBankToCompareSummary(r: UnifiedLedgerRow): CompareRowSummary {
  return {
    journalEntryId: r.journalEntryId,
    entryNo: r.entryNo,
    entryDate: r.entryDate,
    referenceType: r.referenceType,
    debit: r.debit,
    credit: r.credit,
    description: r.description,
  };
}

export function diffCashBankLedgerRows(args: {
  oldRows: RoznamchaRowWithBalance[];
  newRows: UnifiedLedgerRow[];
}) {
  return diffLedgerRows({
    oldRows: args.oldRows,
    newRows: args.newRows,
    oldKey: roznamchaRowKey,
    newKey: unifiedCashBankRowKey,
    oldToSummary: roznamchaToCompareSummary,
    newToSummary: unifiedCashBankToCompareSummary,
    amountsMatch: cashBankAmountsEquivalent,
  });
}

/** Compare-only: roznamcha omits some manual_receipt GL legs that unified RPC includes. */
export function unifiedRowToRoznamchaSupplement(r: UnifiedLedgerRow): RoznamchaRowWithBalance {
  const cashIn = round2(r.debit || 0);
  const cashOut = round2(r.credit || 0);
  return {
    id: `jel-${r.journalEntryLineId || r.journalEntryId}`,
    date: r.entryDate,
    ref: r.entryNo || '',
    details: r.description,
    referenceDisplay: '',
    partyLine: null,
    journalEntryNo: r.entryNo,
    createdBy: null,
    cashIn,
    cashOut,
    direction: cashIn > 0 ? 'IN' : 'OUT',
    amount: Math.max(cashIn, cashOut),
    accountType: 'cash',
    accountLabel: r.accountName || '',
    accountName: r.accountName || null,
    paymentAccountId: null,
    sourceJournalEntryId: r.journalEntryId,
    branchId: null,
    type: r.referenceType || 'manual_receipt',
    runningBalance: r.runningBalance,
  };
}

export function supplementRoznamchaForCashBankCompare(
  legacyRows: RoznamchaRowWithBalance[],
  unifiedRows: UnifiedLedgerRow[]
): RoznamchaRowWithBalance[] {
  const legacyKeys = new Set(legacyRows.map((r) => roznamchaRowKey(r)));
  const additions: RoznamchaRowWithBalance[] = [];
  for (const row of unifiedRows) {
    const key = unifiedCashBankRowKey(row);
    if (!key || legacyKeys.has(key)) continue;
    if (String(row.referenceType || '').toLowerCase() !== 'manual_receipt') continue;
    additions.push(unifiedRowToRoznamchaSupplement(row));
    legacyKeys.add(key);
  }
  return additions.length ? [...legacyRows, ...additions] : legacyRows;
}

export function cashBankCompareClosingFromOpening(
  opening: number,
  rows: Array<{ cashIn?: number; cashOut?: number; debit?: number; credit?: number }>
): number {
  let balance = round2(opening);
  for (const row of rows) {
    const cashIn = round2(Number(row.cashIn ?? row.debit) || 0);
    const cashOut = round2(Number(row.cashOut ?? row.credit) || 0);
    balance = round2(balance + cashIn - cashOut);
  }
  return balance;
}

export function cashBankPeriodNetMovement(
  rows: Array<{ cashIn?: number; cashOut?: number; debit?: number; credit?: number }>
): number {
  return cashBankCompareClosingFromOpening(0, rows);
}

export function evaluateCashBankComparePass(args: {
  legacyRows: RoznamchaRowWithBalance[];
  unifiedRows: UnifiedLedgerRow[];
  legacyClosing: number;
  unifiedClosing: number;
}): {
  supplementedLegacyRows: RoznamchaRowWithBalance[];
  missingInNew: ReturnType<typeof diffCashBankLedgerRows>['missingInNew'];
  extraInNew: ReturnType<typeof diffCashBankLedgerRows>['extraInNew'];
  amountMismatches: ReturnType<typeof diffCashBankLedgerRows>['amountMismatches'];
  oldBalance: number;
  newBalance: number;
  difference: number;
  pass: boolean;
  rowParityPass: boolean;
  periodMovementPass: boolean;
  manualReceiptSupplementCount: number;
} {
  const supplementedLegacyRows = supplementRoznamchaForCashBankCompare(
    args.legacyRows,
    args.unifiedRows
  );
  const manualReceiptSupplementCount = supplementedLegacyRows.length - args.legacyRows.length;
  const rowDiff = diffCashBankLedgerRows({
    oldRows: supplementedLegacyRows,
    newRows: args.unifiedRows,
  });
  const rowParityPass =
    rowDiff.missingInNew.length === 0 &&
    rowDiff.extraInNew.length === 0 &&
    rowDiff.amountMismatches.length === 0;
  const periodMovementPass = balancePasses(
    cashBankPeriodNetMovement(supplementedLegacyRows) - cashBankPeriodNetMovement(args.unifiedRows)
  );
  const oldBalance = round2(args.legacyClosing);
  const newBalance = round2(args.unifiedClosing);
  const difference = round2(oldBalance - newBalance);
  const pass = rowParityPass && periodMovementPass;

  return {
    supplementedLegacyRows,
    ...rowDiff,
    oldBalance,
    newBalance,
    difference,
    pass,
    rowParityPass,
    periodMovementPass,
    manualReceiptSupplementCount,
  };
}
