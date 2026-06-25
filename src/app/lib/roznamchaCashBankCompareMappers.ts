/**
 * Shared roznamcha ↔ unified cash/bank compare mappers (Phase 2.2 admin + Phase 2.6 preview).
 */

import { round2 } from '@/app/lib/unifiedLedgerCompareDiff';
import type { CompareRowSummary } from '@/app/lib/unifiedLedgerCompareTypes';
import type { RoznamchaRowWithBalance } from '@/app/services/roznamchaService';
import type { UnifiedLedgerRow } from '@/app/services/unifiedLedgerService';

export function roznamchaRowKey(r: RoznamchaRowWithBalance): string {
  // Roznamcha entity ids (pay:…) never match unified journal line ids; JE id aligns both sides.
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
  // Cash/bank roznamcha rows are JE-scoped; line id would not match roznamcha entity id.
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
