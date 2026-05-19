/**
 * Products CSV profile — canonical headers, parse, catalog validation, commit.
 * Client-only; uses existing services (no schema / trigger changes).
 */

import { parseCsvToStructured } from '../parseCsv';
import { serializeCsvMatrix } from '../serializeCsv';
import { DEFAULT_IMPORT_CHUNK_SIZE, runChunkedAllSettled } from '../chunkedCommit';
import type { CsvEntityProfile, CsvRowValidation, CsvWorkbenchResult, ParsedCsv } from '../types';
import type { CsvPreviewColumn } from '../components/CsvPreviewDataGrid';
import { productService } from '@/app/services/productService';
import { inventoryService } from '@/app/services/inventoryService';
import { productCategoryService } from '@/app/services/productCategoryService';
import { unitService } from '@/app/services/unitService';
import { brandService } from '@/app/services/brandService';
import type { DocumentType } from '@/app/hooks/useDocumentNumbering';

/** Header order = template = export round-trip (matches legacy ImportProductsModal). */
export const PRODUCT_CANONICAL_HEADERS = [
  'name',
  'sku',
  'category',
  'subcategory',
  'unit',
  'brand',
  'cost_price',
  'selling_price',
  'wholesale_price',
  'opening_stock',
  'min_stock',
  'max_stock',
  'track_stock',
  'is_sellable',
  'barcode',
  'description',
  'image_url',
  'variation_name',
  'variation_sku',
  'variation_barcode',
] as const;

/** Column layout for `CsvPreviewDataGrid` (canonical keys). */
export const PRODUCT_PREVIEW_COLUMNS: CsvPreviewColumn[] = PRODUCT_CANONICAL_HEADERS.map((key) => ({
  key,
  label: key,
}));


/** Case-insensitive header aliases → canonical field keys */
export const PRODUCT_CSV_HEADER_ALIASES: Record<string, string> = {
  name: 'name',
  'product name': 'name',
  sku: 'sku',
  category: 'category',
  unit: 'unit',
  brand: 'brand',
  'cost price': 'cost_price',
  'purchase price': 'cost_price',
  purchase_price: 'cost_price',
  cost_price: 'cost_price',
  'selling price': 'selling_price',
  'retail price': 'selling_price',
  retail_price: 'selling_price',
  selling_price: 'selling_price',
  'wholesale price': 'wholesale_price',
  wholesale_price: 'wholesale_price',
  'opening stock': 'opening_stock',
  opening_stock: 'opening_stock',
  'initial stock': 'opening_stock',
  quantity: 'opening_stock',
  qty: 'opening_stock',
  'min stock': 'min_stock',
  min_stock: 'min_stock',
  'max stock': 'max_stock',
  max_stock: 'max_stock',
  'track stock': 'track_stock',
  track_stock: 'track_stock',
  'is rentable': 'is_rentable',
  is_rentable: 'is_rentable',
  'is sellable': 'is_sellable',
  is_sellable: 'is_sellable',
  barcode: 'barcode',
  description: 'description',
  'variation name': 'variation_name',
  variation_name: 'variation_name',
  variation: 'variation_name',
  variant: 'variation_name',
  'variation sku': 'variation_sku',
  variation_sku: 'variation_sku',
  'variation barcode': 'variation_barcode',
  variation_barcode: 'variation_barcode',
  subcategory: 'subcategory',
  'sub category': 'subcategory',
  sub_category: 'subcategory',
  'image url': 'image_url',
  image_url: 'image_url',
};

export interface ParsedProductRow {
  name: string;
  sku: string;
  category?: string;
  unit?: string;
  brand?: string;
  cost_price: number;
  selling_price: number;
  wholesale_price?: number;
  opening_stock: number;
  min_stock?: number;
  max_stock?: number;
  track_stock?: boolean;
  is_sellable?: boolean;
  barcode?: string;
  description?: string;
  variation_name?: string;
  variation_sku?: string;
  variation_barcode?: string;
  subcategory?: string;
  image_url?: string;
}

export interface ImportRowError {
  groupKey: string;
  productName: string;
  rowIndex: number;
  message: string;
  type: 'validation' | 'failed';
}

