/**
 * Purchase `status` values that exist in the DB schema (see `Purchase` in purchaseService).
 * Do NOT use UI-only labels like `completed` in PostgREST `.in('status', …)` — that causes 400.
 */
export const PURCHASE_STATUSES_FOR_PAYABLE_RECONCILIATION = ['final', 'received'] as const;

/**
 * Header-only columns for purchase by-id fetch (no embeds). Use when embedded `getPurchase` fails
 * (PGRST / relation errors) or to avoid `select=*` issues on some proxies.
 */
export const PURCHASE_HEADER_COLUMNS = `
  id,
  company_id,
  branch_id,
  po_no,
  po_date,
  supplier_id,
  supplier_name,
  status,
  payment_status,
  subtotal,
  discount_amount,
  tax_amount,
  shipping_cost,
  total,
  paid_amount,
  due_amount,
  notes,
  attachments,
  created_by,
  created_at,
  updated_at
`.replace(/\s+/g, ' ').trim();
