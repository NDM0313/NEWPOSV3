import type { AccountingEntry } from '@/app/context/AccountingContext';
import { inferTransactionKind, type JournalTransactionLike } from '@/app/lib/unifiedTransactionEdit';

/**
 * Reference types whose amounts/lines are driven by source documents or system postings.
 * Journal Entries / Day Book must not offer generic Edit, Reverse, or unified amount editors for these
 * unless the row is clearly a payment-settlement line (see allowsGenericAccountingUnifiedEdit / journalReversalBlockedReason).
 */
export const SOURCE_CONTROLLED_REFERENCE_TYPES = new Set([
  'sale',
  'purchase',
  'rental',
  'sale_return',
  'purchase_return',
  'sale_adjustment',
  'purchase_adjustment',
  'opening_balance_inventory',
  'opening_balance_contact_ar',
  'opening_balance_contact_ap',
  'opening_balance_contact_worker',
  'opening_balance_account',
  'stock_adjustment',
]);

/** Legacy name: types that block generic unified edit when not linked to a payment row. */
const BLOCKED_WITHOUT_PAYMENT_LINK = SOURCE_CONTROLLED_REFERENCE_TYPES;

/**
 * Generic Journal Entries / Day Book: allow opening the unified payment / manual journal / expense editor.
 * Rows linked to `payment_id` are treated as settlement (receipt/pay) even when `reference_type` is sale/purchase.
 * Document-root sale/purchase/rental **without** payment_id stays blocked.
 */
export function allowsGenericAccountingUnifiedEdit(entry: AccountingEntry): boolean {
  const meta = entry.metadata;
  if (meta?.hasActiveCorrectionReversal === true) return false;
  const rt = String(meta?.referenceType || '').toLowerCase().trim();
  if (rt === 'correction_reversal') return false;
  if (meta?.paymentChainIsHistorical) return false;
  if (meta?.paymentId) return true;
  if (!rt) return true;
  if (BLOCKED_WITHOUT_PAYMENT_LINK.has(rt)) return false;
  return true;
}

export type SourceDocumentOpenTarget =
  | { kind: 'sale'; id: string }
  | { kind: 'purchase'; id: string }
  | { kind: 'rental'; id: string }
  | { kind: 'sale_return'; id: string }
  | { kind: 'purchase_return'; id: string };

/** When unified edit is blocked, optional “open source document” target from metadata. */
export function getJournalEntrySourceDocumentOpenTarget(entry: AccountingEntry): SourceDocumentOpenTarget | null {
  const meta = entry.metadata;
  const rt = String(meta?.referenceType || '').toLowerCase().trim();
  const rid = meta?.referenceId ? String(meta.referenceId).trim() : '';
  if (!rid || meta?.paymentId) return null;

  if (rt === 'sale_return') return { kind: 'sale_return', id: rid };
  if (rt === 'purchase_return') return { kind: 'purchase_return', id: rid };
  if (rt === 'sale' || rt === 'sale_adjustment') return { kind: 'sale', id: rid };
  if (rt === 'purchase' || rt === 'purchase_adjustment') return { kind: 'purchase', id: rid };
  if (rt === 'rental') return { kind: 'rental', id: rid };
  return null;
}

/** Day Book row: same rules using raw `journal_entries` fields. */
export function allowsDayBookUnifiedEdit(
  referenceType: string | null | undefined,
  paymentId: string | null | undefined,
  hasActiveCorrectionReversal?: boolean | null
): boolean {
  if (hasActiveCorrectionReversal === true) return false;
  if (paymentId && String(paymentId).trim()) return true;
  const rt = String(referenceType || '').toLowerCase().trim();
  if (rt === 'correction_reversal') return false;
  if (!rt) return true;
  if (BLOCKED_WITHOUT_PAYMENT_LINK.has(rt)) return false;
  return true;
}

function rowToJournalTransactionLike(row: {
  reference_type?: string | null;
  reference_id?: string | null;
  payment_id?: string | null;
  is_void?: boolean | null;
  payment_chain_is_historical?: boolean | null;
  has_active_correction_reversal?: boolean | null;
}): JournalTransactionLike {
  return {
    reference_type: row.reference_type,
    reference_id: row.reference_id,
    payment_id: row.payment_id,
    is_void: row.is_void,
    payment_chain_is_historical: row.payment_chain_is_historical,
    has_active_correction_reversal: row.has_active_correction_reversal,
  };
}

/**
 * Journal / Transaction detail: block “Reverse” / correction_reversal for source-controlled and document-total rows.
 * Payment-settlement rows (inferTransactionKind === payment) return null = allowed (subject to PF-14 tail rules elsewhere).
 */
export function journalReversalBlockedReason(
  row: {
    reference_type?: string | null;
    reference_id?: string | null;
    payment_id?: string | null;
    is_void?: boolean | null;
    payment_chain_is_historical?: boolean | null;
    /** True when an active `correction_reversal` JE references this header (terminal for edit/reverse from Journal). */
    hasActiveCorrectionReversal?: boolean | null;
  },
  paymentObj: unknown
): string | null {
  if (row.is_void === true) {
    return 'Voided entry — reversal is disabled. View only.';
  }
  if (row.hasActiveCorrectionReversal === true) {
    return 'Already reversed (offsetting correction is posted) — view only. Further changes must follow module workflows or new postings.';
  }
  const rt = String(row.reference_type || '').toLowerCase().trim();
  if (rt === 'correction_reversal') {
    return 'This row is already a correction reversal — not reversible again from Journal Entries.';
  }
  if (row.payment_chain_is_historical === true) {
    return 'Historical payment line — open the latest active row to edit or reverse.';
  }

  const kind = inferTransactionKind(rowToJournalTransactionLike(row), paymentObj);
  /** Payment-settlement rows (incl. sale/purchase JEs linked to payments.id) stay in the payment mutation engine. */
  if (kind === 'payment') {
    return null;
  }

  if (kind === 'document_total') {
    return 'Document-driven posting (invoice, PO, or rental) — manage amounts from Sales, Purchases, or Rentals. Reversal from Journal Entries is not allowed.';
  }

  if (SOURCE_CONTROLLED_REFERENCE_TYPES.has(rt)) {
    if (rt === 'sale_return' || rt === 'purchase_return') {
      return 'Return postings — cancel or void the return from Sales / Purchases Returns, not from Journal Entries.';
    }
    if (rt === 'sale_adjustment' || rt === 'purchase_adjustment') {
      return 'Document adjustment — use the sale or purchase edit flow in its module, not Journal reversal.';
    }
    return 'Source-controlled posting — use the originating module instead of Journal reversal.';
  }

  return null;
}

/** Accounting list row: allow Reverse / Cancel payment actions. */
export function allowsJournalEntryReverse(entry: AccountingEntry, paymentObj?: unknown): boolean {
  const meta = entry.metadata;
  const row = {
    reference_type: meta?.referenceType,
    reference_id: meta?.referenceId,
    payment_id: meta?.paymentId,
    is_void: (meta as { journalEntryVoid?: boolean } | undefined)?.journalEntryVoid,
    payment_chain_is_historical: meta?.paymentChainIsHistorical,
    hasActiveCorrectionReversal: meta?.hasActiveCorrectionReversal,
  };
  return journalReversalBlockedReason(row, paymentObj) === null;
}