export interface ImportSummary {
  created: number;
  skipped: number;
  failed: number;
  errors: ImportRowError[];
}

export type ProductCatalogContext = {
  categoryByName: Map<string, string>;
  subcategoryByCategoryAndName: Map<string, string>;
  unitByName: Map<string, string>;
  units: { id: string; name: string; short_code?: string | null }[];
  brandByName: Map<string, string>;
};

function parseBool(v: string): boolean {
  const t = (v ?? '').trim().toLowerCase();
  return t === 'yes' || t === '1' || t === 'true' || t === 'y';
}

/** Blank template: header row + one empty data row (Excel-friendly). */
export function buildProductsBlankTemplate(): string {
  const emptyRow = PRODUCT_CANONICAL_HEADERS.map(() => '');
  return serializeCsvMatrix([[...PRODUCT_CANONICAL_HEADERS], emptyRow]);
}

/** Example rows for documentation / optional sample download (not used for blank template). */
export function buildProductsSampleTemplate(): string {
  return serializeCsvMatrix([
    [...PRODUCT_CANONICAL_HEADERS],
    [
      'T-Shirt Basic',
      'TSH-001',
      'Apparel',
      '',
      'Piece',
      'Brand A',
      '80',
      '200',
      '160',
      '0',
      '5',
      '500',
      'yes',
      'yes',
      '',
      'Plain t-shirt',
      '',
      '',
      '',
      '',
    ],
    [
      'T-Shirt Basic',
      'TSH-001',
      'Apparel',
      '',
      'Piece',
      'Brand A',
      '80',
      '200',
      '160',
      '10',
      '',
      '',
      'yes',
      'yes',
      '',
      '',
      '',
      'Size: S',
      'TSH-001-S',
      '',
    ],
  ]);
}

function buildHeaderIndexMap(headers: string[]): Record<string, number> {
  const colMap: Record<string, number> = {};
  headers.forEach((raw, i) => {
    const h = raw.trim().toLowerCase();
    const key = PRODUCT_CSV_HEADER_ALIASES[h] ?? h.replace(/\s+/g, '_');
    colMap[key] = i;
  });
  return colMap;
}

export function rowsFromParsedCsv(parsed: ParsedCsv): ParsedProductRow[] {
  const header = parsed.headers.map((h) => h.trim().toLowerCase());
  const colMap = buildHeaderIndexMap(parsed.headers);
  const nameIdx = colMap.name ?? header.findIndex((h) => PRODUCT_CSV_HEADER_ALIASES[h] === 'name');
  const skuIdx = colMap.sku ?? header.findIndex((h) => PRODUCT_CSV_HEADER_ALIASES[h] === 'sku');
  if (nameIdx < 0) return [];

  const rows: ParsedProductRow[] = [];
  for (const cells of parsed.rows) {
    const name = (cells[nameIdx] ?? '').trim();
    if (!name) continue;
    const skuRaw = (cells[skuIdx] ?? '').trim();
    const costPrice = parseFloat(cells[colMap.cost_price ?? -1] ?? '0') || 0;
    const sellingPrice = parseFloat(cells[colMap.selling_price ?? -1] ?? '0') || 0;
    const wholesalePrice = parseFloat(cells[colMap.wholesale_price ?? -1] ?? '') || undefined;
    const openingStock = parseFloat(cells[colMap.opening_stock ?? -1] ?? '0') || 0;
    const minStock = parseInt(cells[colMap.min_stock ?? -1] ?? '', 10);
    const maxStock = parseInt(cells[colMap.max_stock ?? -1] ?? '', 10);
    const variationName = (cells[colMap.variation_name ?? -1] ?? '').trim() || undefined;
    const variationSku = (cells[colMap.variation_sku ?? -1] ?? '').trim() || undefined;
    const variationBarcode = (cells[colMap.variation_barcode ?? -1] ?? '').trim() || undefined;
    const trackStockRaw = (cells[colMap.track_stock ?? -1] ?? '').trim().toLowerCase();
    const isSellableRaw = (cells[colMap.is_sellable ?? -1] ?? '').trim().toLowerCase();
    const subcategory = (cells[colMap.subcategory ?? -1] ?? '').trim() || undefined;
    const imageUrl = (cells[colMap.image_url ?? -1] ?? '').trim() || undefined;
    rows.push({
      name,
      sku: skuRaw || '',
      category: (cells[colMap.category ?? -1] ?? '').trim() || undefined,
      subcategory,
      unit: (cells[colMap.unit ?? -1] ?? '').trim() || undefined,
      brand: (cells[colMap.brand ?? -1] ?? '').trim() || undefined,
      cost_price: costPrice,
      selling_price: sellingPrice,
      wholesale_price: wholesalePrice,
      opening_stock: openingStock,
      min_stock: Number.isNaN(minStock) ? undefined : minStock,
      max_stock: Number.isNaN(maxStock) ? undefined : maxStock,
      track_stock: trackStockRaw ? parseBool(trackStockRaw) : undefined,
      is_sellable: isSellableRaw ? parseBool(isSellableRaw) : undefined,
      barcode: (cells[colMap.barcode ?? -1] ?? '').trim() || undefined,
      description: (cells[colMap.description ?? -1] ?? '').trim() || undefined,
      variation_name: variationName,
      variation_sku: variationSku,
      variation_barcode: variationBarcode,
      image_url: imageUrl,
    });
  }
  return rows;
}

