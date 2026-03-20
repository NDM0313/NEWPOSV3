/**
 * Display-only document numbers for lists and headers.
 * Accounting and posting MUST use postingStatusGate + status from DB only — never infer from prefixes.
 */

import { normalizeDocStatus } from '@/app/lib/postingStatusGate';

/** Main list / header label for a sale row (one row, lifecycle stages). */
export function getSaleDisplayNumber(row: {
  status?: string | null;
  invoice_no?: string | null;
  draft_no?: string | null;
  quotation_no?: string | null;
  order_no?: string | null;
}): string {
  const st = normalizeDocStatus(row.status);
  if (st === 'final' || st === 'cancelled') {
    return String(row.invoice_no ?? '').trim();
  }
  if (st === 'draft') return String(row.draft_no ?? row.invoice_no ?? '').trim();
  if (st === 'quotation') return String(row.quotation_no ?? row.invoice_no ?? '').trim();
  if (st === 'order') return String(row.order_no ?? row.invoice_no ?? '').trim();
  return String(row.invoice_no ?? row.draft_no ?? '').trim();
}

/** Main list / header label for a purchase row. */
export function getPurchaseDisplayNumber(row: {
  status?: string | null;
  po_no?: string | null;
  draft_no?: string | null;
  order_no?: string | null;
}): string {
  const st = normalizeDocStatus(row.status);
  if (st === 'completed') {
    return String(row.po_no ?? '').trim();
  }
  if (st === 'final' || st === 'received' || st === 'cancelled') {
    return String(row.po_no ?? '').trim();
  }
  if (st === 'draft') return String(row.draft_no ?? row.po_no ?? '').trim();
  if (st === 'ordered') return String(row.order_no ?? row.po_no ?? '').trim();
  return String(row.po_no ?? row.draft_no ?? '').trim();
}
