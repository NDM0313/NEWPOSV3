import { supabase, isSupabaseConfigured } from '../lib/supabase';

import { getNextDocumentNumber } from './documentNumber';
import { uploadProductImages } from '../utils/productImageUpload';
import {
  ensureAttribute as ensureVariationAttribute,
  ensureValue as ensureVariationValue,
  setVariationValues,
} from './variationLibrary';

/** Get next product SKU – PRD-0001 format, same as web ERP. */
export async function getNextProductSKU(companyId: string, branchId: string | null): Promise<string> {
  return getNextDocumentNumber(companyId, branchId, 'product');
}

/** Products table select: omit current_stock so query works when column is missing. Stock from variations or 0. */
const PRODUCTS_SELECT =
  'id, company_id, name, sku, barcode, description, cost_price, retail_price, wholesale_price, min_stock, category_id, brand_id, unit_id, is_active, has_variations, image_urls, product_categories(name), units(name, allow_decimal)';

export interface ProductRow {
  id: string;
  company_id: string;
  name: string;
  sku: string;
  cost_price: number;
  retail_price: number;
  wholesale_price?: number;
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
  imageUrls?: string[];
}

export interface ProductVariationRow {
  id: string;
  sku: string;
  attributes: Record<string, string>;
  price: number;
  stock: number;
}

/** Get stock for one product from stock_movements (single source of truth). Optional branchId for branch-scoped balance. */
async function getProductStockFromMovements(
  companyId: string,
  productId: string,
  branchId?: string | null
): Promise<number> {
  let q = supabase
    .from('stock_movements')
    .select('quantity')
    .eq('company_id', companyId)
    .eq('product_id', productId);
  if (branchId && branchId !== 'all' && branchId !== 'default') q = q.eq('branch_id', branchId);
  const { data } = await q;
  const sum = (data || []).reduce((s, r) => s + Number((r as { quantity: number }).quantity) || 0, 0);
  return sum;
}

/** Get a single product by barcode or SKU (barcode first, then SKU). For POS barcode scan. Stock from stock_movements. */
export async function getProductByBarcodeOrSku(
  companyId: string,
  code: string,
  options?: { branchId?: string | null }
): Promise<{ data: Product | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  const trimmed = (code || '').trim();
  if (!trimmed) return { data: null, error: 'No barcode or SKU provided.' };

  const { data: byBarcode, error: errBarcode } = await supabase
    .from('products')
    .select(PRODUCTS_SELECT)
    .eq('company_id', companyId)
    .eq('barcode', trimmed)
    .maybeSingle();

  if (!errBarcode && byBarcode) {
    const row = byBarcode as unknown as ProductRow & {
      has_variations?: boolean;
      min_stock?: number;
      description?: string;
      barcode?: string;
      brand_id?: string;
      image_urls?: string[] | null;
      product_categories?: { name: string } | { name: string }[];
      units?: { name?: string; allow_decimal?: boolean };
    };
    const categoryName = Array.isArray(row.product_categories)
      ? row.product_categories[0]?.name
      : row.product_categories?.name;
    const stock = await getProductStockFromMovements(companyId, row.id, options?.branchId);
    const product: Product = {
      id: row.id,
      sku: row.sku || '—',
      name: row.name,
      category: categoryName || 'Other',
      categoryId: row.category_id ?? undefined,
      brandId: row.brand_id ?? undefined,
      unitId: row.unit_id ?? undefined,
      costPrice: Number(row.cost_price) || 0,
      retailPrice: Number(row.retail_price) || 0,
      stock,
      unit: row.units?.name || 'Piece',
      unitAllowDecimal: row.units?.allow_decimal ?? false,
      status: row.is_active !== false ? 'active' : 'inactive',
      description: row.description ?? undefined,
      barcode: row.barcode ?? undefined,
      minStock: row.min_stock ?? 0,
      wholesalePrice: row.wholesale_price != null ? Number(row.wholesale_price) : undefined,
      hasVariations: row.has_variations ?? false,
      imageUrls: Array.isArray(row.image_urls) ? row.image_urls : [],
    };
    return { data: product, error: null };
  }

  const { data: bySku, error: errSku } = await supabase
    .from('products')
    .select(PRODUCTS_SELECT)
    .eq('company_id', companyId)
    .eq('sku', trimmed)
    .maybeSingle();

  if (errSku || !bySku) return { data: null, error: errSku?.message ?? 'Product not found.' };

  const row = bySku as unknown as ProductRow & {
    has_variations?: boolean;
    min_stock?: number;
    description?: string;
    barcode?: string;
    brand_id?: string;
    image_urls?: string[] | null;
    product_categories?: { name: string } | { name: string }[];
    units?: { name?: string; allow_decimal?: boolean };
  };
  const categoryNameSku = Array.isArray(row.product_categories)
    ? row.product_categories[0]?.name
    : row.product_categories?.name;
  const stock = await getProductStockFromMovements(companyId, row.id, options?.branchId);
  const product: Product = {
    id: row.id,
    sku: row.sku || '—',
    name: row.name,
    category: categoryNameSku || 'Other',
    categoryId: row.category_id ?? undefined,
    brandId: row.brand_id ?? undefined,
    unitId: row.unit_id ?? undefined,
    costPrice: Number(row.cost_price) || 0,
    retailPrice: Number(row.retail_price) || 0,
    stock,
    unit: row.units?.name || 'Piece',
    unitAllowDecimal: row.units?.allow_decimal ?? false,
    status: row.is_active !== false ? 'active' : 'inactive',
    description: row.description ?? undefined,
    barcode: row.barcode ?? undefined,
    minStock: row.min_stock ?? 0,
    wholesalePrice: row.wholesale_price != null ? Number(row.wholesale_price) : undefined,
    hasVariations: row.has_variations ?? false,
    imageUrls: Array.isArray(row.image_urls) ? row.image_urls : [],
  };
  return { data: product, error: null };
}