const VARIANT_LIKE = /^(Size|Color|Variant|Style):\s*.+|^(SMALL|MEDIUM|LARGE|S|M|L|XL|XXL)$/i;

/** Mutates rows in-place — same heuristics as legacy ImportProductsModal. */
export function normalizeProductVariationHeuristics(groups: Map<string, ParsedProductRow[]>): void {
  for (const rows of groups.values()) {
    for (const row of rows) {
      if (row.variation_name) continue;
      if (row.description && VARIANT_LIKE.test(row.description.trim())) {
        row.variation_name = row.description.trim();
        row.description = undefined;
      }
      if (row.image_url && !/^https?:\/\//i.test(row.image_url) && row.image_url.length <= 20 && !row.variation_sku) {
        row.variation_sku = row.image_url.trim();
        row.image_url = undefined;
      }
    }
  }
}

export function groupKeyForProduct(row: ParsedProductRow, autoSkuLabel: boolean): string {
  const skuPart = row.sku || (autoSkuLabel ? '(auto)' : '');
  return `${row.name}|${skuPart || '(auto)'}`;
}

export function groupProductRows(rows: ParsedProductRow[], autoSkuLabel: boolean): Map<string, ParsedProductRow[]> {
  const groups = new Map<string, ParsedProductRow[]>();
  for (const row of rows) {
    const key = groupKeyForProduct(row, autoSkuLabel);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }
  return groups;
}

export type ParsedProductRowWithIndex = ParsedProductRow & { _sourceRowIndex: number };

