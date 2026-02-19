import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface ProductRow {
  id: string;
  company_id: string;
  name: string;
  sku: string;
  cost_price: number;
  retail_price: number;
  wholesale_price?: number;
  current_stock: number;
  category_id?: string | null;
  unit_id?: string | null;
  is_active: boolean;
  category?: { id: string; name: string } | null;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  costPrice: number;
  retailPrice: number;
  stock: number;
  unit: string;
  status: 'active' | 'inactive';
}

export async function getProducts(companyId: string): Promise<{ data: Product[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  const { data, error } = await supabase
    .from('products')
    .select('id, company_id, name, sku, cost_price, retail_price, current_stock, category_id, unit_id, is_active')
    .eq('company_id', companyId)
    .order('name');

  if (error) return { data: [], error: error.message };
  const list: Product[] = (data || []).map((row: ProductRow) => ({
    id: row.id,
    sku: row.sku || '—',
    name: row.name,
    category: (row as { category?: { name: string } }).category?.name || 'Other',
    costPrice: Number(row.cost_price) || 0,
    retailPrice: Number(row.retail_price) || 0,
    stock: Number(row.current_stock) ?? 0,
    unit: 'Piece',
    status: row.is_active !== false ? 'active' : 'inactive',
  }));
  return { data: list, error: null };
}

export async function createProduct(
  companyId: string,
  p: { name: string; sku: string; category?: string; costPrice: number; retailPrice: number; stock: number; unit: string }
): Promise<{ data: Product | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  const payload = {
    company_id: companyId,
    name: p.name,
    sku: p.sku,
    cost_price: p.costPrice,
    retail_price: p.retailPrice,
    wholesale_price: p.retailPrice,
    current_stock: p.stock,
    min_stock: 0,
    max_stock: 99999,
    has_variations: false,
    is_rentable: false,
    is_sellable: true,
    track_stock: true,
    is_active: true,
    category_id: null,
    unit_id: null,
  };
  const { data, error } = await supabase.from('products').insert(payload).select('id, name, sku, cost_price, retail_price, current_stock, is_active').single();
  if (error) {
    const msg = error.code === '23505' || /duplicate|unique/i.test(error.message || '') ? 'SKU already in use.' : error.message;
    return { data: null, error: msg };
  }
  const row = data as ProductRow;
  return {
    data: {
      id: row.id,
      sku: row.sku || '—',
      name: row.name,
      category: 'Other',
      costPrice: Number(row.cost_price) || 0,
      retailPrice: Number(row.retail_price) || 0,
      stock: Number(row.current_stock) ?? 0,
      unit: 'Piece',
      status: row.is_active !== false ? 'active' : 'inactive',
    },
    error: null,
  };
}
