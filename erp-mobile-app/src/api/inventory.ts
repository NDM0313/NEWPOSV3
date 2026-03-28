import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  stock: number;
  minStock: number;
  isLowStock: boolean;
  retailPrice: number;
}

/** Stock from stock_movements (no current_stock column dependency). Optional branch = branch-scoped qty. */
export async function getInventory(
  companyId: string,
  branchId?: string | null
): Promise<{ data: InventoryItem[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name, sku, min_stock, retail_price')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('name');

  if (productsError) return { data: [], error: productsError.message };
  if (!products?.length) return { data: [], error: null };

  const productIds = products.map((p: { id: string }) => p.id);
  let movQ = supabase
    .from('stock_movements')
    .select('product_id, quantity')
    .eq('company_id', companyId)
    .in('product_id', productIds);
  if (branchId && branchId !== 'all' && branchId !== 'default') {
    movQ = movQ.eq('branch_id', branchId);
  }
  const { data: movements } = await movQ;

  const stockByProductId: Record<string, number> = {};
  (movements || []).forEach((m: { product_id: string; quantity: number }) => {
    const id = m.product_id;
    stockByProductId[id] = (stockByProductId[id] ?? 0) + Number(m.quantity ?? 0);
  });

  const list: InventoryItem[] = products.map((r: Record<string, unknown>) => {
    const id = String(r.id ?? '');
    const stock = stockByProductId[id] ?? 0;
    const minStock = Number(r.min_stock) ?? 0;
    return {
      id,
      sku: String(r.sku ?? '—'),
      name: String(r.name ?? '—'),
      stock,
      minStock,
      isLowStock: minStock > 0 && stock <= minStock,
      retailPrice: Number(r.retail_price) ?? 0,
    };
  });
  return { data: list, error: null };
}