export function rowsFromParsedCsvWithIndices(parsed: ParsedCsv): ParsedProductRowWithIndex[] {
  const header = parsed.headers.map((h) => h.trim().toLowerCase());
  const colMap = buildHeaderIndexMap(parsed.headers);
  const nameIdx = colMap.name ?? header.findIndex((h) => PRODUCT_CSV_HEADER_ALIASES[h] === 'name');
  const skuIdx = colMap.sku ?? header.findIndex((h) => PRODUCT_CSV_HEADER_ALIASES[h] === 'sku');
  if (nameIdx < 0) return [];

  const out: ParsedProductRowWithIndex[] = [];
  for (let ri = 0; ri < parsed.rows.length; ri++) {
    const cells = parsed.rows[ri]!;
    const name = (cells[nameIdx] ?? '').trim();
    if (!name) continue;
    const skuRaw = (cells[skuIdx] ?? '').trim();
    const costPrice = parseFloat(cells[colMap.cost_price ?? -1] ?? '0') || 0;
    const sellingPrice = parseFloat(cells[colMap.selling_price ?? -1] ?? '0') || 0;
    const wholesalePrice = parseFloat(cells[colMap.wholesale_price ?? -1] ?? '') || undefined;
    const openingStock = parseFloat(cells[colMap.opening_stock ?? -1] ?? '0') || 0;
    const minStock = parseInt(cells[colMap.min_stock ?? -1] ?? '', 10);
    const maxStock = parseInt(cells[colMap.max_stock ?? -1] ?? '', 10);
    const variationName = (cells[colMap.variation_name ?? -1] ?? '').trim() || undefined;
    const variationSku = (cells[colMap.variation_sku ?? -1] ?? '').trim() || undefined;
    const variationBarcode = (cells[colMap.variation_barcode ?? -1] ?? '').trim() || undefined;
    const trackStockRaw = (cells[colMap.track_stock ?? -1] ?? '').trim().toLowerCase();
    const isSellableRaw = (cells[colMap.is_sellable ?? -1] ?? '').trim().toLowerCase();
    const subcategory = (cells[colMap.subcategory ?? -1] ?? '').trim() || undefined;
    const imageUrl = (cells[colMap.image_url ?? -1] ?? '').trim() || undefined;
    out.push({
      _sourceRowIndex: ri + 2,
      name,
      sku: skuRaw || '',
      category: (cells[colMap.category ?? -1] ?? '').trim() || undefined,
      subcategory,
      unit: (cells[colMap.unit ?? -1] ?? '').trim() || undefined,
      brand: (cells[colMap.brand ?? -1] ?? '').trim() || undefined,
      cost_price: costPrice,
      selling_price: sellingPrice,
      wholesale_price: wholesalePrice,
      opening_stock: openingStock,
      min_stock: Number.isNaN(minStock) ? undefined : minStock,
      max_stock: Number.isNaN(maxStock) ? undefined : maxStock,
      track_stock: trackStockRaw ? parseBool(trackStockRaw) : undefined,
      is_sellable: isSellableRaw ? parseBool(isSellableRaw) : undefined,
      barcode: (cells[colMap.barcode ?? -1] ?? '').trim() || undefined,
      description: (cells[colMap.description ?? -1] ?? '').trim() || undefined,
      variation_name: variationName,
      variation_sku: variationSku,
      variation_barcode: variationBarcode,
      image_url: imageUrl,
    });
  }
  return out;
}

export function validateProductsStructuralIndexed(
  rows: ParsedProductRowWithIndex[],
  autoGenerateSku: boolean
): CsvRowValidation[] {
  const issues: CsvRowValidation[] = [];
  for (const r of rows) {
    if (!Number.isFinite(r.selling_price)) {
      issues.push({
        rowIndex: r._sourceRowIndex,
        severity: 'error',
        field: 'selling_price',
        message: 'Selling price must be a valid number',
      });
    }
    if (!autoGenerateSku && !r.sku?.trim()) {
      issues.push({
        rowIndex: r._sourceRowIndex,
        severity: 'error',
        field: 'sku',
        message: 'SKU required unless auto-generate is enabled',
      });
    }
  }
  return issues;
}

export async function loadProductCatalogContext(companyId: string): Promise<ProductCatalogContext> {
  const [categoriesFlat, units, brands] = await Promise.all([
    productCategoryService.getAllCategoriesFlat(companyId, { includeInactive: true }),
    unitService.getAll(companyId, { includeInactive: true }),
    brandService.getAll(companyId, { includeInactive: true }),
  ]);

  const topLevelCategories = categoriesFlat.filter((c: { parent_id: string | null }) => !c.parent_id);
  const categoryByName = new Map<string, string>(
    topLevelCategories.map((c: { name: string; id: string }) => [c.name.toLowerCase(), c.id])
  );
  const subcategoryByCategoryAndName = new Map<string, string>();
  categoriesFlat.forEach((c: { parent_id: string | null; name: string; id: string }) => {
    if (c.parent_id) {
      subcategoryByCategoryAndName.set(`${c.parent_id}|${c.name.toLowerCase()}`, c.id);
    }
  });

  const unitPairs: [string, string][] = [
    ...units.map((u: { name: string; id: string }) => [u.name.toLowerCase(), u.id] as [string, string]),
    ...units
      .map((u: { short_code?: string | null; id: string }) => [(u.short_code || '').toLowerCase(), u.id] as [string, string])
      .filter(([k]) => k.length > 0),
  ];
  const unitByName = new Map<string, string>(unitPairs);
  const brandByName = new Map<string, string>(brands.map((b: { name: string; id: string }) => [b.name.toLowerCase(), b.id]));

  return { categoryByName, subcategoryByCategoryAndName, unitByName, units, brandByName };
}

