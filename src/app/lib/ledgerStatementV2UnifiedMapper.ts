/**
 * Map unified RPC rows → Ledger Statement V2 row shape for preview compare (Phase 2.3).
 * Preview rows are read-only — no attachment enrichment or drill-down.
 */

import type { LedgerStatementV2Row } from '@/app/features/ledger-statement-center-v2/types';
import type { UnifiedLedgerRow } from '@/app/services/unifiedLedgerService';

function normalizeDocType(t: string): string {
  return String(t || '')
    .toLowerCase()
    .replace(/\s+/g, '_');
}

/** Mirrors ledgerStatementCenterV2Service mapGlReferenceType. */
export function mapGlReferenceTypeToSourceKind(
  refType?: string | null
): LedgerStatementV2Row['sourceKind'] {
  const r = normalizeDocType(refType || '');
  if (r.includes('opening')) return 'opening';
  if (r.includes('sale_return') || (r.includes('return') && r.includes('sale'))) return 'return';
  if (r.includes('sale')) return 'sale';
  if (r.includes('purchase_return') || (r.includes('return') && r.includes('purchase'))) return 'return';
  if (r.includes('purchase')) return 'purchase';
  if (r.includes('rental')) return 'rental';
  if (r.includes('expense')) return 'expense';
  if (r.includes('payment')) return 'payment';
  return 'journal';
}

export function mapUnifiedRowToLedgerV2(row: UnifiedLedgerRow): LedgerStatementV2Row {
  const refType = row.referenceType ?? 'journal';
  return {
    id: row.journalEntryLineId || row.journalEntryId,
    journalEntryId: row.journalEntryId,
    date: row.entryDate,
    referenceNo: row.entryNo || '—',
    transactionType: refType,
    description: row.description || '—',
    branch: row.branchName || '—',
    debit: row.debit,
    credit: row.credit,
    runningBalance: row.runningBalance,
    paymentMethod: row.accountName?.trim() || '—',
    createdBy: '—',
    hasAttachments: false,
    sourceKind: mapGlReferenceTypeToSourceKind(refType),
    sourceId: row.paymentId ?? undefined,
  };
}

export function mapUnifiedRowsToLedgerV2(rows: UnifiedLedgerRow[]): LedgerStatementV2Row[] {
  return rows.map(mapUnifiedRowToLedgerV2);
}
