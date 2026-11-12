/**
 * Display helpers for Physical Stock Count (variation labels, movement history categories).
 * Pure — no I/O. Safe when variation attributes are missing/incomplete.
 */

import {
  parseVariationAttributesRaw,
  publicVariationAttributes,
} from '@/app/utils/variationFieldMap';

export type StockCountItemKind = 'product' | 'variation';

export type StockHistoryCategory =
  | 'opening'
  | 'purchase'
  | 'purchase_return'
  | 'sale'
  | 'sale_return'
  | 'rental_out'
  | 'rental_in'
  | 'transfer_in'
  | 'transfer_out'
  | 'production_in'
  | 'production_out'
  | 'adjustment'
  | 'other';

export type StockHistoryCategoryTotals = Record<StockHistoryCategory, number>;

export function emptyHistoryTotals(): StockHistoryCategoryTotals {
  return {
    opening: 0,
    purchase: 0,
    purchase_return: 0,
    sale: 0,
    sale_return: 0,
    rental_out: 0,
    rental_in: 0,
    transfer_in: 0,
    transfer_out: 0,
    production_in: 0,
    production_out: 0,
    adjustment: 0,
    other: 0,
  };
}

/** Human label for shop staff. */
export function historyCategoryLabel(cat: StockHistoryCategory): string {
  switch (cat) {
    case 'opening':
      return 'Opening';
    case 'purchase':
      return 'Purchases (in)';
    case 'purchase_return':
      return 'Purchase returns (out)';
    case 'sale':
      return 'Sales (out)';
    case 'sale_return':
      return 'Sales returns (in)';
    case 'rental_out':
      return 'Rent out';
    case 'rental_in':
      return 'Rental returns';
    case 'transfer_in':
      return 'Transfers in';
    case 'transfer_out':
      return 'Transfers out';
    case 'production_in':
      return 'Production / other in';
    case 'production_out':
      return 'Production / other out';
    case 'adjustment':
      return 'Adjustments';
    default:
      return 'Other';
  }
}

/**
 * Map stock_movements row to a display category using existing type conventions.
 * Does not invent document data — only movement_type / reference_type / quantity sign.
 */
export function categorizeStockMovement(row: {
  movement_type?: string | null;
  reference_type?: string | null;
  quantity?: number | null;
  notes?: string | null;
}): StockHistoryCategory {
  const mt = String(row.movement_type || '').toLowerCase().trim();
  const rt = String(row.reference_type || '').toLowerCase().trim();
  const qty = Number(row.quantity) || 0;

  if (rt === 'opening_balance' || mt === 'opening' || mt === 'opening_stock' || mt === 'opening_balance') {
    return 'opening';
  }
  if (mt.includes('purchase_return') || mt === 'purchase_return' || rt.includes('purchase_return')) {
    return 'purchase_return';
  }
  if (mt.includes('sale_return') || mt === 'sale_return' || mt === 'sell_return' || rt.includes('sale_return')) {
    return 'sale_return';
  }
  if (mt === 'purchase' || rt === 'purchase') return 'purchase';
  if (mt === 'sale' || rt === 'sale') return 'sale';
  if (mt === 'rental_out') return 'rental_out';
  if (mt === 'rental_in' || mt === 'rental_return') return 'rental_in';

  if (mt === 'transfer_in' || (mt === 'transfer' && qty > 0) || rt === 'transfer_in') {
    return 'transfer_in';
  }
  if (mt === 'transfer_out' || (mt === 'transfer' && qty < 0) || rt === 'transfer_out') {
    return 'transfer_out';
  }

  if (
    mt.includes('production') ||
    mt === 'production_in' ||
    rt.includes('production') ||
    rt.includes('bespoke') ||
    mt === 'manufacture'
  ) {
    return qty >= 0 ? 'production_in' : 'production_out';
  }

  if (mt === 'adjustment' || rt === 'adjustment' || rt === 'stock_adjustment' || rt === 'stock_count') {
    return 'adjustment';
  }

  return 'other';
}

export function sumHistoryByCategory(
  rows: Array<{
    movement_type?: string | null;
    reference_type?: string | null;
    quantity?: number | null;
  }>
): StockHistoryCategoryTotals {
  const totals = emptyHistoryTotals();
  for (const row of rows) {
    const cat = categorizeStockMovement(row);
    totals[cat] = Math.round((totals[cat] + (Number(row.quantity) || 0)) * 10000) / 10000;
  }
  return totals;
}

/** Chronological running balance (oldest → newest). Returns rows with running_balance. */
export function withRunningBalance<T extends { created_at?: string; quantity?: number | null }>(
  rows: T[]
): Array<T & { running_balance: number }> {
  const sorted = [...rows].sort((a, b) => {
    const ta = new Date(a.created_at || 0).getTime();
    const tb = new Date(b.created_at || 0).getTime();
    return ta - tb;
  });
  let bal = 0;
  return sorted.map((r) => {
    bal = Math.round((bal + (Number(r.quantity) || 0)) * 10000) / 10000;
    return { ...r, running_balance: bal };
  });
}

/** Format public variation attributes for shop staff; empty if none. */
export function formatVariationAttributesLabel(attributes: unknown): string {
  const attrs = publicVariationAttributes(parseVariationAttributesRaw(attributes));
  const entries = Object.entries(attrs || {}).filter(
    ([k, v]) => k && v != null && String(v).trim() !== ''
  );
  if (!entries.length) return '';
  return entries.map(([k, v]) => `${k}: ${v}`).join(' · ');
}

export function resolveItemKind(hasVariationId: boolean): StockCountItemKind {
  return hasVariationId ? 'variation' : 'product';
}

export function itemKindLabel(kind: StockCountItemKind): string {
  return kind === 'variation' ? 'Variation' : 'Product';
}

/**
 * Image ref for ProductImage: prefer raw storage path / first image_urls entry.
 * Does not sign URLs — ProductImage / getProductImageDisplayUrl handles that.
 */
export function pickProductImageRef(
  imageUrls: unknown,
  fallbackUrl?: string | null
): string | undefined {
  if (Array.isArray(imageUrls)) {
    for (const u of imageUrls) {
      if (typeof u === 'string' && u.trim()) return u.trim();
    }
  } else if (typeof imageUrls === 'string' && imageUrls.trim()) {
    return imageUrls.trim();
  }
  if (fallbackUrl && String(fallbackUrl).trim()) return String(fallbackUrl).trim();
  return undefined;
}
