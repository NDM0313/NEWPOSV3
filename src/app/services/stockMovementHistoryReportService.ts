/**
 * Read-only data layer for Stock Ledger by Product report.
 * Authoritative source: stock_movements. No writes.
 */

import { supabase } from '@/lib/supabase';
import { fetchInBatches } from '@/app/lib/chunkInQuery';
import { applyBranchStockMovementFilter } from '@/app/utils/branchScope';
import { inventoryService } from '@/app/services/inventoryService';
import { productService } from '@/app/services/productService';
import {
  buildMovementReportRows,
  buildProductSummary,
  filterMovementsInPeriod,
  matchesMovementTypeFilter,
  matchesStockStatusFilter,
  type EnrichmentContext,
  type ProductReportSection,
  type ProductStockSummary,
  type RawStockMovement,
  type StockMovementReportFilters,
} from '@/app/lib/stockMovementReportLogic';
import { formatProductVariationLabel } from '@/app/lib/stockMovementDisplay';
import { buildStockMovementEnrichment } from '@/app/lib/stockMovementReferenceEnrichment';

export interface CatalogProduct {
  id: string;
  name: string;
  sku: string;
  category: string | null;
  subcategory: string | null;
  categoryId: string | null;
  subcategoryId: string | null;
  brand: string | null;
  brandId: string | null;
  unit: string | null;
  isActive: boolean;
  hasVariations: boolean;
}

export interface ProductSummaryListResult {
  products: ProductStockSummary[];
  totalCount: number;
  page: number;
  pageSize: number;
  largeReportWarning: boolean;
}

const PAGE_SIZE = 50;
const LARGE_PRODUCT_THRESHOLD = 100;
const LARGE_ROW_THRESHOLD = 5000;

const MOVEMENT_REPORT_SELECT =
  'id, product_id, created_at, movement_type, quantity, reference_type, reference_id, branch_id, unit_cost, notes, created_by';

interface SummaryBatchData {
  catalog: CatalogProduct[];
  movementsByProduct: Map<string, RawStockMovement[]>;
  balanceProductIds: Set<string>;
  filteredSummaries: ProductStockSummary[];
  largeReportWarning: boolean;
}

let summaryBatchCache: { key: string; data: SummaryBatchData } | null = null;

function summaryCacheKey(companyId: string, filters: StockMovementReportFilters): string {
  return JSON.stringify({
    companyId,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    branchId: filters.branchId,
    categoryId: filters.categoryId,
    subcategoryId: filters.subcategoryId,
    brandId: filters.brandId,
    supplierId: filters.supplierId,
    movementType: filters.movementType,
    stockStatus: filters.stockStatus,
    includeZeroStock: filters.includeZeroStock,
    includeNoTransaction: filters.includeNoTransaction,
    includeInactive: filters.includeInactive,
  });
}

type RawStockMovementWithProduct = RawStockMovement & { product_id: string };

function mapDbRowToRawMovement(r: Record<string, unknown>): RawStockMovementWithProduct {
  return {
    id: String(r.id),
    product_id: String(r.product_id),
    created_at: String(r.created_at),
    movement_type: (r.movement_type as string) ?? null,
    quantity: Number(r.quantity || 0),
    unit_cost: r.unit_cost != null ? Number(r.unit_cost) : null,
    reference_type: (r.reference_type as string) ?? null,
    reference_id: r.reference_id != null ? String(r.reference_id) : null,
    notes: (r.notes as string) ?? null,
    branch_id: r.branch_id != null ? String(r.branch_id) : null,
    created_by: r.created_by != null ? String(r.created_by) : null,
  };
}

async function fetchMovementsForProductsBatched(
  companyId: string,
  productIds: string[],
  branchId?: string | null,
): Promise<RawStockMovementWithProduct[]> {
  if (!productIds.length) return [];
  const rows = await fetchInBatches(productIds, async (chunk) => {
    let q = supabase
      .from('stock_movements')
      .select(MOVEMENT_REPORT_SELECT)
      .eq('company_id', companyId)
      .in('product_id', chunk);
    q = applyBranchStockMovementFilter(q, branchId);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  });
  return rows.map((r) => mapDbRowToRawMovement(r as Record<string, unknown>));
}

