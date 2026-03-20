/**
 * Central posting rules: only posted documents may touch GL, stock, payment JEs, AR/AP as operational truth.
 * Draft / quotation / order (sales) and draft / ordered (purchases) = business data only.
 */

import {
  PURCHASE_POSTED_ACCOUNTING_STATUSES,
  SALE_POSTED_ACCOUNTING_STATUS,
} from '@/app/lib/documentStatusConstants';

export function normalizeDocStatus(status: unknown): string {
  return String(status ?? '')
    .trim()
    .toLowerCase();
}

/** Sale: only `final` is posted for revenue/AR/COGS/stock. */
export function canPostAccountingForSaleStatus(status: unknown): boolean {
  return normalizeDocStatus(status) === SALE_POSTED_ACCOUNTING_STATUS;
}

export function canPostStockForSaleStatus(status: unknown): boolean {
  return normalizeDocStatus(status) === SALE_POSTED_ACCOUNTING_STATUS;
}

/** Map app purchase status (`completed` ≡ DB `final`) before posting checks. */
export function normalizePurchaseStatusForPosting(status: unknown): string {
  const s = normalizeDocStatus(status);
  if (s === 'completed') return 'final';
  return s;
}

/**
 * Purchase: `final` and `received` are treated as posted for inventory/AP in this ERP.
 * App label `completed` is treated as `final`. Draft / ordered — no GL or stock posting.
 */
export function canPostAccountingForPurchaseStatus(status: unknown): boolean {
  const s = normalizePurchaseStatusForPosting(status);
  return (PURCHASE_POSTED_ACCOUNTING_STATUSES as readonly string[]).includes(s);
}

export function canPostStockForPurchaseStatus(status: unknown): boolean {
  return canPostAccountingForPurchaseStatus(status);
}

/** Reversal / cancel accounting & stock: sale must have been posted (final). */
export function wasSalePostedForReversal(status: unknown): boolean {
  return canPostAccountingForSaleStatus(status);
}

/** Reversal / cancel: purchase must have been posted (final or received). */
export function wasPurchasePostedForReversal(status: unknown): boolean {
  return canPostAccountingForPurchaseStatus(status);
}

// ---------------------------------------------------------------------------
// Hard gate: invoice / PO series must match lifecycle (defense vs status bugs)
// ---------------------------------------------------------------------------

/** Non–posted sale number series — must never receive canonical document / COGS JEs. */
const SALE_NON_POSTED_INVOICE_PREFIX = /^(DRAFT-|QT-|SO-|SDR-|SQT-|SOR-)/i;

/** Non–posted purchase PO series — canonical document JE only for PUR-* when posted. */
const PURCHASE_NON_POSTED_PO_PREFIX = /^(PDR-|POR-)/i;

export function saleInvoiceNoReservedForNonPostedLifecycle(invoiceNo: unknown): boolean {
  const s = String(invoiceNo ?? '').trim();
  if (!s) return false;
  return SALE_NON_POSTED_INVOICE_PREFIX.test(s);
}

export function purchasePoNoReservedForNonPostedLifecycle(poNo: unknown): boolean {
  const s = String(poNo ?? '').trim();
  if (!s) return false;
  return PURCHASE_NON_POSTED_PO_PREFIX.test(s);
}

/**
 * Posted sale may receive canonical document JE only if invoice is not a draft/quotation/order series.
 * (Fixes: DB status=final while invoice_no still DRAFT-0002 → no JE until renumbered.)
 */
export function saleInvoiceNoAllowsCanonicalDocumentJe(invoiceNo: unknown): boolean {
  return !saleInvoiceNoReservedForNonPostedLifecycle(invoiceNo);
}

/** Posted purchase (final/received): canonical document JE only when PO uses PUR- series, not PDR/POR. */
export function purchasePoNoAllowsCanonicalDocumentJe(poNo: unknown): boolean {
  return !purchasePoNoReservedForNonPostedLifecycle(poNo);
}
