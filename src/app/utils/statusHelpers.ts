/**
 * Centralized status logic for Sales and Purchases.
 * Use these helpers everywhere (list, detail, payment section, return blocks).
 */

// ---------------------------------------------------------------------------
// Effective status types
// ---------------------------------------------------------------------------

export type EffectiveSaleStatus =
  | 'draft'
  | 'quotation'
  | 'order'
  | 'final'
  | 'cancelled'
  | 'returned'
  | 'partially_returned';

export type EffectivePurchaseStatus =
  | 'draft'
  | 'ordered'
  | 'received'
  | 'final'
  | 'cancelled'
  | 'returned'
  | 'partially_returned';

// ---------------------------------------------------------------------------
// Sale: priority 1 cancelled → 2 fully returned → 3 partially returned → 4 raw status
// ---------------------------------------------------------------------------

export interface SaleLike {
  status?: string;
  due?: number;
  hasReturn?: boolean;
  returnCount?: number;
}

export function getEffectiveSaleStatus(sale: SaleLike | null | undefined): EffectiveSaleStatus {
  if (!sale) return 'draft';
  const status = (sale.status || '').toString().toLowerCase();
  const hasReturn = !!(sale.hasReturn || (sale.returnCount && sale.returnCount > 0));
  const due = Number(sale.due ?? 0);

  if (status === 'cancelled') return 'cancelled';
  if (hasReturn && due <= 0) return 'returned';
  if (hasReturn && due > 0) return 'partially_returned';
  if (status === 'draft' || status === 'quotation' || status === 'order' || status === 'final') {
    return status as EffectiveSaleStatus;
  }
  // Unknown status (e.g. completed, closed) -> draft so badge config always exists
  return 'draft';
}

// ---------------------------------------------------------------------------
// Purchase: same priority
// ---------------------------------------------------------------------------

export interface PurchaseLike {
  status?: string;
  due?: number;
  paymentDue?: number;
  hasReturn?: boolean;
  returnCount?: number;
}

export function getEffectivePurchaseStatus(purchase: PurchaseLike | null | undefined): EffectivePurchaseStatus {
  if (!purchase) return 'draft';
  const status = (purchase.status || '').toString().toLowerCase();
  const hasReturn = !!(purchase.hasReturn || (purchase.returnCount && purchase.returnCount > 0));
  const due = Number(purchase.due ?? purchase.paymentDue ?? 0);

  if (status === 'cancelled') return 'cancelled';
  if (hasReturn && due <= 0) return 'returned';
  if (hasReturn && due > 0) return 'partially_returned';
  if (status === 'draft' || status === 'ordered' || status === 'received' || status === 'final' || status === 'completed') {
    return status === 'completed' ? 'final' : (status as EffectivePurchaseStatus);
  }
  // Unknown status -> draft so badge config always exists
  return 'draft';
}

// ---------------------------------------------------------------------------
// Standard badge config: Draft=gray, Final=green, Cancelled=amber,
// Returned=green (solid), Partially Returned=blue
// ---------------------------------------------------------------------------

export const SALE_STATUS_BADGE_CONFIG: Record<
  EffectiveSaleStatus,
  { bg: string; text: string; border: string; label: string }
> = {
  draft: { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30', label: 'Draft' },
  quotation: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', label: 'Quotation' },
  order: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30', label: 'Order' },
  final: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30', label: 'Final' },
  cancelled: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30', label: 'Cancelled' },
  returned: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30', label: 'Returned' },
  partially_returned: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', label: 'Partially Returned' },
};

/** Literal fallback so we never return undefined (production/minification-safe). Export for use in components. */
export const DEFAULT_SALE_BADGE = { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30', label: 'Draft' } as const;

/** Safe lookup: returns badge config for effective status, or draft if status not in config. */
export function getSaleStatusBadgeConfig(sale: SaleLike | null | undefined): { bg: string; text: string; border: string; label: string } {
  try {
    const effective = getEffectiveSaleStatus(sale);
    return SALE_STATUS_BADGE_CONFIG[effective] ?? SALE_STATUS_BADGE_CONFIG.draft ?? DEFAULT_SALE_BADGE;
  } catch {
    return DEFAULT_SALE_BADGE;
  }
}

export const PURCHASE_STATUS_BADGE_CONFIG: Record<
  EffectivePurchaseStatus,
  { bg: string; text: string; border: string; label: string }
> = {
  draft: { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30', label: 'Draft' },
  ordered: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', label: 'Ordered' },
  received: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30', label: 'Received' },
  final: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30', label: 'Final' },
  cancelled: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30', label: 'Cancelled' },
  returned: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30', label: 'Returned' },
  partially_returned: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', label: 'Partially Returned' },
};

/** Literal fallback for purchase (production/minification-safe). Export for use in components. */
export const DEFAULT_PURCHASE_BADGE = { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30', label: 'Draft' } as const;

/** Safe lookup: returns badge config for effective purchase status, or draft if not in config. */
export function getPurchaseStatusBadgeConfig(purchase: PurchaseLike | null | undefined): { bg: string; text: string; border: string; label: string } {
  try {
    const effective = getEffectivePurchaseStatus(purchase);
    return PURCHASE_STATUS_BADGE_CONFIG[effective] ?? PURCHASE_STATUS_BADGE_CONFIG.draft ?? DEFAULT_PURCHASE_BADGE;
  } catch {
    return DEFAULT_PURCHASE_BADGE;
  }
}

/** Payment column display: when effective status is cancelled or returned, show "Closed" and do not allow payment. */
export function isPaymentClosedForSale(sale: SaleLike | null | undefined): boolean {
  const effective = getEffectiveSaleStatus(sale);
  return effective === 'cancelled' || effective === 'returned';
}

export function isPaymentClosedForPurchase(purchase: PurchaseLike | null | undefined): boolean {
  const effective = getEffectivePurchaseStatus(purchase);
  return effective === 'cancelled' || effective === 'returned';
}

/** Allow Add Payment only when not closed and (for sale: final; for purchase: final/received) and balance > 0. */
export function canAddPaymentToSale(sale: SaleLike | null | undefined, due: number): boolean {
  if (due <= 0) return false;
  const effective = getEffectiveSaleStatus(sale);
  if (effective === 'cancelled' || effective === 'returned') return false;
  if (effective === 'partially_returned') return true; // balance > 0 already ensured
  return effective === 'final';
}

export function canAddPaymentToPurchase(purchase: PurchaseLike | null | undefined, due: number): boolean {
  if (due <= 0) return false;
  const effective = getEffectivePurchaseStatus(purchase);
  if (effective === 'cancelled' || effective === 'returned') return false;
  if (effective === 'partially_returned') return true;
  return effective === 'final' || effective === 'received';
}