function groupMovementsByProduct(movements: RawStockMovementWithProduct[]): Map<string, RawStockMovement[]> {
  const map = new Map<string, RawStockMovement[]>();
  for (const m of movements) {
    const { product_id, ...rest } = m;
    const list = map.get(product_id) ?? [];
    list.push(rest);
    map.set(product_id, list);
  }
  return map;
}

async function fetchInventoryBalanceProductSet(
  companyId: string,
  productIds: string[],
  branchId?: string | null,
): Promise<Set<string>> {
  if (!productIds.length) return new Set();
  const rows = await fetchInBatches(productIds, async (chunk) => {
    let q = supabase
      .from('inventory_balance')
      .select('product_id')
      .eq('company_id', companyId)
      .in('product_id', chunk);
    q = applyBranchStockMovementFilter(q, branchId);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  });
  return new Set(rows.map((r: { product_id: string }) => String(r.product_id)));
}

function buildSummariesFromBatch(
  catalog: CatalogProduct[],
  movementsByProduct: Map<string, RawStockMovement[]>,
  balanceProductIds: Set<string>,
  filters: StockMovementReportFilters,
): ProductStockSummary[] {
  const from = `${filters.dateFrom}T00:00:00.000Z`;
  const to = `${filters.dateTo}T23:59:59.999Z`;

  return catalog.map((meta) => {
    const allMovements = movementsByProduct.get(meta.id) ?? [];
    const typeFiltered = allMovements.filter((m) =>
      matchesMovementTypeFilter(m.movement_type, m.reference_type, filters.movementType),
    );
    const periodMovements = typeFiltered.filter((m) => m.created_at >= from && m.created_at <= to);
    const currentStock = typeFiltered.reduce((s, m) => s + Number(m.quantity || 0), 0);
    return buildProductSummary(
      {
        productId: meta.id,
        productName: meta.name,
        sku: meta.sku,
        category: meta.category || meta.subcategory,
        brand: meta.brand,
        unit: meta.unit,
      },
      typeFiltered,
      periodMovements,
      filters.dateFrom,
      filters.dateTo,
      currentStock,
      balanceProductIds.has(meta.id),
    );
  });
}

async function loadSummaryBatchData(
  companyId: string,
  filters: StockMovementReportFilters,
): Promise<SummaryBatchData> {
  const key = summaryCacheKey(companyId, filters);
  if (summaryBatchCache?.key === key) return summaryBatchCache.data;

  const catalog = await fetchProductCatalog(companyId, filters);
  const productIds = catalog.map((p) => p.id);
  const [allMovements, balanceProductIds] = await Promise.all([
    fetchMovementsForProductsBatched(companyId, productIds, filters.branchId),
    fetchInventoryBalanceProductSet(companyId, productIds, filters.branchId),
  ]);

  const movementsByProduct = groupMovementsByProduct(allMovements);

  const summaries = buildSummariesFromBatch(catalog, movementsByProduct, balanceProductIds, filters);
  const filteredSummaries = applyClientFilters(summaries, filters);
  const estimatedRows = filteredSummaries.reduce((s, p) => s + p.movementCountInPeriod, 0);
  const largeReportWarning =
    filteredSummaries.length > LARGE_PRODUCT_THRESHOLD || estimatedRows > LARGE_ROW_THRESHOLD;

  const data: SummaryBatchData = {
    catalog,
    movementsByProduct,
    balanceProductIds,
    filteredSummaries,
    largeReportWarning,
  };
  summaryBatchCache = { key, data };
  return data;
}

async function fetchVariationLabelMap(productId: string): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('product_variations')
    .select('id, name, sku, attributes')
    .eq('product_id', productId);
  if (error) return {};
  const map: Record<string, string> = {};
  for (const v of data || []) {
    map[String(v.id)] = formatProductVariationLabel({
      name: v.name,
      sku: v.sku,
      attributes: v.attributes as Record<string, unknown> | null,
    });
  }
  return map;
}

