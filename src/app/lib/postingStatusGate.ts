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
