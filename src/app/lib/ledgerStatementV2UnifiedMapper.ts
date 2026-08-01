/**
 * Map unified RPC rows → Ledger Statement V2 row shape for preview compare (Phase 2.3).
 * Preview rows are read-only — no attachment enrichment or drill-down.
 */

import type { LedgerStatementV2Row } from '@/app/features/ledger-statement-center-v2/types';
import type { UnifiedLedgerRow } from '@/app/services/unifiedLedgerService';
import { LEDGER_V2_EMPTY } from '@/app/lib/ledgerStatementV2Enrichment';

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
    paymentMethod: LEDGER_V2_EMPTY,
    createdBy: LEDGER_V2_EMPTY,
    hasAttachments: false,
    sourceKind: mapGlReferenceTypeToSourceKind(refType),
    sourceId: row.paymentId ?? undefined,
    paymentId: row.paymentId ?? undefined,
  };
}

export function mapUnifiedRowsToLedgerV2(rows: UnifiedLedgerRow[]): LedgerStatementV2Row[] {
  return rows.map(mapUnifiedRowToLedgerV2);
}

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** Recompute running balance from period opening + debit/credit deltas (guards RPC ordering gaps). */
export function realignAccountLedgerRunningBalances(
  rows: LedgerStatementV2Row[],
  periodOpening: number,
): LedgerStatementV2Row[] {
  let balance = round2(periodOpening);
  return rows.map((row) => {
    balance = round2(balance + row.debit - row.credit);
    return { ...row, runningBalance: balance };
  });
}
