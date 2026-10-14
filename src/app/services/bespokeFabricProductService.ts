import { fetchBranchStockMaps } from '@/app/services/inventoryService';
import { productService } from '@/app/services/productService';
import { unitService } from '@/app/services/unitService';
import {
  getDecimalFabricFallbackUnitIds,
  getFabricEligibleUnits,
  getLooseFabricUnitIds,
  type FabricUnitLike,
} from '@/app/types/bespoke';
import { isBespokeGenericSku } from '@/app/lib/bespokeCartInjection';
import {
  parseVariationAttributesRaw,
  publicVariationAttributes,
  variationRetailFromApiRow,
} from '@/app/utils/variationFieldMap';

export type FabricFilterMode = 'dyeable' | 'meter' | 'all';

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
  is_dyeable?: boolean;
}

export interface LooseFabricProductsResult {
  options: LooseFabricProductOption[];
  hasEligibleUnits: boolean;
  usedFallback: boolean;
  counts: { dyeable: number; meter: number; all: number };
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
  is_dyeable?: boolean;
  variations?: Array<Record<string, unknown>>;
};

function filterProductsByUnitIds(rows: ProductRow[], unitIds: string[]): ProductRow[] {
  if (!unitIds.length) return [];
  const set = new Set(unitIds);
  return rows.filter((p) => set.has(String(p.unit_id ?? '')));
}

function filterProductsBySearch(rows: ProductRow[], searchTerm: string): ProductRow[] {
  const term = searchTerm.trim().toLowerCase();
  if (!term) return rows;
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
    const isDyeable = Boolean(p.is_dyeable);

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
          is_dyeable: isDyeable,
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
        is_dyeable: isDyeable,
      });
    }
  }

  return options.slice(0, 80);
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

function catalogWithoutCustom(rows: ProductRow[]): ProductRow[] {
  return rows.filter((p) => !isBespokeGenericSku(String(p.sku ?? '')));
}

export const bespokeFabricProductService = {
  /**
   * Loads fabric candidates via productService.getAllProducts (schema-safe)
   * then filters client-side by mode / unit / search.
   */
  async getLooseFabricProducts(
    companyId: string,
    searchTerm?: string,
    branchId?: string | null,
    mode: FabricFilterMode = 'dyeable',
  ): Promise<LooseFabricProductsResult> {
    const units = await unitService.getAll(companyId);
    const fabricUnits = units as FabricUnitLike[];
    const hasEligibleUnits = getFabricEligibleUnits(fabricUnits).length > 0;
    const unitById = new Map(units.map((u) => [u.id, u]));
    const term = searchTerm?.trim() ?? '';

    const allProducts = catalogWithoutCustom(
      (await productService.getAllProducts(companyId)) as ProductRow[],
    );

    const primaryUnitIds = getLooseFabricUnitIds(fabricUnits);
    const decimalUnitIds = getDecimalFabricFallbackUnitIds(fabricUnits);
    const meterUnitIds = [...new Set([...primaryUnitIds, ...decimalUnitIds])];

    const dyeableRows = allProducts.filter((p) => Boolean(p.is_dyeable));
    const meterRows = meterUnitIds.length
      ? filterProductsByUnitIds(allProducts, meterUnitIds)
      : [];

    const counts = {
      dyeable: dyeableRows.length,
      meter: meterRows.length,
      all: allProducts.length,
    };

    let usedFallback = false;
    let rows: ProductRow[] = [];

    if (mode === 'dyeable') {
      rows = dyeableRows;
      if (!rows.length) {
        rows = meterRows;
        usedFallback = rows.length > 0;
      }
    } else if (mode === 'meter') {
      rows = meterRows;
      if (!rows.length && term.length >= 2) {
        rows = filterProductsBySearch(allProducts, term);
        usedFallback = rows.length > 0;
      }
    } else {
      rows = allProducts;
    }

    if (term) rows = filterProductsBySearch(rows, term);

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
      counts,
    };
  },
};
