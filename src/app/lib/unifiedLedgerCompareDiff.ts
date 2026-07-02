/**
 * Pure diff helpers for unified ledger admin compare (Phase 2.2).
 */

import type { AccountLedgerEntry } from '@/app/services/accountingService';
import type { UnifiedLedgerRow } from '@/app/services/unifiedLedgerService';
import type { TrialBalanceRow } from '@/app/services/accountingReportsService';
import type { UnifiedTrialBalanceAccount } from '@/app/services/unifiedLedgerService';
import {
  DEFAULT_COMPARE_TOLERANCE,
  type CompareRowMismatch,
  type CompareRowSummary,
  type TrialBalanceAccountDiff,
} from '@/app/lib/unifiedLedgerCompareTypes';

export function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function balancePasses(difference: number, tolerance = DEFAULT_COMPARE_TOLERANCE): boolean {
  return Math.abs(difference) <= tolerance;
}

export function legacyAccountRowKey(e: AccountLedgerEntry): string {
  const lineId = String(e.journal_line_id || (e as { id?: string }).id || '').trim();
  if (lineId) return lineId;
  const jeId = String(e.journal_entry_id || '').trim();
  if (jeId) return jeId;
  return `${e.date}|${e.reference_number}|${round2(Number(e.debit) || 0)}|${round2(Number(e.credit) || 0)}`;
}

/** Party / account legacy rows — prefer journal line id (matches unified RPC line keys). */
export function legacyPartyCompareRowKey(e: AccountLedgerEntry): string {
  return legacyAccountRowKey(e);
}

export function unifiedLedgerRowKey(r: UnifiedLedgerRow): string {
  return r.journalEntryLineId || r.journalEntryId;
}

export function legacyToCompareSummary(e: AccountLedgerEntry): CompareRowSummary {
  const refType =
    (e as { reference_type?: string | null }).reference_type ?? e.je_reference_type ?? null;
  return {
    journalEntryId: String(e.journal_entry_id || ''),
    entryNo: e.entry_no ?? e.reference_number ?? null,
    entryDate: String(e.date || ''),
    referenceType: refType,
    debit: round2(Number(e.debit) || 0),
    credit: round2(Number(e.credit) || 0),
    description: String(e.description || (e as { narration?: string }).narration || '—'),
  };
}

