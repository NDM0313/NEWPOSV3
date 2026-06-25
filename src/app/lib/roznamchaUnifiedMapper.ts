/**
 * Map unified cash/bank RPC rows → read-only Roznamcha preview rows (Phase 2.6).
 */

import type { UnifiedLedgerRow } from '@/app/services/unifiedLedgerService';

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