/** Stock from stock_movements only (single source of truth). Key: product_id or product_id_variationId. */
function stockMapFromMovements(
  movements: { product_id: string; variation_id: string | null; quantity: number }[]
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const m of movements) {
    const key = m.variation_id ? `${m.product_id}_${m.variation_id}` : m.product_id;
    map[key] = (map[key] ?? 0) + Number(m.quantity) || 0;
  }
  return map;
}

export async function getProducts(companyId: string): Promise<{ data: Product[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCTS_SELECT)
    .eq('company_id', companyId)
    .order('name');

  if (error) return { data: [], error: error.message };
  const rows = data || [];
  const productIds = rows.map((r: { id: string }) => r.id);
  const withVariations = rows.filter((r: { has_variations?: boolean }) => r.has_variations);
  const varProductIds = withVariations.map((r: { id: string }) => r.id);
  let varMap: Record<string, ProductVariationRow[]> = {};

  const { data: movData } = await supabase
    .from('stock_movements')
    .select('product_id, variation_id, quantity')
    .eq('company_id', companyId)
    .in('product_id', productIds);
  const stockByKey = stockMapFromMovements((movData || []) as { product_id: string; variation_id: string | null; quantity: number }[]);

  if (varProductIds.length > 0) {
    const { data: varData } = await supabase
      .from('product_variations')
      .select('id, product_id, sku, attributes, price')
      .in('product_id', varProductIds)
      .eq('is_active', true);
    for (const v of varData || []) {
      const pv = v as { product_id: string } & { id: string; sku: string; attributes: Record<string, string>; price: number };
      if (!varMap[pv.product_id]) varMap[pv.product_id] = [];
      const varStock = stockByKey[`${pv.product_id}_${pv.id}`] ?? 0;
      varMap[pv.product_id].push({
        id: pv.id,
        sku: pv.sku,
        attributes: pv.attributes || {},
        price: Number(pv.price) || 0,
        stock: varStock,
      });
    }
  }

  const list: Product[] = [];
  for (const row of rows as (ProductRow & { has_variations?: boolean; min_stock?: number; description?: string; barcode?: string; brand_id?: string; image_urls?: string[] | null; id: string })[]) {
    const variations = row.has_variations ? varMap[row.id] : undefined;
    const r = row as { product_categories?: { name: string }; unit_id?: string; units?: { name?: string; allow_decimal?: boolean } | null };
    const unitName = r.units?.name || 'Piece';
    const unitAllowDecimal = r.units?.allow_decimal ?? false;
    const productStock = row.has_variations ? 0 : (stockByKey[row.id] ?? 0);
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
      stock: productStock,
      unit: unitName,
      unitAllowDecimal,
      status: row.is_active !== false ? 'active' : 'inactive',
      description: row.description ?? undefined,
      barcode: row.barcode ?? undefined,
      minStock: row.min_stock ?? 0,
      wholesalePrice: row.wholesale_price != null ? Number(row.wholesale_price) : undefined,
      hasVariations: row.has_variations ?? false,
      variations,
      imageUrls: Array.isArray(row.image_urls) ? row.image_urls : [],
    });
  }
  return { data: list, error: null };
}