async function enrichWithVariationLabels(
  meta: CatalogProduct,
  filters: StockMovementReportFilters,
  ctx: EnrichmentContext,
): Promise<{ ctx: EnrichmentContext; showVariationColumn: boolean }> {
  const showVariationColumn = !filters.variationId && !!meta.hasVariations;
  if (!showVariationColumn) return { ctx, showVariationColumn: false };
  const variationLabels = await fetchVariationLabelMap(meta.id);
  return { ctx: { ...ctx, variationLabels }, showVariationColumn: true };
}

function summaryOnlySection(summary: ProductStockSummary): ProductReportSection {
  return {
    summary,
    rows: [],
    isEmpty: summary.movementCountInPeriod === 0,
  };
}

async function buildSectionFromCachedMovements(
  meta: CatalogProduct,
  movements: RawStockMovement[],
  filters: StockMovementReportFilters,
  hasBalance: boolean,
  ctx?: EnrichmentContext,
): Promise<ProductReportSection> {
  const typeFiltered = movements.filter((m) =>
    matchesMovementTypeFilter(m.movement_type, m.reference_type, filters.movementType),
  );
  const periodMovements = filterMovementsInPeriod(typeFiltered, filters.dateFrom, filters.dateTo);
  const currentStock = typeFiltered.reduce((s, m) => s + Number(m.quantity || 0), 0);
  const summary = buildProductSummary(
    {
      productId: meta.id,
      productName: meta.name,
      sku: meta.sku,
      category: meta.category || meta.subcategory,
      brand: meta.brand,
      unit: meta.unit,
    },
    typeFiltered,
    periodMovements,
    filters.dateFrom,
    filters.dateTo,
    currentStock,
    hasBalance,
  );
  const enrichmentBase = ctx ?? (await buildEnrichmentContext(periodMovements));
  const { ctx: enrichment, showVariationColumn } = await enrichWithVariationLabels(meta, filters, enrichmentBase);
  const rows = buildMovementReportRows(periodMovements, summary.openingStock, enrichment);
  return { summary, rows, isEmpty: periodMovements.length === 0, showVariationColumn };
}

async function buildEnrichmentContext(movements: RawStockMovement[]): Promise<EnrichmentContext> {
  return buildStockMovementEnrichment(movements);
}

async function fetchAllMovementsForProduct(
  companyId: string,
  productId: string,
  variationId?: string | null,
  branchId?: string | null,
): Promise<RawStockMovement[]> {
  const rows = await productService.getStockMovements(
    productId,
    companyId,
    variationId && variationId !== 'all' ? variationId : undefined,
    branchId ?? undefined,
  );
  return (rows || []).map((r: any) => ({
    id: r.id,
    created_at: r.created_at,
    movement_type: r.movement_type ?? r.type,
    quantity: Number(r.quantity || 0),
    unit_cost: r.unit_cost,
    total_cost: r.total_cost,
    reference_type: r.reference_type,
    reference_id: r.reference_id,
    notes: r.notes,
    branch_id: r.branch_id,
    variation_id: r.variation_id,
    created_by: r.created_by,
  }));
}

async function getProductLevelStock(
  companyId: string,
  productId: string,
  branchId?: string | null,
  variationId?: string | null,
): Promise<number> {
  if (variationId) {
    return inventoryService.getStock(companyId, productId, variationId, branchId);
  }
  let q = supabase
    .from('stock_movements')
    .select('quantity')
    .eq('company_id', companyId)
    .eq('product_id', productId);
  q = applyBranchStockMovementFilter(q, branchId);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).reduce((sum, row) => sum + (Number(row.quantity) || 0), 0);
}

async function hasInventoryBalanceRow(
  companyId: string,
  productId: string,
  branchId?: string | null,
): Promise<boolean> {
  let q = supabase
    .from('inventory_balance')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('product_id', productId);
  q = applyBranchStockMovementFilter(q, branchId);
  const { count, error } = await q;
  if (error) return false;
  return (count ?? 0) > 0;
}

