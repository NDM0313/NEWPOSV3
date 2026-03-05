/**
 * Branch stock from stock_movements: balance = SUM(quantity) per product_id / variation_id.
 * Used by mobile POS to overlay branch-scoped stock.
 */

export function balanceFromMovements(
  movements: { product_id: string; variation_id: string | null; quantity: number }[]
): Map<string, number> {
  const byKey = new Map<string, number>();
  for (const m of movements) {
    const key = m.variation_id ? `${m.product_id}_${m.variation_id}` : m.product_id;
    const q = Number(m.quantity) || 0;
    byKey.set(key, (byKey.get(key) ?? 0) + q);
  }
  return byKey;
}