export type ProductCommitDeps = {
  companyId: string;
  branchIdOrNull: string | null;
  catalog: ProductCatalogContext;
  autoGenerateSku: boolean;
  /** When true, create missing category / subcategory / unit / brand via existing services */
  autoCreateCatalog: boolean;
  generateDocumentNumberSafe: (docType: DocumentType) => Promise<string>;
  incrementNextNumber: (docType: DocumentType) => void;
};

export type ResolvedProductCatalogIds = {
  categoryId: string | null;
  unitId: string | null;
  brandId: string | null;
  error?: string;
};

/**
 * Resolve (and optionally create) category, unit, brand for one product group.
 * Mutates `catalog` maps when auto-create succeeds.
 */
export async function resolveProductCatalogIds(
  companyId: string,
  catalog: ProductCatalogContext,
  first: ParsedProductRow,
  autoCreateMissing: boolean
): Promise<ResolvedProductCatalogIds> {
  const { categoryByName, subcategoryByCategoryAndName, unitByName, units, brandByName } = catalog;

  if (first.subcategory && !first.category) {
    return { categoryId: null, unitId: null, brandId: null, error: 'Subcategory requires category' };
  }

  let categoryId: string | null = null;
  if (first.category) {
    const catKey = first.category.toLowerCase();
    let catId = categoryByName.get(catKey) ?? null;
    if (!catId && autoCreateMissing) {
      try {
        const created = await productCategoryService.create({
          company_id: companyId,
          name: first.category.trim(),
        });
        catId = created.id;
        categoryByName.set(catKey, catId);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to create category';
        return { categoryId: null, unitId: null, brandId: null, error: msg };
      }
    }
    if (!catId) {
      return {
        categoryId: null,
        unitId: null,
        brandId: null,
        error: `Category "${first.category}" not found`,
      };
    }
    if (first.subcategory) {
      const subKey = `${catId}|${first.subcategory.trim().toLowerCase()}`;
      let subId = subcategoryByCategoryAndName.get(subKey) ?? null;
      if (!subId && autoCreateMissing) {
        try {
          const created = await productCategoryService.create({
            company_id: companyId,
            name: first.subcategory.trim(),
            parent_id: catId,
          });
          subId = created.id;
          subcategoryByCategoryAndName.set(subKey, subId);
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Failed to create subcategory';
          return { categoryId: null, unitId: null, brandId: null, error: msg };
        }
      }
      if (!subId) {
        return {
          categoryId: null,
          unitId: null,
          brandId: null,
          error: `Subcategory "${first.subcategory}" not found or does not belong to category "${first.category}"`,
        };
      }
      categoryId = subId;
    } else {
      categoryId = catId;
    }
  }

  let unitId: string | null = null;
  if (first.unit) {
    const uKey = first.unit.trim().toLowerCase();
    unitId = unitByName.get(uKey) ?? units.find((u) => (u.short_code || '').toLowerCase() === uKey)?.id ?? null;
    if (!unitId && autoCreateMissing) {
      try {
        const created = await unitService.create({
          company_id: companyId,
          name: first.unit.trim(),
          short_code: first.unit.trim().slice(0, 10),
        });
        unitId = created.id;
        unitByName.set(uKey, unitId);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to create unit';
        return { categoryId, unitId: null, brandId: null, error: msg };
      }
    }
    if (!unitId) {
      return { categoryId, unitId: null, brandId: null, error: `Unit "${first.unit}" not found` };
    }
  }

  let brandId: string | null = null;
  if (first.brand) {
    const bKey = first.brand.toLowerCase();
    if (!brandByName.has(bKey)) {
      if (autoCreateMissing) {
        try {
          const created = await brandService.create({ company_id: companyId, name: first.brand.trim() });
          brandByName.set(bKey, created.id);
          brandId = created.id;
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Failed to create brand';
          return { categoryId, unitId, brandId: null, error: msg };
        }
      } else {
        return { categoryId, unitId, brandId: null, error: `Brand "${first.brand}" not found` };
      }
    } else {
      brandId = brandByName.get(bKey) ?? null;
    }
  }

  return { categoryId, unitId, brandId };
}

