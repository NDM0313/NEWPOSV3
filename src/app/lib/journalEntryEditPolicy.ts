import type { AccountingEntry } from '@/app/context/AccountingContext';

/** JE reference types that must not use the generic accounting “unified edit” shortcut — edit from source module. */
const BLOCKED_WITHOUT_PAYMENT_LINK = new Set([
  'sale',
  'purchase',
  'rental',
  'sale_adjustment',
  'purchase_adjustment',
  'opening_balance_inventory',
  'opening_balance_contact_ar',
  'opening_balance_contact_ap',
  'opening_balance_contact_worker',
  'opening_balance_account',
  'stock_adjustment',
]);

/**
 * Generic Journal Entries / Day Book: allow opening the unified payment / manual journal / expense editor.
 * Rows linked to `payment_id` are treated as settlement (receipt/pay) even when `reference_type` is sale/purchase.
 */
export function allowsGenericAccountingUnifiedEdit(entry: AccountingEntry): boolean {
  const meta = entry.metadata;
  const rt = String(meta?.referenceType || '').toLowerCase().trim();
  if (rt === 'correction_reversal') return false;
  if (meta?.paymentId) return true;
  if (!rt) return true;
  if (BLOCKED_WITHOUT_PAYMENT_LINK.has(rt)) return false;
  return true;
}

export type SourceDocumentOpenTarget =
  | { kind: 'sale'; id: string }
  | { kind: 'purchase'; id: string }
  | { kind: 'rental'; id: string };

/** When unified edit is blocked, optional “open source document” target from metadata. */
export function getJournalEntrySourceDocumentOpenTarget(entry: AccountingEntry): SourceDocumentOpenTarget | null {
  const meta = entry.metadata;
  const rt = String(meta?.referenceType || '').toLowerCase().trim();
  const rid = meta?.referenceId ? String(meta.referenceId).trim() : '';
  if (!rid || meta?.paymentId) return null;

  if (rt === 'sale' || rt === 'sale_adjustment') return { kind: 'sale', id: rid };
  if (rt === 'purchase' || rt === 'purchase_adjustment') return { kind: 'purchase', id: rid };
  if (rt === 'rental') return { kind: 'rental', id: rid };
  return null;
}

/** Day Book row: same rules using raw `journal_entries` fields. */
export function allowsDayBookUnifiedEdit(
  referenceType: string | null | undefined,
  paymentId: string | null | undefined
): boolean {
  if (paymentId && String(paymentId).trim()) return true;
  const rt = String(referenceType || '').toLowerCase().trim();
  if (rt === 'correction_reversal') return false;
  if (!rt) return true;
  if (BLOCKED_WITHOUT_PAYMENT_LINK.has(rt)) return false;
  return true;
}
