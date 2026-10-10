import { supabase } from '@/lib/supabase';

export const STOCK_MONEY_EPS = 0.02;

export function roundStockMoney(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export type StockMovementCostFields = {
  total_cost?: number | null;
  quantity?: number | null;
  unit_cost?: number | null;
  product_id?: string | null;
  variation_id?: string | null;
};

/** Amount from movement columns only (no product lookup). */
export function stockMovementAmountFromFields(m: StockMovementCostFields): number {
  const fromTotal = roundStockMoney(Number(m.total_cost) || 0);
  if (fromTotal > STOCK_MONEY_EPS) return fromTotal;
  const qty = Math.abs(Number(m.quantity) || 0);
  const unit = Number(m.unit_cost) || 0;
  return roundStockMoney(qty * unit);
}

/** Product / variation cost_price fallback (same rules as opening inventory GL sync). */
export async function resolveProductUnitCost(
  productId: string,
  variationId?: string | null
): Promise<number> {
  if (!productId) return 0;
  let productCost = 0;
  if (variationId) {
    try {
      const { data: pv } = await supabase
        .from('product_variations')
        .select('cost_price, purchase_price')
        .eq('id', variationId)
        .maybeSingle();
      productCost =
        Number((pv as { cost_price?: number; purchase_price?: number } | null)?.cost_price) ||
        Number((pv as { cost_price?: number; purchase_price?: number } | null)?.purchase_price) ||
        0;
    } catch {
      /* ignore */
    }
  }
  if (!productCost) {
    try {
      const { data: prod } = await supabase
        .from('products')
        .select('cost_price')
        .eq('id', productId)
        .maybeSingle();
      productCost = Number((prod as { cost_price?: number } | null)?.cost_price) || 0;
    } catch {
      /* ignore */
    }
  }
  return productCost;
}

export type StockMovementValuation = {
  amount: number;
  unitCost: number;
  usedProductFallback: boolean;
};

/**
 * Resolve economic Rs. amount for a stock movement: movement costs first, then product cost_price.
 */
export async function resolveStockMovementValuation(
  movement: StockMovementCostFields
): Promise<StockMovementValuation> {
  let amount = stockMovementAmountFromFields(movement);
  const qty = Math.abs(Number(movement.quantity) || 0);
  if (amount >= STOCK_MONEY_EPS) {
    const unitCost =
      qty > 0 ? roundStockMoney(amount / qty) : roundStockMoney(Number(movement.unit_cost) || 0);
    return { amount, unitCost, usedProductFallback: false };
  }

  const productId = movement.product_id ? String(movement.product_id) : '';
  const variationId = (movement as { variation_id?: string | null }).variation_id ?? null;
  const unitCost = await resolveProductUnitCost(productId, variationId);
  const fallbackAmt = roundStockMoney(qty * unitCost);
  if (fallbackAmt > STOCK_MONEY_EPS) {
    return { amount: fallbackAmt, unitCost, usedProductFallback: true };
  }
  return { amount: 0, unitCost: 0, usedProductFallback: false };
}

/** Pure helper for list enrichment when movement row is already loaded. */
export function resolveStockMovementDisplayAmount(
  movement: StockMovementCostFields & {
    product_cost_price?: number | null;
    variation_cost_price?: number | null;
    variation_purchase_price?: number | null;
  }
): number {
  let amount = stockMovementAmountFromFields(movement);
  if (amount >= STOCK_MONEY_EPS) return amount;
  const qty = Math.abs(Number(movement.quantity) || 0);
  let unitCost = 0;
  if (movement.variation_cost_price != null || movement.variation_purchase_price != null) {
    unitCost =
      Number(movement.variation_cost_price) || Number(movement.variation_purchase_price) || 0;
  }
  if (!unitCost && movement.product_cost_price != null) {
    unitCost = Number(movement.product_cost_price) || 0;
  }
  return roundStockMoney(qty * unitCost);
}