async function fetchProductCatalog(companyId: string, filters: StockMovementReportFilters): Promise<CatalogProduct[]> {
  let q = supabase
    .from('products')
    .select(`
      id, name, sku, category_id, brand_id, is_active, has_variations,
      category:product_categories(id, name, parent_id),
      brand:brands(id, name),
      unit:units(id, name)
    `)
    .eq('company_id', companyId)
    .order('name');

  if (!filters.includeInactive) {
    q = q.eq('is_active', true);
  }
  if (filters.categoryId) {
    q = q.eq('category_id', filters.categoryId);
  }
  if (filters.subcategoryId) {
    q = q.eq('category_id', filters.subcategoryId);
  }
  if (filters.brandId) {
    q = q.eq('brand_id', filters.brandId);
  }

  const { data, error } = await q;
  if (error) {
    // Fallback when embed relations differ by schema (e.g. missing FK hint)
    let fb = supabase
      .from('products')
      .select('id, name, sku, category_id, brand_id, is_active, has_variations')
      .eq('company_id', companyId)
      .order('name');
    if (!filters.includeInactive) fb = fb.eq('is_active', true);
    if (filters.categoryId) fb = fb.eq('category_id', filters.categoryId);
    if (filters.subcategoryId) fb = fb.eq('category_id', filters.subcategoryId);
    if (filters.brandId) fb = fb.eq('brand_id', filters.brandId);
    const { data: fallback, error: fbErr } = await fb;
    if (fbErr) throw fbErr;
    let products: CatalogProduct[] = (fallback || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      sku: p.sku || '',
      category: null,
      subcategory: null,
      categoryId: p.category_id,
      subcategoryId: null,
      brand: null,
      brandId: p.brand_id,
      unit: null,
      isActive: p.is_active !== false,
      hasVariations: !!p.has_variations,
    }));
    if (filters.supplierId) {
      const productIdsWithSupplier = await fetchProductIdsBySupplier(
        companyId,
        filters.supplierId,
        filters.dateFrom,
        filters.dateTo,
      );
      const idSet = new Set(productIdsWithSupplier);
      products = products.filter((p) => idSet.has(p.id));
    }
    return products;
  }

  let products: CatalogProduct[] = (data || []).map((p: any) => {
    const cat = p.category;
    const isSub = cat?.parent_id != null;
    return {
      id: p.id,
      name: p.name,
      sku: p.sku || '',
      category: isSub ? null : cat?.name ?? null,
      subcategory: isSub ? cat?.name ?? null : null,
      categoryId: isSub ? cat?.parent_id ?? null : p.category_id,
      subcategoryId: isSub ? p.category_id : null,
      brand: p.brand?.name ?? null,
      brandId: p.brand_id,
      unit: p.unit?.name ?? null,
      isActive: p.is_active !== false,
      hasVariations: !!p.has_variations,
    };
  });

  if (filters.supplierId) {
    const productIdsWithSupplier = await fetchProductIdsBySupplier(
      companyId,
      filters.supplierId,
      filters.dateFrom,
      filters.dateTo,
    );
    const idSet = new Set(productIdsWithSupplier);
    products = products.filter((p) => idSet.has(p.id));
  }

  return products;
}

async function fetchProductIdsBySupplier(
  companyId: string,
  supplierId: string,
  dateFrom: string,
  dateTo: string,
): Promise<string[]> {
  const from = `${dateFrom}T00:00:00.000Z`;
  const to = `${dateTo}T23:59:59.999Z`;
  const { data: purchases } = await supabase
    .from('purchases')
    .select('id')
    .eq('company_id', companyId)
    .eq('supplier_id', supplierId)
    .gte('created_at', from)
    .lte('created_at', to);
  const purchaseIds = (purchases || []).map((p) => p.id);
  if (!purchaseIds.length) return [];

  const items = await fetchInBatches(purchaseIds, async (chunk) => {
    const { data, error } = await supabase
      .from('purchase_items')
      .select('product_id')
      .in('purchase_id', chunk);
    if (error) throw error;
    return data || [];
  });
  return [...new Set(items.map((i: any) => String(i.product_id)).filter(Boolean))];
}

function applyClientFilters(
  summaries: ProductStockSummary[],
  filters: StockMovementReportFilters,
): ProductStockSummary[] {
  return summaries.filter((s) => {
    if (!filters.includeZeroStock && s.currentStock === 0 && s.hasMovements) return false;
    if (!filters.includeNoTransaction && !s.hasMovements) return false;
    if (!matchesStockStatusFilter(s.status, filters.stockStatus)) return false;
    return true;
  });
}

