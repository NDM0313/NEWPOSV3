import { supabase } from '../lib/supabase';
import { fetchInBatches } from '../lib/chunkInQuery';

function isMissingTableError(error: { message?: string } | null): boolean {
  if (!error) return false;
  const m = (error.message || '').toLowerCase();
  return /inventory_balance|does not exist|pgrst/i.test(m);
}

/**
 * Branch-scoped stock map keyed by product_id or product_id_variationId.
 * Uses inventory_balance for simple products when available; falls back to stock_movements.
 */
export async function fetchProductStockByKey(
  companyId: string,
  productIds: string[],
  simpleProductIds: string[],
  varProductIds: string[],
  branchId?: string | null,
): Promise<Record<string, number>> {
  const map: Record<string, number> = {};
  if (productIds.length === 0) return map;

  let balanceHasData = false;
  if (simpleProductIds.length > 0) {
    try {
      const balances = await fetchInBatches(
        simpleProductIds,
        async (chunk) => {
          let balanceQuery = supabase
            .from('inventory_balance')
            .select('product_id, qty')
            .eq('company_id', companyId)
            .in('product_id', chunk);
          if (branchId) balanceQuery = balanceQuery.eq('branch_id', branchId);
          const { data, error } = await balanceQuery;
          if (error) throw error;
          return (data || []) as { product_id: string; qty: number }[];
        }
      );
      if (balances.length) {
        balanceHasData = true;
        for (const row of balances) {
          map[row.product_id] = Number(row.qty) || 0;
        }
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      if (!isMissingTableError({ message: msg })) {
        console.warn('[productStockFetch] inventory_balance:', msg);
      }
    }
  }

  const movementProductIds = balanceHasData ? varProductIds : productIds;
  if (movementProductIds.length === 0) return map;

  try {
    const movData = await fetchInBatches(
      movementProductIds,
      async (chunk) => {
        let movQuery = supabase
          .from('stock_movements')
          .select('product_id, variation_id, quantity')
          .eq('company_id', companyId)
          .in('product_id', chunk);
        if (branchId) movQuery = movQuery.eq('branch_id', branchId);
        const { data, error } = await movQuery;
        if (error) throw error;
        return (data || []) as { product_id: string; variation_id: string | null; quantity: number }[];
      }
    );

    for (const m of movData) {
      if (balanceHasData && !m.variation_id && simpleProductIds.includes(m.product_id)) {
        continue;
      }
      const key = m.variation_id ? `${m.product_id}_${m.variation_id}` : m.product_id;
      map[key] = (map[key] ?? 0) + (Number(m.quantity) || 0);
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn('[productStockFetch] stock_movements:', msg);
  }

  return map;
}
