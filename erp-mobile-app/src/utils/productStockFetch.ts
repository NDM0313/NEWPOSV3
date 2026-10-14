import { supabase } from '../lib/supabase';
import { fetchInBatches } from '../lib/chunkInQuery';
import { applyBranchStockMovementFilter, isRealBranchUuid } from './branchId';

/** PostgREST default max-rows; page until a short page to avoid silent truncation. */
const STOCK_MOVEMENT_PAGE_SIZE = 1000;

export type StockMovementRow = {
  product_id: string;
  variation_id: string | null;
  quantity: number;
};

function isMissingTableError(error: { message?: string } | null): boolean {
  if (!error) return false;
  const m = (error.message || '').toLowerCase();
  return /inventory_balance|does not exist|pgrst/i.test(m);
}

/** True when company (and optional branch) has at least one stock_movements row. */
async function companyHasStockMovements(
  companyId: string,
  branchId?: string | null,
): Promise<boolean> {
  let q = supabase
    .from('stock_movements')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .limit(1);
  q = applyBranchStockMovementFilter(q, branchId);
  const { count, error } = await q;
  if (error) {
    console.warn('[productStockFetch] stock_movements presence check failed:', error.message);
    return true;
  }
  return (count ?? 0) > 0;
}

export type FetchStockMovementsOpts = {
  branchId?: string | null;
  /** When set (and branchId is not a real UUID), limit to these branches + null. */
  accessibleBranchIds?: string[];
};

/**
 * Fetch all stock_movements for product ids, paging past PostgREST's ~1000-row cap.
 */
export async function fetchStockMovementsPaged(
  companyId: string,
  productIds: string[],
  opts?: FetchStockMovementsOpts,
): Promise<StockMovementRow[]> {
  if (productIds.length === 0) return [];
  const branchId = opts?.branchId;
  const accessible = (opts?.accessibleBranchIds || []).filter((id) => isRealBranchUuid(id));

  return fetchInBatches(productIds, async (chunk) => {
    const all: StockMovementRow[] = [];
    let from = 0;
    for (;;) {
      let movQuery = supabase
        .from('stock_movements')
        .select('product_id, variation_id, quantity')
        .eq('company_id', companyId)
        .in('product_id', chunk)
        .order('id', { ascending: true })
        .range(from, from + STOCK_MOVEMENT_PAGE_SIZE - 1);

      if (isRealBranchUuid(branchId)) {
        movQuery = applyBranchStockMovementFilter(movQuery, branchId);
      } else if (accessible.length > 0) {
        movQuery = movQuery.or(`branch_id.in.(${accessible.join(',')}),branch_id.is.null`);
      }

      const { data, error } = await movQuery;
      if (error) throw error;
      const rows = (data || []) as StockMovementRow[];
      all.push(...rows);
      if (rows.length < STOCK_MOVEMENT_PAGE_SIZE) break;
      from += STOCK_MOVEMENT_PAGE_SIZE;
    }
    return all;
  });
}

function aggregateMovementRows(movData: StockMovementRow[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const m of movData) {
    const key = m.variation_id ? `${m.product_id}_${m.variation_id}` : m.product_id;
    map[key] = (map[key] ?? 0) + (Number(m.quantity) || 0);
  }
  return map;
}

async function loadStockFromMovements(
  companyId: string,
  productIds: string[],
  branchId?: string | null,
): Promise<Record<string, number>> {
  if (productIds.length === 0) return {};

  try {
    const movData = await fetchStockMovementsPaged(companyId, productIds, { branchId });
    return aggregateMovementRows(movData);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn('[productStockFetch] stock_movements:', msg);
    return {};
  }
}

/**
 * Branch-scoped stock map keyed by product_id or product_id_variationId.
 * Prefer stock_movements (ledger truth). Use inventory_balance only when the company
 * has no movements yet (e.g. fresh reset before first transaction).
 */
export async function fetchProductStockByKey(
  companyId: string,
  productIds: string[],
  simpleProductIds: string[],
  _varProductIds: string[],
  branchId?: string | null,
): Promise<Record<string, number>> {
  if (productIds.length === 0) return {};

  const movementsExist = await companyHasStockMovements(companyId, branchId);
  if (movementsExist) {
    return loadStockFromMovements(companyId, productIds, branchId);
  }

  const map: Record<string, number> = {};

  if (simpleProductIds.length > 0) {
    try {
      const balances = await fetchInBatches(simpleProductIds, async (chunk) => {
        let balanceQuery = supabase
          .from('inventory_balance')
          .select('product_id, qty')
          .eq('company_id', companyId)
          .in('product_id', chunk);
        balanceQuery = applyBranchStockMovementFilter(balanceQuery, branchId);
        const { data, error } = await balanceQuery;
        if (error) throw error;
        return (data || []) as { product_id: string; qty: number }[];
      });
      for (const row of balances) {
        map[row.product_id] = Number(row.qty) || 0;
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      if (!isMissingTableError({ message: msg })) {
        console.warn('[productStockFetch] inventory_balance:', msg);
      }
    }
  }

  const movementMap = await loadStockFromMovements(companyId, productIds, branchId);
  for (const [key, qty] of Object.entries(movementMap)) {
    map[key] = (map[key] ?? 0) + qty;
  }

  return map;
}

/** Sum all movement qty for one product (variation + orphan parent rows). */
export async function sumProductStockFromMovements(
  companyId: string,
  productId: string,
  branchId?: string | null,
): Promise<number> {
  try {
    const rows = await fetchStockMovementsPaged(companyId, [productId], { branchId });
    return rows.reduce((s, r) => s + (Number(r.quantity) || 0), 0);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn('[productStockFetch] sumProductStockFromMovements:', msg);
    return 0;
  }
}
