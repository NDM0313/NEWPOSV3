/**
 * Shared unified party ledger compare mappers (Phase 2.2 admin + Phase 2.7 preview).
 */

import type { CompareRowSummary } from '@/app/lib/unifiedLedgerCompareTypes';
import type { UnifiedLedgerRow } from '@/app/services/unifiedLedgerService';
import type { TieOutRowSummary } from '@/app/services/unifiedLedgerTieOutService';

export function unifiedPartyRowKey(r: UnifiedLedgerRow): string {
  return r.journalEntryLineId || r.journalEntryId;
}

export function unifiedPartyToCompareSummary(r: UnifiedLedgerRow): CompareRowSummary {
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

export function unifiedPartyToTieOutSummary(r: UnifiedLedgerRow): TieOutRowSummary {
  return unifiedPartyToCompareSummary(r);
}
