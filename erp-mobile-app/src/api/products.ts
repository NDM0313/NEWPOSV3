import { supabase, isSupabaseConfigured } from '../lib/supabase';

import { getNextDocumentNumber } from './documentNumber';

/** Get next product SKU – PRD-0001 format, same as web ERP. */
export async function getNextProductSKU(companyId: string, branchId: string | null): Promise<string> {
  return getNextDocumentNumber(companyId, branchId, 'product');
}

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
  categoryId?: string | null;
  brandId?: string | null;
  brand?: string;
  unitId?: string | null;
  costPrice: number;
  retailPrice: number;
  stock: number;
  unit: string;
  unitAllowDecimal?: boolean;
  status: 'active' | 'inactive';
  description?: string;
  barcode?: string;
  minStock?: number;
  wholesalePrice?: number;
  hasVariations?: boolean;
  variations?: ProductVariationRow[];
}

export interface ProductVariationRow {
  id: string;
  sku: string;
  attributes: Record<string, string>;
  price: number;
  stock: number;
}

export async function getProducts(companyId: string): Promise<{ data: Product[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  const { data, error } = await supabase
    .from('products')
    .select('id, company_id, name, sku, barcode, description, cost_price, retail_price, wholesale_price, current_stock, min_stock, category_id, brand_id, unit_id, is_active, has_variations, product_categories(name), units(name, allow_decimal)')
    .eq('company_id', companyId)
    .order('name');

  if (error) return { data: [], error: error.message };
  const rows = data || [];
  const withVariations = rows.filter((r: { has_variations?: boolean }) => r.has_variations);
  const varProductIds = withVariations.map((r: { id: string }) => r.id);
  let varMap: Record<string, ProductVariationRow[]> = {};
  if (varProductIds.length > 0) {
    const { data: varData } = await supabase
      .from('product_variations')
      .select('id, product_id, sku, attributes, price, stock')
      .in('product_id', varProductIds)
      .eq('is_active', true);
    for (const v of varData || []) {
      const pv = v as { product_id: string } & { id: string; sku: string; attributes: Record<string, string>; price: number; stock: number };
      if (!varMap[pv.product_id]) varMap[pv.product_id] = [];
      varMap[pv.product_id].push({
        id: pv.id,
        sku: pv.sku,
        attributes: pv.attributes || {},
        price: Number(pv.price) || 0,
        stock: Number(pv.stock) ?? 0,
      });
    }
  }
  const list: Product[] = [];
  for (const row of rows as (ProductRow & { has_variations?: boolean; min_stock?: number; description?: string; barcode?: string; brand_id?: string; id: string })[]) {
    const variations = row.has_variations ? varMap[row.id] : undefined;
    const r = row as { product_categories?: { name: string }; unit_id?: string; units?: { name?: string; allow_decimal?: boolean } | null };
    const unitName = r.units?.name || 'Piece';
    const unitAllowDecimal = r.units?.allow_decimal ?? false;
    list.push({
      id: row.id,
      sku: row.sku || '—',
      name: row.name,
      category: r.product_categories?.name || 'Other',
      categoryId: row.category_id ?? undefined,
      brandId: row.brand_id ?? undefined,
      unitId: row.unit_id ?? undefined,
      costPrice: Number(row.cost_price) || 0,
      retailPrice: Number(row.retail_price) || 0,
      stock: Number(row.current_stock) ?? 0,
      unit: unitName,
      unitAllowDecimal,
      status: row.is_active !== false ? 'active' : 'inactive',
      description: row.description ?? undefined,
      barcode: row.barcode ?? undefined,
      minStock: row.min_stock ?? 0,
      wholesalePrice: row.wholesale_price != null ? Number(row.wholesale_price) : undefined,
      hasVariations: row.has_variations ?? false,
      variations,
    });
  }
  return { data: list, error: null };
}

export interface RentalProduct {
  id: string;
  name: string;
  sku: string;
  rentPricePerDay: number;
  isRentable: boolean;
}

export async function getRentalProducts(companyId: string): Promise<{ data: RentalProduct[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };

  const { data, error } = await supabase
    .from('products')
    .select('id, name, sku, rental_price_daily, is_rentable, retail_price')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('name');

  if (error) {
    return { data: [], error: error.message };
  }

  const rows = (data || []) as Array<Record<string, unknown>>;
  const mapped: RentalProduct[] = rows
    .map((r) => ({
      id: String(r.id ?? ''),
      name: String(r.name ?? '—'),
      sku: String(r.sku ?? '—'),
      rentPricePerDay: Number(r.rental_price_daily) || 0,
      isRentable: r.is_rentable === true || (Number(r.rental_price_daily) || 0) > 0,
    }))
    .filter((p) => p.isRentable || (p.rentPricePerDay > 0));

  if (mapped.length === 0 && rows.length > 0) {
    const retailAsRent = rows.map((r) => ({
      id: String(r.id ?? ''),
      name: String(r.name ?? '—'),
      sku: String(r.sku ?? '—'),
      rentPricePerDay: Number(r.rental_price_daily) || Number(r.retail_price) / 5 || 0,
      isRentable: true,
    }));
    return { data: retailAsRent, error: null };
  }

  return {
    data: mapped.length > 0 ? mapped : rows.map((r) => ({
      id: String(r.id ?? ''),
      name: String(r.name ?? '—'),
      sku: String(r.sku ?? '—'),
      rentPricePerDay: Number(r.rental_price_daily) || Number(r.retail_price) / 5 || 0,
      isRentable: true,
    })),
    error: null,
  };
}

export interface CreateProductInput {
  name: string;
  sku: string;
  category?: string;
  categoryId?: string | null;
  brandId?: string | null;
  unitId?: string | null;
  description?: string;
  barcode?: string;
  costPrice: number;
  retailPrice: number;
  wholesalePrice?: number;
  stock: number;
  minStock?: number;
  unit: string;
  status?: 'active' | 'inactive';
  hasVariations?: boolean;
  variations?: { sku: string; attributes: Record<string, string>; price: number; stock: number }[];
}

export async function createProduct(
  companyId: string,
  p: CreateProductInput
): Promise<{ data: Product | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  const payload: Record<string, unknown> = {
    company_id: companyId,
    name: p.name,
    sku: p.sku,
    barcode: p.barcode || null,
    description: p.description || null,
    cost_price: p.costPrice,
    retail_price: p.retailPrice,
    wholesale_price: p.wholesalePrice ?? p.retailPrice,
    current_stock: p.stock,
    min_stock: p.minStock ?? 0,
    max_stock: 99999,
    has_variations: p.hasVariations ?? false,
    is_rentable: false,
    is_sellable: true,
    track_stock: true,
    is_active: p.status !== 'inactive',
    category_id: p.categoryId || null,
    brand_id: p.brandId || null,
    unit_id: p.unitId || null,
  };
  const { data, error } = await supabase.from('products').insert(payload).select('id, name, sku, cost_price, retail_price, current_stock, is_active').single();
  if (error) {
    const msg = error.code === '23505' || /duplicate|unique/i.test(error.message || '') ? 'SKU already in use.' : error.message;
    return { data: null, error: msg };
  }
  const row = data as ProductRow & { id: string };
  if (p.hasVariations && p.variations && p.variations.length > 0) {
    const varRows = p.variations.map((v) => ({
      product_id: row.id,
      sku: v.sku,
      attributes: v.attributes,
      price: v.price,
      stock: v.stock,
      is_active: true,
    }));
    await supabase.from('product_variations').insert(varRows);
  }
  return {
    data: {
      id: row.id,
      sku: row.sku || '—',
      name: row.name,
      category: p.category || 'Other',
      costPrice: Number(row.cost_price) || 0,
      retailPrice: Number(row.retail_price) || 0,
      stock: Number(row.current_stock) ?? 0,
      unit: p.unit,
      status: row.is_active !== false ? 'active' : 'inactive',
      description: p.description,
      barcode: p.barcode,
      minStock: p.minStock,
      wholesalePrice: p.wholesalePrice,
      hasVariations: p.hasVariations,
    },
    error: null,
  };
}

export async function updateProduct(
  companyId: string,
  productId: string,
  p: Partial<CreateProductInput>
): Promise<{ data: Product | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  const payload: Record<string, unknown> = {};
  if (p.name != null) payload.name = p.name;
  if (p.sku != null) payload.sku = p.sku;
  if (p.description != null) payload.description = p.description;
  if (p.barcode != null) payload.barcode = p.barcode;
  if (p.costPrice != null) payload.cost_price = p.costPrice;
  if (p.retailPrice != null) payload.retail_price = p.retailPrice;
  if (p.wholesalePrice != null) payload.wholesale_price = p.wholesalePrice;
  if (p.stock != null) payload.current_stock = p.stock;
  if (p.minStock != null) payload.min_stock = p.minStock;
  if (p.status != null) payload.is_active = p.status !== 'inactive';
  if (p.categoryId !== undefined) payload.category_id = p.categoryId;
  if (p.brandId !== undefined) payload.brand_id = p.brandId;
  if (p.unitId !== undefined) payload.unit_id = p.unitId;
  if (Object.keys(payload).length === 0) return { data: null, error: 'No fields to update.' };
  const { data, error } = await supabase
    .from('products')
    .update(payload)
    .eq('id', productId)
    .eq('company_id', companyId)
    .select('id, name, sku, cost_price, retail_price, current_stock, is_active')
    .single();
  if (error) return { data: null, error: error.message };
  const row = data as ProductRow;
  return {
    data: {
      id: row.id,
      sku: row.sku || '—',
      name: row.name,
      category: p.category || 'Other',
      costPrice: Number(row.cost_price) || 0,
      retailPrice: Number(row.retail_price) || 0,
      stock: Number(row.current_stock) ?? 0,
      unit: p.unit || 'Piece',
      status: row.is_active !== false ? 'active' : 'inactive',
    },
    error: null,
  };
}

export async function deleteProduct(companyId: string, productId: string): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) return { error: 'App not configured.' };
  const { error } = await supabase.from('products').delete().eq('id', productId).eq('company_id', companyId);
  return { error: error?.message ?? null };
}
