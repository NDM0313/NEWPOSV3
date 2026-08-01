/**
 * Build a minimal AccountingEntry so Ledger V2 rows can reuse
 * getJournalEntrySourceDocumentOpenTarget / openJournalSourceDocumentFromEntry.
 */

import type { AccountingEntry } from '@/app/context/AccountingContext';
import type { LedgerStatementV2Row } from '@/app/features/ledger-statement-center-v2/types';
import { getJournalEntrySourceDocumentOpenTarget } from '@/app/lib/journalEntryEditPolicy';

function normalizeRef(t: string): string {
  return String(t || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_');
}

/** Synthetic entry for source-document open (metadata only is used). */
export function buildLedgerRowSourceDocumentEntry(row: LedgerStatementV2Row): AccountingEntry {
  const gl = row.glEntry;
  let referenceType = normalizeRef(String(gl?.je_reference_type || ''));
  let referenceId = gl?.je_reference_id ? String(gl.je_reference_id).trim() : '';

  if (!referenceId && gl?.sale_id) {
    if (!referenceType || referenceType.includes('sale')) {
      referenceType = referenceType || 'sale';
      referenceId = String(gl.sale_id);
    }
  }
  if (!referenceId && gl?.rental_id) {
    referenceType = referenceType || 'rental';
    referenceId = String(gl.rental_id);
  }

  if (!referenceId && row.sourceId && !row.paymentId) {
    if (row.sourceKind === 'sale') {
      referenceType = referenceType || 'sale';
      referenceId = String(row.sourceId);
    } else if (row.sourceKind === 'purchase') {
      referenceType = referenceType || 'purchase';
      referenceId = String(row.sourceId);
    } else if (row.sourceKind === 'rental') {
      referenceType = referenceType || 'rental';
      referenceId = String(row.sourceId);
    } else if (row.sourceKind === 'return') {
      const tt = normalizeRef(row.transactionType);
      if (!referenceType) {
        if (tt.includes('purchase')) referenceType = 'purchase_return';
        else referenceType = 'sale_return';
      }
      referenceId = String(row.sourceId);
    }
  }

  // Unified rows may only have transactionType / sourceKind without a doc id on the row.
  if (!referenceType && row.transactionType) {
    const tt = normalizeRef(row.transactionType);
    if (tt === 'sale' || tt === 'sale_adjustment') referenceType = tt;
    else if (tt === 'purchase' || tt === 'purchase_adjustment') referenceType = tt;
    else if (tt === 'sale_return' || tt === 'purchase_return' || tt === 'rental') referenceType = tt;
  }

  return {
    id: String(row.journalEntryId || row.id),
    date: row.date ? new Date(row.date) : new Date(),
    source: 'Manual',
    referenceNo: row.referenceNo || '',
    debitAccount: 'Cash',
    creditAccount: 'Cash',
    amount: 0,
    description: row.description || '',
    createdBy: '',
    module: '',
    metadata: {
      referenceType: referenceType || undefined,
      referenceId: referenceId || undefined,
      paymentId: row.paymentId || gl?.payment_id || undefined,
      journalEntryId: row.journalEntryId,
    },
  } as AccountingEntry;
}

export function ledgerRowHasOpenableSourceDocument(row: LedgerStatementV2Row): boolean {
  if (row.id === 'opening-balance') return false;
  const entry = buildLedgerRowSourceDocumentEntry(row);
  return getJournalEntrySourceDocumentOpenTarget(entry) != null;
}
