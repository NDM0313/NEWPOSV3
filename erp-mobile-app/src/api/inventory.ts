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

export async function getInventory(companyId: string): Promise<{ data: InventoryItem[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  const { data, error } = await supabase
    .from('products')
    .select('id, name, sku, current_stock, min_stock, retail_price')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('current_stock', { ascending: true });

  if (error) return { data: [], error: error.message };
  const list: InventoryItem[] = (data || []).map((r: Record<string, unknown>) => {
    const stock = Number(r.current_stock) ?? 0;
    const minStock = Number(r.min_stock) ?? 0;
    return {
      id: String(r.id ?? ''),
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
