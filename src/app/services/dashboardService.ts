/**
 * Dashboard service – revenue, profit, and sales-by-category from database.
 */
import { supabase } from '@/lib/supabase';

export interface SalesByCategoryRow {
  categoryName: string;
  total: number;
}

/**
 * Get sales aggregated by product category for the given company and date range.
 * Uses sales + sales_items (or sale_items) + products + product_categories.
 */
export async function getSalesByCategory(
  companyId: string,
  startDate?: string | null,
  endDate?: string | null
): Promise<SalesByCategoryRow[]> {
  if (!companyId) return [];

  let query = supabase
    .from('sales')
    .select('id')
    .eq('company_id', companyId)
    .eq('status', 'final');

  if (startDate) query = query.gte('invoice_date', startDate);
  if (endDate) query = query.lte('invoice_date', endDate);

  const { data: sales, error: salesError } = await query;
  if (salesError || !sales?.length) return [];

  const saleIds = sales.map((s: any) => s.id);

  // Try sales_items first (with product and category)
  const itemsSelect = 'sale_id, total, product:products(category_id, category:product_categories(name))';
  let items: any[] = [];
  const { data: itemsSales } = await supabase
    .from('sales_items')
    .select(itemsSelect)
    .in('sale_id', saleIds);
  if (itemsSales?.length) {
    items = itemsSales;
  } else {
    const { data: itemsLegacy } = await supabase
      .from('sale_items')
      .select(itemsSelect)
      .in('sale_id', saleIds);
    if (itemsLegacy?.length) items = itemsLegacy;
  }

  const byCategory: Record<string, number> = {};
  const uncategorized = 'Uncategorized';
  for (const row of items) {
    const total = Number(row.total) || 0;
    const catName = (row.product?.category as any)?.name ?? uncategorized;
    byCategory[catName] = (byCategory[catName] || 0) + total;
  }

  return Object.entries(byCategory)
    .map(([categoryName, total]) => ({ categoryName, total }))
    .sort((a, b) => b.total - a.total);
}
