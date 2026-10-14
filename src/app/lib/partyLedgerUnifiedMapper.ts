/**
 * Map unified party RPC rows → read-only preview rows (Phase 2.7).
 */

import type { UnifiedLedgerRow } from '@/app/services/unifiedLedgerService';

export type PartyLedgerPreviewRow = {
  id: string;
  date: string;
  referenceNo: string;
  description: string;
  type: string;
  debit: number;
  credit: number;
  runningBalance: number;
};

export function mapUnifiedRowToPartyLedgerPreview(row: UnifiedLedgerRow): PartyLedgerPreviewRow {
  return {
    id: row.journalEntryLineId || row.journalEntryId,
    date: row.entryDate,
    referenceNo: row.entryNo || '—',
    description: row.description || '—',
    type: row.referenceType || 'journal',
    debit: row.debit,
    credit: row.credit,
    runningBalance: row.runningBalance,
  };
}

export function mapUnifiedRowsToPartyLedgerPreview(rows: UnifiedLedgerRow[]): PartyLedgerPreviewRow[] {
  return rows.map(mapUnifiedRowToPartyLedgerPreview);
}