async function buildSectionForProduct(
  meta: CatalogProduct,
  filters: StockMovementReportFilters,
  companyId: string,
): Promise<ProductReportSection> {
  const allMovements = await fetchAllMovementsForProduct(
    companyId,
    meta.id,
    filters.variationId,
    filters.branchId,
  );

  const typeFiltered = allMovements.filter((m) =>
    matchesMovementTypeFilter(m.movement_type, m.reference_type, filters.movementType),
  );

  const periodMovements = filterMovementsInPeriod(typeFiltered, filters.dateFrom, filters.dateTo);
  const currentStock = await getProductLevelStock(companyId, meta.id, filters.branchId, filters.variationId);
  const hasBalance = await hasInventoryBalanceRow(companyId, meta.id, filters.branchId);

  const summary = buildProductSummary(
    {
      productId: meta.id,
      productName: meta.name,
      sku: meta.sku,
      category: meta.category || meta.subcategory,
      brand: meta.brand,
      unit: meta.unit,
    },
    typeFiltered,
    periodMovements,
    filters.dateFrom,
    filters.dateTo,
    currentStock,
    hasBalance,
  );

  const ctxBase = await buildEnrichmentContext(periodMovements);
  const { ctx, showVariationColumn } = await enrichWithVariationLabels(meta, filters, ctxBase);
  const opening = summary.openingStock;
  const rows = buildMovementReportRows(periodMovements, opening, ctx);

  return {
    summary,
    rows,
    isEmpty: periodMovements.length === 0,
    showVariationColumn,
  };
}

