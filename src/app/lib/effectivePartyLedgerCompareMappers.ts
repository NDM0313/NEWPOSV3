/**
 * Effective party ledger row compare mappers (Phase 2.7 preview).
 */

import { round2 } from '@/app/lib/unifiedLedgerCompareDiff';
import type { CompareRowSummary } from '@/app/lib/unifiedLedgerCompareTypes';
import type { EffectiveLedgerRow } from '@/app/services/effectivePartyLedgerService';

export function effectivePartyRowKey(r: EffectiveLedgerRow): string {
  return r.id;
}

export function effectivePartyToCompareSummary(r: EffectiveLedgerRow): CompareRowSummary {
  return {
    journalEntryId: r.paymentId || r.sourceDocumentId || r.id,
    entryNo: r.referenceNo || null,
    entryDate: r.date,
    referenceType: r.type || null,
    debit: round2(r.debit || 0),
    credit: round2(r.credit || 0),
    description: r.description || r.typeLabel || '—',
  };
}
