/**
 * Human-facing GL / document labels for diagnostics and reconciliation UIs.
 * Technical UUIDs remain in technicalRef; posting logic must not depend on these strings.
 */

import { getPurchaseDisplayNumber, getSaleDisplayNumber } from '@/app/lib/documentDisplayNumbers';

export interface AccountingUiRef {
  /** Primary visible label (SL-…, PUR-…, stage/production, payment ref, expense_no, or fallback) */
  displayRef: string;
  /** Secondary: reference_type:reference_id (or journal id if missing) */
  technicalRef: string;
  /** Short module/source label for badges */
  sourceLabel: string;
  /** Entry number from journal (JE-…), if any */
  entryNoBadge: string | null;
  /** True when a source document row was found for this reference */
  documentResolved: boolean;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function buildTechnicalRef(
  referenceType: string | null | undefined,
  referenceId: string | null | undefined,
  journalEntryId: string
): string {
  const t = (referenceType || '').trim() || 'journal';
  const id = (referenceId || '').trim();
  if (id) return `${t}:${id}`;
  return `${t}:${journalEntryId}`;
}

/** Badge for journal column — prefer stored entry_no */
export function formatJournalEntryBadge(entryNo: string | null | undefined, journalEntryId: string): string {
  const e = (entryNo || '').trim();
  if (e) return e;
  return `JE·${journalEntryId.slice(0, 8)}`;
}

export function sourceLabelFromReferenceType(referenceType: string | null | undefined): string {
  const rt = (referenceType || '').toLowerCase().trim();
  if (!rt || rt === 'journal') return 'Journal';
  if (rt === 'sale' || rt === 'sale_extra_expense') return 'Sale';
  if (rt === 'purchase') return 'Purchase';
  if (rt === 'studio_production_stage') return 'Studio / Stage';
  if (rt === 'worker_payment') return 'Studio / Worker';
  if (rt === 'worker_advance_settlement') return 'Studio / Worker';
  if (rt === 'manual_receipt') return 'Customer receipt';
  if (rt === 'manual_payment') return 'Supplier payment';
  if (rt === 'opening_balance_inventory') return 'Opening inventory';
  if (rt === 'payment_adjustment' || rt === 'payment') return 'Payment';
  if (rt === 'expense' || rt === 'extra_expense') return 'Expense';
  if (rt.includes('expense')) return 'Expense';
  return rt.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function isLikelyUuid(s: string | null | undefined): boolean {
  return Boolean(s && UUID_RE.test(String(s).trim()));
}

export { getSaleDisplayNumber, getPurchaseDisplayNumber };