export const stockMovementHistoryReportService = {
  PAGE_SIZE,
  LARGE_PRODUCT_THRESHOLD,
  EXPAND_ALL_MAX: 25,

  async searchProducts(companyId: string, term: string, limit = 20, includeInactive = false): Promise<CatalogProduct[]> {
    let q = supabase
      .from('products')
      .select('id, name, sku, has_variations, is_active')
      .eq('company_id', companyId)
      .order('name')
      .limit(limit);
    if (!includeInactive) {
      q = q.eq('is_active', true);
    }
    if (term.trim()) {
      const t = term.trim();
      q = q.or(`name.ilike.%${t}%,sku.ilike.%${t}%`);
    }
    const { data, error } = await q;
    if (error) throw error;
    return (data || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      sku: p.sku || '',
      category: null,
      subcategory: null,
      categoryId: null,
      subcategoryId: null,
      brand: null,
      brandId: null,
      unit: null,
      isActive: p.is_active !== false,
      hasVariations: !!p.has_variations,
    }));
  },

  async fetchCategories(companyId: string): Promise<{ id: string; name: string; parentId: string | null }[]> {
    const { data, error } = await supabase
      .from('product_categories')
      .select('id, name, parent_id')
      .eq('company_id', companyId)
      .order('name');
    if (error) throw error;
    return (data || []).map((c: any) => ({ id: c.id, name: c.name, parentId: c.parent_id }));
  },

  async fetchBrands(companyId: string): Promise<{ id: string; name: string }[]> {
    const { data, error } = await supabase
      .from('brands')
      .select('id, name')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('name');
    if (error) throw error;
    return (data || []).map((b: any) => ({ id: b.id, name: b.name }));
  },

  async fetchSuppliers(companyId: string): Promise<{ id: string; name: string }[]> {
    const { data, error } = await supabase
      .from('contacts')
      .select('id, name')
      .eq('company_id', companyId)
      .in('type', ['supplier', 'both'])
      .order('name')
      .limit(500);
    if (error) throw error;
    return (data || []).map((c: any) => ({ id: c.id, name: c.name }));
  },

  async runSingleProductReport(
    companyId: string,
    filters: StockMovementReportFilters,
  ): Promise<ProductReportSection | null> {
    if (!filters.productId) return null;
    const catalog = await fetchProductCatalog(companyId, { ...filters, productId: filters.productId });
    const meta = catalog.find((p) => p.id === filters.productId);
    if (!meta) {
      const { data } = await supabase
        .from('products')
        .select('id, name, sku, has_variations, is_active')
        .eq('id', filters.productId)
        .maybeSingle();
      if (!data) return null;
      return buildSectionForProduct(
        {
          id: data.id,
          name: data.name,
          sku: data.sku || '',
          category: null,
          subcategory: null,
          categoryId: null,
          subcategoryId: null,
          brand: null,
          brandId: null,
          unit: null,
          isActive: data.is_active !== false,
          hasVariations: !!data.has_variations,
        },
        filters,
        companyId,
      );
    }
    return buildSectionForProduct(meta, filters, companyId);
  },

  /** All filtered summaries in one call (uses batch cache). */
  async fetchAllProductSummaries(
    companyId: string,
    filters: StockMovementReportFilters,
  ): Promise<{ summaries: ProductStockSummary[]; totalCount: number; largeReportWarning: boolean }> {
    const batch = await loadSummaryBatchData(companyId, filters);
    return {
      summaries: batch.filteredSummaries,
      totalCount: batch.filteredSummaries.length,
      largeReportWarning: batch.largeReportWarning,
    };
  },

  async fetchProductSummariesPage(
    companyId: string,
    filters: StockMovementReportFilters,
    page = 1,
    pageSize = PAGE_SIZE,
  ): Promise<ProductSummaryListResult> {
    const batch = await loadSummaryBatchData(companyId, filters);
    const totalCount = batch.filteredSummaries.length;
    const start = (page - 1) * pageSize;
    const pageItems = batch.filteredSummaries.slice(start, start + pageSize);

    return {
      products: pageItems,
      totalCount,
      page,
      pageSize,
      largeReportWarning: batch.largeReportWarning,
    };
  },

  /** Summary-only sections for instant preview after All Products run. */
  buildSummaryOnlySections(summaries: ProductStockSummary[]): ProductReportSection[] {
    return summaries.map(summaryOnlySection);
  },

  clearSummaryCache(): void {
    summaryBatchCache = null;
  },

  async fetchProductDetail(
    companyId: string,
    productId: string,
    filters: StockMovementReportFilters,
  ): Promise<ProductReportSection> {
    const batch = await loadSummaryBatchData(companyId, filters);
    let meta = batch.catalog.find((p) => p.id === productId);
    if (!meta) {
      const { data } = await supabase.from('products').select('id, name, sku, has_variations').eq('id', productId).maybeSingle();
      meta = {
        id: productId,
        name: data?.name || 'Unknown',
        sku: data?.sku || '',
        category: null,
        subcategory: null,
        categoryId: null,
        subcategoryId: null,
        brand: null,
        brandId: null,
        unit: null,
        isActive: true,
        hasVariations: !!data?.has_variations,
      };
      return buildSectionForProduct(meta, filters, companyId);
    }
    const movements = batch.movementsByProduct.get(productId) ?? [];
    return buildSectionFromCachedMovements(
      meta,
      movements,
      filters,
      batch.balanceProductIds.has(productId),
    );
  },

  async fetchAllSectionsForExport(
    companyId: string,
    filters: StockMovementReportFilters,
    productIds?: string[],
  ): Promise<ProductReportSection[]> {
    const batch = await loadSummaryBatchData(companyId, filters);
    const summaryMap = new Map(batch.filteredSummaries.map((s) => [s.productId, s]));
    let targets = batch.catalog.filter((p) => summaryMap.has(p.id));
    if (productIds?.length) {
      const idSet = new Set(productIds);
      targets = targets.filter((p) => idSet.has(p.id));
    }

    const allPeriodMovements: RawStockMovement[] = [];
    for (const meta of targets) {
      const movements = batch.movementsByProduct.get(meta.id) ?? [];
      const typeFiltered = movements.filter((m) =>
        matchesMovementTypeFilter(m.movement_type, m.reference_type, filters.movementType),
      );
      allPeriodMovements.push(...filterMovementsInPeriod(typeFiltered, filters.dateFrom, filters.dateTo));
    }
    const sharedCtx = await buildEnrichmentContext(allPeriodMovements);

    const sections: ProductReportSection[] = [];
    for (const meta of targets) {
      const movements = batch.movementsByProduct.get(meta.id) ?? [];
      sections.push(
        await buildSectionFromCachedMovements(
          meta,
          movements,
          filters,
          batch.balanceProductIds.has(meta.id),
          sharedCtx,
        ),
      );
    }
    return sections;
  },
};