export function unifiedToCompareSummary(r: UnifiedLedgerRow): CompareRowSummary {
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

export function diffLedgerRows<TOld, TNew>(args: {
  oldRows: TOld[];
  newRows: TNew[];
  oldKey: (row: TOld) => string;
  newKey: (row: TNew) => string;
  oldToSummary: (row: TOld) => CompareRowSummary;
  newToSummary: (row: TNew) => CompareRowSummary;
  amountsMatch?: (old: CompareRowSummary, neu: CompareRowSummary) => boolean;
}): {
  missingInNew: CompareRowSummary[];
  extraInNew: CompareRowSummary[];
  amountMismatches: CompareRowMismatch[];
} {
  const oldMap = new Map<string, CompareRowSummary>();
  const newMap = new Map<string, CompareRowSummary>();

  for (const row of args.oldRows) {
    const key = args.oldKey(row);
    if (key) oldMap.set(key, args.oldToSummary(row));
  }
  for (const row of args.newRows) {
    const key = args.newKey(row);
    if (key) newMap.set(key, args.newToSummary(row));
  }

  const missingInNew: CompareRowSummary[] = [];
  const extraInNew: CompareRowSummary[] = [];
  const amountMismatches: CompareRowMismatch[] = [];
  const amountsMatch =
    args.amountsMatch ??
    ((old, neu) =>
      round2(old.debit) === round2(neu.debit) && round2(old.credit) === round2(neu.credit));

  for (const [key, oldSummary] of oldMap) {
    const newSummary = newMap.get(key);
    if (!newSummary) {
      missingInNew.push(oldSummary);
      continue;
    }
    if (!amountsMatch(oldSummary, newSummary)) {
      amountMismatches.push({ key, old: oldSummary, new: newSummary });
    }
  }

  for (const [key, newSummary] of newMap) {
    if (!oldMap.has(key)) extraInNew.push(newSummary);
  }

  return { missingInNew, extraInNew, amountMismatches };
}

export function trialBalanceAccountKey(accountId: string, accountCode?: string | null): string {
  return accountId || String(accountCode || '').trim();
}

export function diffTrialBalanceAccounts(
  oldRows: TrialBalanceRow[],
  newAccounts: UnifiedTrialBalanceAccount[],
  tolerance = DEFAULT_COMPARE_TOLERANCE
): TrialBalanceAccountDiff[] {
  const oldMap = new Map<string, TrialBalanceRow>();
  const newMap = new Map<string, UnifiedTrialBalanceAccount>();

  for (const row of oldRows) {
    const key = trialBalanceAccountKey(row.account_id, row.account_code);
    if ((row.debit || 0) !== 0 || (row.credit || 0) !== 0 || row.balance !== 0) {
      oldMap.set(key, row);
    }
  }
  for (const acc of newAccounts) {
    const key = trialBalanceAccountKey(acc.accountId, acc.accountCode);
    if (acc.totalDebit !== 0 || acc.totalCredit !== 0 || acc.netBalance !== 0) {
      newMap.set(key, acc);
    }
  }

  const diffs: TrialBalanceAccountDiff[] = [];

  for (const [key, oldRow] of oldMap) {
    const newAcc = newMap.get(key);
    const oldNet = round2(oldRow.balance);
    if (!newAcc) {
      diffs.push({
        accountId: oldRow.account_id,
        accountCode: oldRow.account_code,
        accountName: oldRow.account_name,
        oldNetBalance: oldNet,
        newNetBalance: 0,
        difference: oldNet,
        kind: 'missing_in_new',
      });
      continue;
    }
    const newNet = round2(newAcc.netBalance);
    const diff = round2(oldNet - newNet);
    if (!balancePasses(diff, tolerance)) {
      diffs.push({
        accountId: oldRow.account_id,
        accountCode: oldRow.account_code || newAcc.accountCode || '',
        accountName: oldRow.account_name || newAcc.accountName || '',
        oldNetBalance: oldNet,
        newNetBalance: newNet,
        difference: diff,
        kind: 'net_mismatch',
      });
    }
  }

  for (const [key, newAcc] of newMap) {
    if (!oldMap.has(key)) {
      diffs.push({
        accountId: newAcc.accountId,
        accountCode: newAcc.accountCode || '',
        accountName: newAcc.accountName || '',
        oldNetBalance: 0,
        newNetBalance: round2(newAcc.netBalance),
        difference: round2(-newAcc.netBalance),
        kind: 'extra_in_new',
      });
    }
  }

  return diffs;
}

export function compareTrialBalancePayloads(args: {
  oldRows: Array<{
    account_id: string;
    account_code: string;
    account_name: string;
    balance: number;
    debit: number;
    credit: number;
  }>;
  newAccounts: Array<{
    accountId: string;
    accountCode: string | null;
    accountName: string | null;
    netBalance: number;
    totalDebit: number;
    totalCredit: number;
  }>;
  oldTotals: { totalDebit: number; totalCredit: number; difference: number };
  newTotals: { totalDebit: number; totalCredit: number; difference: number };
}): { accountDiffCount: number; totalsPass: boolean } {
  const accountDiffs = diffTrialBalanceAccounts(
    args.oldRows.map((r) => ({
      account_id: r.account_id,
      account_code: r.account_code,
      account_name: r.account_name,
      account_type: 'asset',
      debit: r.debit,
      credit: r.credit,
      balance: r.balance,
    })),
    args.newAccounts.map((a) => ({
      accountId: a.accountId,
      accountCode: a.accountCode,
      accountName: a.accountName,
      accountType: 'asset',
      totalDebit: a.totalDebit,
      totalCredit: a.totalCredit,
      netBalance: a.netBalance,
    }))
  );
  const totalsPass =
    balancePasses(round2(args.oldTotals.difference - args.newTotals.difference)) &&
    balancePasses(round2(args.oldTotals.totalDebit - args.newTotals.totalDebit)) &&
    balancePasses(round2(args.oldTotals.totalCredit - args.newTotals.totalCredit));
  return { accountDiffCount: accountDiffs.length, totalsPass };
}

export function closingBalanceFromLegacyRows(rows: AccountLedgerEntry[]): number {
  if (!rows.length) return 0;
  const last = rows[rows.length - 1];
  return round2(Number(last.running_balance ?? (last as { balance?: number }).balance) || 0);
}
