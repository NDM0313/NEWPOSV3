/**
 * Shared roznamcha ↔ unified cash/bank compare mappers (Phase 2.2 admin + Phase 2.6 preview).
 */

import { diffLedgerRows, round2 } from '@/app/lib/unifiedLedgerCompareDiff';
import type { CompareRowSummary } from '@/app/lib/unifiedLedgerCompareTypes';
import type { RoznamchaRowWithBalance } from '@/app/services/roznamchaService';
import type { UnifiedLedgerRow } from '@/app/services/unifiedLedgerService';

/** Ref + date + liquidity magnitude — roznamcha and unified often link different JE ids for same receipt. */
export function cashBankEconomicRowKey(
  entryNo: string | null | undefined,
  entryDate: string,
  debit: number,
  credit: number
): string {
  const ref = String(entryNo || '').trim().toUpperCase();
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
