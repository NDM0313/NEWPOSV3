/**
 * Purchase `status` values that exist in the DB schema (see `Purchase` in purchaseService).
 * Do NOT use UI-only labels like `completed` in PostgREST `.in('status', …)` — that causes 400.
 */
export { PURCHASE_STATUSES_FOR_PAYABLE_RECONCILIATION } from '@/app/lib/documentStatusConstants';

/**
 * Header-only columns for purchase by-id fetch and PATCH return (no embeds).
 *
 * **Do not include `attachments` here** — some DBs never ran
 * `27_purchase_sale_attachments_storage.sql`; PostgREST returns **400** if `select=` lists a
 * non-existent column. Fetch `attachments` in a separate optional query when needed.
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
  created_by,
  created_at,
  updated_at
`.replace(/\s+/g, ' ').trim();