/** Dry-run catalog check (never writes to DB). */
export function checkProductCatalogRefsDry(
  catalog: ProductCatalogContext,
  first: ParsedProductRow
): string | undefined {
  if (first.subcategory && !first.category) return 'Subcategory requires category';
  if (first.category) {
    const catId = catalog.categoryByName.get(first.category.toLowerCase());
    if (!catId) return `Category "${first.category}" not found`;
    if (first.subcategory) {
      const subId = catalog.subcategoryByCategoryAndName.get(
        `${catId}|${first.subcategory.trim().toLowerCase()}`
      );
      if (!subId) {
        return `Subcategory "${first.subcategory}" not found or does not belong to category "${first.category}"`;
      }
    }
  }
  if (first.unit) {
    const uKey = first.unit.trim().toLowerCase();
    const unitId =
      catalog.unitByName.get(uKey) ??
      catalog.units.find((u) => (u.short_code || '').toLowerCase() === uKey)?.id;
    if (!unitId) return `Unit "${first.unit}" not found`;
  }
  if (first.brand && !catalog.brandByName.has(first.brand.toLowerCase())) {
    return `Brand "${first.brand}" not found`;
  }
  return undefined;
}

/** Preview-time catalog checks (one validation pass per product group; read-only). */
export async function validateProductsCatalogForPreview(
  companyId: string,
  rows: ParsedProductRowWithIndex[],
  autoCreateCatalog: boolean
): Promise<CsvRowValidation[]> {
  const catalog = await loadProductCatalogContext(companyId);
  const issues: CsvRowValidation[] = [];
  const seenGroups = new Set<string>();

  for (const row of rows) {
    const gk = groupKeyForProduct(row, true);
    if (seenGroups.has(gk)) continue;
    seenGroups.add(gk);

    const dryError = checkProductCatalogRefsDry(catalog, row);
    if (dryError) {
      if (autoCreateCatalog) {
        const hints: string[] = [];
        if (row.category && dryError.includes('Category')) hints.push(`will create category "${row.category}"`);
        if (row.unit && dryError.includes('Unit')) hints.push(`will create unit "${row.unit}"`);
        if (row.brand && dryError.includes('Brand')) hints.push(`will create brand "${row.brand}"`);
        if (row.subcategory && dryError.includes('Subcategory')) {
          hints.push(`will create subcategory "${row.subcategory}"`);
        }
        if (hints.length) {
          issues.push({ rowIndex: row._sourceRowIndex, severity: 'warning', message: hints.join('; ') });
        } else {
          issues.push({ rowIndex: row._sourceRowIndex, severity: 'error', message: dryError });
        }
      } else {
        issues.push({ rowIndex: row._sourceRowIndex, severity: 'error', message: dryError });
      }
    }
  }

  return issues;
}

/** Map validations keyed by 0-based index into `rows` for CsvPreviewDataGrid. */
export function rowErrorsMapForPreview(
  rows: ParsedProductRowWithIndex[],
  validations: CsvRowValidation[]
): Map<number, CsvRowValidation[]> {
  const bySourceRow = new Map<number, CsvRowValidation[]>();
  for (const v of validations) {
    const list = bySourceRow.get(v.rowIndex) ?? [];
    list.push(v);
    bySourceRow.set(v.rowIndex, list);
  }
  const map = new Map<number, CsvRowValidation[]>();
  rows.forEach((r, i) => {
    const list = bySourceRow.get(r._sourceRowIndex);
    if (list?.length) map.set(i, list);
  });
  return map;
}

export function productRowToPreviewRecord(row: ParsedProductRowWithIndex): Record<string, string | number> {
  return {
    name: row.name,
    sku: row.sku || '(auto)',
    category: row.category ?? '',
    variation_name: row.variation_name ?? '',
    cost_price: row.cost_price,
    selling_price: row.selling_price,
    opening_stock: row.opening_stock,
  };
}

