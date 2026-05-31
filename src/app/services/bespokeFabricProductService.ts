import { fetchBranchStockMaps } from '@/app/services/inventoryService';
import { productService } from '@/app/services/productService';
import { unitService } from '@/app/services/unitService';
import {
  getDecimalFabricFallbackUnitIds,
  getFabricEligibleUnits,
  getLooseFabricUnitIds,
  type FabricUnitLike,
} from '@/app/types/bespoke';
import {
  parseVariationAttributesRaw,
  publicVariationAttributes,
  variationRetailFromApiRow,
} from '@/app/utils/variationFieldMap';

export interface LooseFabricProductOption {
  /** Unique list key (product or product:variation). */
  id: string;
  product_id: string;
  variation_id?: string;
  name: string;
  sku: string;
  unit_id: string;
  unit_code: string;
  retail_price: number;
  stock?: number;
}

export interface LooseFabricProductsResult {
  options: LooseFabricProductOption[];
  hasEligibleUnits: boolean;
  usedFallback: boolean;
}

function unitLabel(u: { short_code?: string; symbol?: string; name?: string }): string {
  return (u.short_code || u.symbol || u.name || 'm').trim();
}

function variationDisplayName(
  productName: string,
  variation: Record<string, unknown>,
): string {
  const attrs = publicVariationAttributes(parseVariationAttributesRaw(variation.attributes));
  const parts = Object.values(attrs).filter(Boolean);
  if (!parts.length) return productName;
  return `${productName} — ${parts.join(' / ')}`;
}

type ProductRow = Record<string, unknown> & {
  id: string;
  name?: string;
  sku?: string;
  unit_id?: string;
  retail_price?: number;
  has_variations?: boolean;
  variations?: Array<Record<string, unknown>>;
};

function filterProductsByUnitIds(rows: ProductRow[], unitIds: string[]): ProductRow[] {
  if (!unitIds.length) return [];
  const set = new Set(unitIds);
  return rows.filter((p) => set.has(String(p.unit_id ?? '')));
}

function filterProductsBySearch(rows: ProductRow[], searchTerm: string): ProductRow[] {
  const term = searchTerm.trim().toLowerCase();
  if (term.length < 2) return [];
  return rows.filter((p) => {
    const name = String(p.name ?? '').toLowerCase();
    const sku = String(p.sku ?? '').toLowerCase();
    return name.includes(term) || sku.includes(term);
  });
}

function expandProductsToOptions(
  rows: ProductRow[],
  unitById: Map<string, FabricUnitLike & { short_code?: string; symbol?: string; name?: string }>,
  stockByProductId: Record<string, number>,
  stockByVariationId: Record<string, number>,
): LooseFabricProductOption[] {
  const options: LooseFabricProductOption[] = [];

  for (const p of rows) {
    const productId = String(p.id);
    const unit = unitById.get(String(p.unit_id ?? ''));
    const unitCode = unit ? unitLabel(unit) : 'm';
    const basePrice = Number(p.retail_price) || 0;
    const variations = Array.isArray(p.variations) ? p.variations : [];
    const activeVariations = variations.filter((v) => v.is_active !== false);

    if (p.has_variations && activeVariations.length > 0) {
      for (const v of activeVariations) {
        const variationId = String(v.id);
        const retail = variationRetailFromApiRow(v);
        options.push({
          id: `${productId}:${variationId}`,
          product_id: productId,
          variation_id: variationId,
          name: variationDisplayName(String(p.name ?? ''), v),
          sku: String(v.sku ?? p.sku ?? ''),
          unit_id: String(p.unit_id ?? ''),
          unit_code: unitCode,
          retail_price: retail > 0 ? retail : basePrice,
          stock: stockByVariationId[variationId] ?? stockByProductId[productId],
        });
      }
    } else {
      options.push({
        id: productId,
        product_id: productId,
        name: String(p.name ?? ''),
        sku: String(p.sku ?? ''),
        unit_id: String(p.unit_id ?? ''),
        unit_code: unitCode,
        retail_price: basePrice,
        stock: stockByProductId[productId],
      });
    }
  }

  return options.slice(0, 40);
}

async function loadStockMaps(
  companyId: string,
  branchId: string | null | undefined,
  rows: ProductRow[],
): Promise<{ product: Record<string, number>; variation: Record<string, number> }> {
  if (!branchId || branchId === 'all' || !rows.length) {
    return { product: {}, variation: {} };
  }
  try {
    const products = rows.map((p) => ({
      id: String(p.id),
      hasVariations: Boolean(p.has_variations),
    }));
    const maps = await fetchBranchStockMaps(companyId, branchId, products);
    return {
      product: maps.productStockMap ?? {},
      variation: maps.variationStockMap ?? {},
    };
  } catch {
    return { product: {}, variation: {} };
  }
}

export const bespokeFabricProductService = {
  /**
   * Loads fabric candidates via productService.getAllProducts (schema-safe)
   * then filters client-side by unit / search — avoids PostgREST 400 on optional columns.
   */
  async getLooseFabricProducts(
    companyId: string,
    searchTerm?: string,
    branchId?: string | null,
  ): Promise<LooseFabricProductsResult> {
    const units = await unitService.getAll(companyId);
    const fabricUnits = units as FabricUnitLike[];
    const hasEligibleUnits = getFabricEligibleUnits(fabricUnits).length > 0;
    const unitById = new Map(units.map((u) => [u.id, u]));
    const term = searchTerm?.trim() ?? '';

    const allProducts = (await productService.getAllProducts(companyId)) as ProductRow[];

    let usedFallback = false;
    let rows: ProductRow[] = [];

    const primaryUnitIds = getLooseFabricUnitIds(fabricUnits);
    if (primaryUnitIds.length) {
      rows = filterProductsByUnitIds(allProducts, primaryUnitIds);
      if (term) rows = filterProductsBySearch(rows, term);
    }

    if (!rows.length) {
      const decimalUnitIds = getDecimalFabricFallbackUnitIds(fabricUnits);
      if (decimalUnitIds.length) {
        rows = filterProductsByUnitIds(allProducts, decimalUnitIds);
        if (term) rows = filterProductsBySearch(rows, term);
        if (rows.length) usedFallback = true;
      }
    }

    if (!rows.length && term.length >= 2) {
      rows = filterProductsBySearch(allProducts, term);
      if (rows.length) usedFallback = true;
    }

    const { product: stockByProductId, variation: stockByVariationId } = await loadStockMaps(
      companyId,
      branchId,
      rows,
    );

    const options = expandProductsToOptions(
      rows,
      unitById,
      stockByProductId,
      stockByVariationId,
    );

    return {
      options,
      hasEligibleUnits,
      usedFallback,
    };
  },
};