export interface RentalProductVariation {
  id: string;
  sku: string;
  attributes: Record<string, string>;
  /** Human-readable label built from attributes (e.g. "Red / Large"). */
  label: string;
}

export interface RentalProduct {
  id: string;
  name: string;
  sku: string;
  rentPricePerDay: number;
  isRentable: boolean;
  hasVariations: boolean;
  variations: RentalProductVariation[];
}

function variationLabel(attrs: Record<string, string> | null | undefined, fallback: string): string {
  if (!attrs || typeof attrs !== 'object') return fallback;
  const parts = Object.values(attrs).filter((v) => v != null && String(v).trim().length > 0);
  return parts.length > 0 ? parts.join(' / ') : fallback;
}

export async function getRentalProducts(companyId: string): Promise<{ data: RentalProduct[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };

  const { data, error } = await supabase
    .from('products')
    .select('id, name, sku, rental_price_daily, is_rentable, retail_price, has_variations')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('name');

  if (error) {
    return { data: [], error: error.message };
  }

  const rows = (data || []) as Array<Record<string, unknown>>;

  const varProductIds = rows
    .filter((r) => r.has_variations === true)
    .map((r) => String(r.id ?? ''))
    .filter(Boolean);
  const varsByProduct: Record<string, RentalProductVariation[]> = {};
  if (varProductIds.length > 0) {
    const { data: varData } = await supabase
      .from('product_variations')
      .select('id, product_id, sku, attributes')
      .in('product_id', varProductIds)
      .eq('is_active', true);
    for (const v of (varData || []) as Array<Record<string, unknown>>) {
      const pid = String(v.product_id ?? '');
      if (!pid) continue;
      const attrs = (v.attributes as Record<string, string> | null) ?? {};
      const sku = String(v.sku ?? '');
      if (!varsByProduct[pid]) varsByProduct[pid] = [];
      varsByProduct[pid].push({
        id: String(v.id ?? ''),
        sku,
        attributes: attrs,
        label: variationLabel(attrs, sku || '—'),
      });
    }
  }

  const toRentalProduct = (r: Record<string, unknown>): RentalProduct => {
    const id = String(r.id ?? '');
    return {
      id,
      name: String(r.name ?? '—'),
      sku: String(r.sku ?? '—'),
      rentPricePerDay: Number(r.rental_price_daily) || 0,
      isRentable: r.is_rentable === true || (Number(r.rental_price_daily) || 0) > 0,
      hasVariations: r.has_variations === true,
      variations: varsByProduct[id] ?? [],
    };
  };

  const mapped = rows.map(toRentalProduct).filter((p) => p.isRentable || p.rentPricePerDay > 0);

  if (mapped.length === 0 && rows.length > 0) {
    return { data: rows.map((r) => ({ ...toRentalProduct(r), isRentable: true })), error: null };
  }

  return { data: mapped, error: null };
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
  /** Optional: newly selected image files (uploaded to product-images bucket). */
  imageFiles?: File[];
  /** Existing image URLs to keep on update. */
  existingImageUrls?: string[];
  /** Combo toggle + items. Persisted in product_combos / product_combo_items. */
  isCombo?: boolean;
  comboItems?: Array<{ productId: string; variationId?: string | null; name: string; quantity: number; unitPrice: number }>;
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
  const { data, error } = await supabase.from('products').insert(payload).select('id, name, sku, cost_price, retail_price, is_active').single();
  if (error) {
    const msg = error.code === '23505' || /duplicate|unique/i.test(error.message || '') ? 'SKU already in use.' : error.message;
    return { data: null, error: msg };
  }
  const row = data as ProductRow & { id: string };

  // Resolve a default branch for the opening stock movement (matches web behavior).
  let defaultBranchId: string | null = null;
  try {
    const { data: branches } = await supabase
      .from('branches')
      .select('id, is_default')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .limit(1);
    defaultBranchId = ((branches || [])[0] as { id?: string } | undefined)?.id ?? null;
  } catch {
    /* non-fatal: branch may be resolved by trigger */
  }

  let createdVariationIds: Array<{ id: string; stock: number; sku: string }> = [];
  if (p.hasVariations && p.variations && p.variations.length > 0) {
    const varRows = p.variations.map((v) => ({
      product_id: row.id,
      sku: v.sku,
      attributes: v.attributes,
      price: v.price,
      stock: v.stock,
      is_active: true,
    }));
    const { data: inserted } = await supabase
      .from('product_variations')
      .insert(varRows)
      .select('id, sku, stock');
    createdVariationIds = (inserted || []).map((v: Record<string, unknown>) => ({
      id: String(v.id || ''),
      stock: Number(v.stock) || 0,
      sku: String(v.sku || ''),
    }));

    // Sync to global variation library (non-fatal).
    try {
      const attrCache: Record<string, string> = {};
      const valCache: Record<string, string> = {};
      const insertedRows = (inserted ?? []) as Array<{ id?: string }>;
      for (let idx = 0; idx < insertedRows.length; idx++) {
        const varId: string = String(insertedRows[idx]?.id || '');
        const attrs: Record<string, string> = p.variations?.[idx]?.attributes || {};
        const valueIds: string[] = [];
        for (const entry of Object.entries(attrs)) {
          const aName: string = entry[0];
          const aVal: string = entry[1];
          if (!aName || aVal == null || String(aVal).trim() === '') continue;
          const aKey: string = aName.trim().toLowerCase();
          let attrId: string | undefined = attrCache[aKey];
          if (!attrId) {
            const attr = await ensureVariationAttribute(companyId, aName);
            attrId = attr.id;
            attrCache[aKey] = attrId;
          }
          const vKey: string = `${attrId}|${String(aVal).trim().toLowerCase()}`;
          let valueId: string | undefined = valCache[vKey];
          if (!valueId) {
            const vv = await ensureVariationValue(attrId, String(aVal));
            valueId = vv.id;
            valCache[vKey] = valueId;
          }
          valueIds.push(valueId);
        }
        if (varId && valueIds.length > 0) {
          await setVariationValues(varId, valueIds);
        }
      }
    } catch (err) {
      console.warn('[createProduct] variation library sync failed:', err);
    }
  }

  // Opening stock movement (matches web insertOpeningBalanceMovement).
  // Creates an 'adjustment' movement with reference_type='opening_balance' so accounting
  // treatment and reports match the web ERP.
  const openingQty = Math.max(0, Number(p.stock) || 0);
  try {
    if (!p.hasVariations && openingQty > 0 && defaultBranchId) {
      await supabase.from('stock_movements').insert({
        company_id: companyId,
        branch_id: defaultBranchId,
        product_id: row.id,
        variation_id: null,
        movement_type: 'adjustment',
        quantity: openingQty,
        unit_cost: Number(p.costPrice) || 0,
        total_cost: (Number(p.costPrice) || 0) * openingQty,
        reference_type: 'opening_balance',
        reference_id: row.id,
        notes: 'Opening stock on product create',
      });
    } else if (p.hasVariations && createdVariationIds.length > 0 && defaultBranchId) {
      const movRows = createdVariationIds
        .filter((v) => v.stock > 0 && v.id)
        .map((v) => ({
          company_id: companyId,
          branch_id: defaultBranchId,
          product_id: row.id,
          variation_id: v.id,
          movement_type: 'adjustment',
          quantity: v.stock,
          unit_cost: Number(p.costPrice) || 0,
          total_cost: (Number(p.costPrice) || 0) * v.stock,
          reference_type: 'opening_balance',
          reference_id: row.id,
          notes: `Opening stock for variation ${v.sku}`,
        }));
      if (movRows.length > 0) await supabase.from('stock_movements').insert(movRows);
    }
  } catch (err) {
    // Non-fatal: product is created; log warning for debugging
    console.warn('[createProduct] opening stock movement failed:', err);
  }

  // Upload product images (if any) and persist URLs on the product row.
  let finalImageUrls: string[] = [];
  if (p.imageFiles && p.imageFiles.length > 0) {
    try {
      const urls = await uploadProductImages(companyId, row.id, p.imageFiles);
      finalImageUrls = urls;
      if (urls.length > 0) {
        await supabase.from('products').update({ image_urls: urls }).eq('id', row.id);
      }
    } catch (err) {
      console.warn('[createProduct] image upload failed:', err);
    }
  }

  // Persist combo items (matches web comboService.createCombo).
  if (p.isCombo && Array.isArray(p.comboItems) && p.comboItems.length > 0) {
    try {
      const total = p.comboItems.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0);
      const { data: comboRow, error: comboErr } = await supabase
        .from('product_combos')
        .insert({
          company_id: companyId,
          combo_product_id: row.id,
          combo_name: p.name,
          combo_price: total || Number(p.retailPrice) || 0,
          is_active: true,
        })
        .select('id')
        .single();
      if (comboErr) {
        console.warn('[createProduct] combo insert failed:', comboErr);
      } else {
        const comboId = (comboRow as { id: string }).id;
        const itemRows = p.comboItems.map((it) => ({
          company_id: companyId,
          combo_id: comboId,
          product_id: it.productId,
          variation_id: it.variationId ?? null,
          qty: Number(it.quantity) || 1,
          unit_price: Number(it.unitPrice) || null,
        }));
        const { error: itemsErr } = await supabase.from('product_combo_items').insert(itemRows);
        if (itemsErr) {
          console.warn('[createProduct] combo items insert failed:', itemsErr);
          await supabase.from('product_combos').delete().eq('id', comboId);
        } else {
          await supabase.from('products').update({ is_combo_product: true }).eq('id', row.id);
        }
      }
    } catch (err) {
      console.warn('[createProduct] combo persist threw:', err);
    }
  }

  return {
    data: {
      id: row.id,
      sku: row.sku || '—',
      name: row.name,
      category: p.category || 'Other',
      costPrice: Number(row.cost_price) || 0,
      retailPrice: Number(row.retail_price) || 0,
      stock: openingQty,
      unit: p.unit,
      status: row.is_active !== false ? 'active' : 'inactive',
      description: p.description,
      barcode: p.barcode,
      minStock: p.minStock,
      wholesalePrice: p.wholesalePrice,
      hasVariations: p.hasVariations,
      imageUrls: finalImageUrls,
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
  if (p.minStock != null) payload.min_stock = p.minStock;
  if (p.status != null) payload.is_active = p.status !== 'inactive';
  if (p.categoryId !== undefined) payload.category_id = p.categoryId;
  if (p.brandId !== undefined) payload.brand_id = p.brandId;
  if (p.unitId !== undefined) payload.unit_id = p.unitId;

  // Handle image updates: upload new files, merge with existing kept URLs.
  let nextImageUrls: string[] | undefined;
  if (p.imageFiles && p.imageFiles.length > 0) {
    try {
      const urls = await uploadProductImages(companyId, productId, p.imageFiles);
      nextImageUrls = [...(p.existingImageUrls ?? []), ...urls];
    } catch (err) {
      console.warn('[updateProduct] image upload failed:', err);
    }
  } else if (Array.isArray(p.existingImageUrls)) {
    nextImageUrls = p.existingImageUrls;
  }
  if (nextImageUrls !== undefined) payload.image_urls = nextImageUrls;

  if (Object.keys(payload).length === 0 && p.isCombo === undefined) {
    return { data: null, error: 'No fields to update.' };
  }
  let row: ProductRow | null = null;
  if (Object.keys(payload).length > 0) {
    const { data, error } = await supabase
      .from('products')
      .update(payload)
      .eq('id', productId)
      .eq('company_id', companyId)
      .select('id, name, sku, cost_price, retail_price, is_active')
      .single();
    if (error) return { data: null, error: error.message };
    row = data as ProductRow;
  } else {
    const { data } = await supabase
      .from('products')
      .select('id, name, sku, cost_price, retail_price, is_active')
      .eq('id', productId)
      .eq('company_id', companyId)
      .single();
    row = data as ProductRow;
  }

  // Replace combo items if combo toggled on with items.
  if (p.isCombo !== undefined) {
    try {
      if (p.isCombo && Array.isArray(p.comboItems) && p.comboItems.length > 0) {
        const total = p.comboItems.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0);
        // Find existing combo row, or create one.
        const { data: existing } = await supabase
          .from('product_combos')
          .select('id')
          .eq('combo_product_id', productId)
          .eq('company_id', companyId)
          .maybeSingle();
        let comboId: string | null = (existing as { id?: string } | null)?.id ?? null;
        if (!comboId) {
          const { data: inserted } = await supabase
            .from('product_combos')
            .insert({
              company_id: companyId,
              combo_product_id: productId,
              combo_name: p.name || row?.name || 'Combo',
              combo_price: total || Number(p.retailPrice) || 0,
              is_active: true,
            })
            .select('id')
            .single();
          comboId = (inserted as { id: string } | null)?.id ?? null;
        } else {
          await supabase
            .from('product_combos')
            .update({ combo_price: total, is_active: true, combo_name: p.name || row?.name })
            .eq('id', comboId);
          await supabase.from('product_combo_items').delete().eq('combo_id', comboId).eq('company_id', companyId);
        }
        if (comboId) {
          const itemRows = p.comboItems.map((it) => ({
            company_id: companyId,
            combo_id: comboId,
            product_id: it.productId,
            variation_id: it.variationId ?? null,
            qty: Number(it.quantity) || 1,
            unit_price: Number(it.unitPrice) || null,
          }));
          await supabase.from('product_combo_items').insert(itemRows);
          await supabase.from('products').update({ is_combo_product: true }).eq('id', productId);
        }
      } else if (p.isCombo === false) {
        await supabase.from('product_combos').update({ is_active: false }).eq('combo_product_id', productId).eq('company_id', companyId);
        await supabase.from('products').update({ is_combo_product: false }).eq('id', productId);
      }
    } catch (err) {
      console.warn('[updateProduct] combo persist failed:', err);
    }
  }

  if (!row) return { data: null, error: 'Product not found after update.' };
  return {
    data: {
      id: row.id,
      sku: row.sku || '—',
      name: row.name,
      category: p.category || 'Other',
      costPrice: Number(row.cost_price) || 0,
      retailPrice: Number(row.retail_price) || 0,
      stock: 0,
      unit: p.unit || 'Piece',
      status: row.is_active !== false ? 'active' : 'inactive',
      imageUrls: nextImageUrls,
    },
    error: null,
  };
}

export async function deleteProduct(companyId: string, productId: string): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) return { error: 'App not configured.' };
  const { error } = await supabase.from('products').delete().eq('id', productId).eq('company_id', companyId);
  return { error: error?.message ?? null };
}