function stripIndex(row: ParsedProductRowWithIndex): ParsedProductRow {
  const { _sourceRowIndex: _idx, ...rest } = row;
  void _idx;
  return rest;
}

function representativeRowIndex(rowsWithIndex: ParsedProductRowWithIndex[], first: ParsedProductRow): number {
  const indices = rowsWithIndex
    .filter((r) => r.name === first.name && (r.sku || '') === (first.sku || ''))
    .map((r) => r._sourceRowIndex);
  return indices.length ? Math.min(...indices) : 1;
}

/**
 * Import one product group. Mutates shared `catalog` when auto-creating refs; parallel groups
 * may race on the same new name — DB/services handle uniqueness. Variations + stock stay
 * sequential inside this group.
 */
async function importOneProductGroup(
  key: string,
  rows: ParsedProductRow[],
  rowsWithIndex: ParsedProductRowWithIndex[],
  deps: ProductCommitDeps
): Promise<{ status: 'created' | 'skipped' | 'failed'; error?: ImportRowError }> {
  const {
    companyId,
    branchIdOrNull,
    catalog,
    autoGenerateSku,
    autoCreateCatalog,
    generateDocumentNumberSafe,
    incrementNextNumber,
  } = deps;

  const hasVariations = rows.some((r) => r.variation_name);
  const first = rows[0]!;
  const rowIndex = representativeRowIndex(rowsWithIndex, first);

  const resolved = await resolveProductCatalogIds(companyId, catalog, first, autoCreateCatalog);
  if (resolved.error) {
    return {
      status: 'skipped',
      error: {
        groupKey: key,
        productName: first.name,
        rowIndex,
        message: resolved.error,
        type: 'validation',
      },
    };
  }
  const { categoryId, unitId, brandId } = resolved;

  let skuToUse = first.sku && !autoGenerateSku ? first.sku : '';
  if (!skuToUse) {
    try {
      skuToUse = await generateDocumentNumberSafe('production');
    } catch {
      return {
        status: 'failed',
        error: {
          groupKey: key,
          productName: first.name,
          rowIndex,
          message: 'Failed to generate SKU',
          type: 'failed',
        },
      };
    }
  }

  try {
    const productData: Record<string, unknown> = {
      company_id: companyId,
      category_id: categoryId,
      brand_id: brandId,
      unit_id: unitId,
      name: first.name,
      sku: skuToUse,
      barcode: first.barcode || null,
      description: first.description || null,
      cost_price: first.cost_price,
      retail_price: first.selling_price,
      wholesale_price: first.wholesale_price ?? first.selling_price,
      current_stock: 0,
      min_stock: first.min_stock ?? 0,
      max_stock: first.max_stock ?? 1000,
      has_variations: hasVariations,
      is_rentable: false,
      is_sellable: first.is_sellable ?? true,
      track_stock: first.track_stock ?? true,
      is_active: true,
      is_combo_product: false,
    };
    if (first.image_url) {
      productData.image_urls = [first.image_url];
    }

    const product = await productService.createProduct(productData);
    if (!product?.id) {
      return {
        status: 'failed',
        error: {
          groupKey: key,
          productName: first.name,
          rowIndex,
          message: 'Create product returned no ID',
          type: 'failed',
        },
      };
    }

    if (autoGenerateSku || !first.sku) {
      incrementNextNumber('production');
    }

    if (!hasVariations) {
      const row = rows[0]!;
      if (row.opening_stock > 0) {
        const { error: movErr } = await inventoryService.insertOpeningBalanceMovement(
          companyId,
          branchIdOrNull,
          product.id,
          row.opening_stock,
          row.cost_price
        );
        if (movErr) {
          return {
            status: 'failed',
            error: {
              groupKey: key,
              productName: first.name,
              rowIndex,
              message: movErr.message || 'Opening stock failed',
              type: 'failed',
            },
          };
        }
      }
      return { status: 'created' };
    }

    const variationRows = rows.filter((r) => r.variation_name);
    for (const row of variationRows) {
      const varSku = row.variation_sku?.trim() || `${skuToUse}-${(row.variation_name ?? '').replace(/\s+/g, '-')}`;
      const varRecord = await productService.createVariation({
        product_id: product.id,
        name: row.variation_name!,
        sku: varSku,
        barcode: row.variation_barcode || null,
        attributes: { variant: row.variation_name! },
        cost_price: row.cost_price,
        retail_price: row.selling_price,
        wholesale_price: row.wholesale_price ?? row.selling_price,
        current_stock: 0,
      });
      if (row.opening_stock > 0 && varRecord?.id) {
        await inventoryService.insertOpeningBalanceMovement(
          companyId,
          branchIdOrNull,
          product.id,
          row.opening_stock,
          row.cost_price,
          varRecord.id
        );
      }
    }
    return { status: 'created' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return {
      status: 'failed',
      error: { groupKey: key, productName: first.name, rowIndex, message: msg, type: 'failed' },
    };
  }
}

/**
 * Import product groups — same behavior as legacy ImportProductsModal.handleImport.
 * Groups are committed in parallel chunks (Promise.allSettled) for throughput.
 */
export async function commitProductImport(
  rowsWithIndex: ParsedProductRowWithIndex[],
  deps: ProductCommitDeps
): Promise<ImportSummary> {
  const errors: ImportRowError[] = [];
  let created = 0;
  let skipped = 0;
  let failed = 0;

  const plainRows = rowsWithIndex.map(stripIndex);
  const groups = groupProductRows(plainRows, true);
  normalizeProductVariationHeuristics(groups);

  const groupEntries = Array.from(groups.entries());
  const settled = await runChunkedAllSettled(
    groupEntries,
    DEFAULT_IMPORT_CHUNK_SIZE,
    ([key, rows]) => importOneProductGroup(key, rows, rowsWithIndex, deps)
  );

  let gi = 0;
  for (const s of settled) {
    const [key, rows] = groupEntries[gi++]!;
    const first = rows[0];
    const rowIndex = first ? representativeRowIndex(rowsWithIndex, first) : 0;
    if (s.status === 'rejected') {
      failed++;
      const msg = s.reason instanceof Error ? s.reason.message : String(s.reason ?? 'Unknown error');
      errors.push({
        groupKey: key,
        productName: first?.name ?? '',
        rowIndex,
        message: msg,
        type: 'failed',
      });
      continue;
    }
    const r = s.value;
    if (r.status === 'created') {
      created++;
    } else if (r.status === 'skipped') {
      skipped++;
      if (r.error) errors.push(r.error);
    } else {
      failed++;
      if (r.error) errors.push(r.error);
    }
  }

  return { created, skipped, failed, errors };
}

/** Serialize products to canonical CSV (round-trip with import template). */
export function productsToCanonicalCsv(
  products: Array<Record<string, string | number | boolean | null | undefined>>
): string {
  const dataRows = products.map((p) =>
    PRODUCT_CANONICAL_HEADERS.map((h) => {
      const v = p[h];
      if (v === null || v === undefined) return '';
      return String(v);
    })
  );
  return serializeCsvMatrix([[...PRODUCT_CANONICAL_HEADERS], ...dataRows]);
}

export function parseProductsCsvFile(text: string): CsvWorkbenchResult<{ parsed: ParsedCsv; rows: ParsedProductRowWithIndex[] }> {
  const structured = parseCsvToStructured(text);
  if ('error' in structured) {
    return { ok: false, error: structured.error };
  }
  const rows = rowsFromParsedCsvWithIndices(structured);
  return { ok: true, data: { parsed: structured, rows } };
}

const productsProfileEntity: CsvEntityProfile<{ parsed: ParsedCsv; rows: ParsedProductRowWithIndex[] }> = {
  id: 'products',
  displayName: 'Products',
  canonicalHeaders: [...PRODUCT_CANONICAL_HEADERS],
  buildBlankTemplate: buildProductsBlankTemplate,
  parseFile: parseProductsCsvFile,
  isImplemented: true,
};

export { productsProfileEntity as productsProfile };
