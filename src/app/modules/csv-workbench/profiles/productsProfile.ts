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
import { productCategoryService } from '@/app/services/productCategoryService';
import { unitService } from '@/app/services/unitService';
import { brandService } from '@/app/services/brandService';
import { defaultAccountsService } from '@/app/services/defaultAccountsService';
import { openingBalanceJournalService } from '@/app/services/openingBalanceJournalService';
import type { DocumentType } from '@/app/hooks/useDocumentNumbering';
import {
  buildMatrixParentSku,
  buildMatrixVariantSku,
  createSkuLookupWithIndex,
  ensureUniqueProductSku,
  previewSkuForRow,
  skuIndexAdd,
  type ImportSkuIndex,
} from '@/app/utils/productImportSku';

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
  updated: number;
  skipped: number;
  failed: number;
  errors: ImportRowError[];
  /** Opening stock movements GL-synced in batch after import */
  openingMovementsSynced?: number;
}

export type ProductImportProgress =
  | { phase: 'groups'; completed: number; total: number }
  | { phase: 'gl'; completed: number; total: number };

/** Parallel opening GL sync after bulk product import (bounded concurrency). */
const OPENING_GL_SYNC_CHUNK_SIZE = 5;

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

/** Shown in downloaded CSV row 2 (description only; skipped on import — no name). */
export const PRODUCT_IMPORT_BRANCH_NOTE =
  'BRANCH / OPENING STOCK: Assign stock to the branch selected in the ERP header (top bar) before import. ' +
  'Use Main Branch or Stitch — not "All Branches" — if you want opening_stock on one location only. ' +
  'This column is not read from CSV; delete this note row before filling products.';

function buildBranchNoteRow(): string[] {
  const row = PRODUCT_CANONICAL_HEADERS.map(() => '');
  const descIdx = PRODUCT_CANONICAL_HEADERS.indexOf('description');
  if (descIdx >= 0) row[descIdx] = PRODUCT_IMPORT_BRANCH_NOTE;
  return row;
}

/** Blank template: header row + branch note + one empty data row (Excel-friendly). */
export function buildProductsBlankTemplate(): string {
  const emptyRow = PRODUCT_CANONICAL_HEADERS.map(() => '');
  return serializeCsvMatrix([[...PRODUCT_CANONICAL_HEADERS], buildBranchNoteRow(), emptyRow]);
}

/** Example rows — Matrix / Bespoke: 3 boutique scenarios (parent + 2 variants each). */
export function buildProductsSampleTemplate(): string {
  return serializeCsvMatrix([
    [...PRODUCT_CANONICAL_HEADERS],
    buildBranchNoteRow(),
    // Example 1: Lehenga / Maxi (Bridal)
    [
      'Design 2000 (Maxi)',
      'DSN-2000',
      'Bridal',
      'Lehenga',
      'Piece',
      'Din Bridal',
      '8000',
      '25000',
      '22000',
      '0',
      '2',
      '25',
      'yes',
      'yes',
      '8901234567001',
      'Bridal maxi parent — heavy formal range',
      '',
      '',
      '',
      '',
    ],
    [
      'Design 2000 (Maxi)',
      '',
      'Bridal',
      'Lehenga',
      'Piece',
      'Din Bridal',
      '12000',
      '45000',
      '40000',
      '5',
      '2',
      '25',
      'yes',
      'yes',
      '8901234567002',
      '',
      '',
      'Raw Silk - Heavy Embroidery',
      'DSN-2000-RSHE',
      '',
    ],
    [
      'Design 2000 (Maxi)',
      '',
      'Bridal',
      'Lehenga',
      'Piece',
      'Din Bridal',
      '5500',
      '18000',
      '15500',
      '8',
      '2',
      '25',
      'yes',
      'yes',
      '8901234567003',
      '',
      '',
      'Chiffon - Light Work / Replica',
      'DSN-2000-CHFR',
      '',
    ],
    // Example 2: Loose cutting fabric (meter)
    [
      'Design 3005 (Loose Fabric)',
      'DSN-3005',
      'Fabric',
      'Unstitched Embroidered',
      'Meter',
      'Saddar Vendor',
      '1200',
      '3500',
      '3000',
      '0',
      '10',
      '500',
      'yes',
      'yes',
      '8901234567010',
      'Unstitched embroidered cloth — sold per meter',
      '',
      '',
      '',
      '',
    ],
    [
      'Design 3005 (Loose Fabric)',
      '',
      'Fabric',
      'Unstitched Embroidered',
      'Meter',
      'Saddar Vendor',
      '1800',
      '5200',
      '4800',
      '50',
      '10',
      '500',
      'yes',
      'yes',
      '8901234567011',
      '',
      '',
      'Shamooz Silk - Jet Black',
      'DSN-3005-SSJB',
      '',
    ],
    [
      'Design 3005 (Loose Fabric)',
      '',
      'Fabric',
      'Unstitched Embroidered',
      'Meter',
      'Saddar Vendor',
      '1400',
      '4200',
      '3800',
      '35',
      '10',
      '500',
      'yes',
      'yes',
      '8901234567012',
      '',
      '',
      'Chiffon - Royal Blue',
      'DSN-3005-CHRB',
      '',
    ],
    // Example 3: Casual shirts (premium vs commercial)
    [
      'Design 4010 (Front Open Shirt)',
      'DSN-4010',
      'Casual',
      'Shirts',
      'Piece',
      'Din Couture',
      '2500',
      '8500',
      '7500',
      '0',
      '3',
      '40',
      'yes',
      'yes',
      '8901234567020',
      'Front open shirt — tissue silk range',
      '',
      '',
      '',
      '',
    ],
    [
      'Design 4010 (Front Open Shirt)',
      '',
      'Casual',
      'Shirts',
      'Piece',
      'Din Couture',
      '4200',
      '14000',
      '12500',
      '12',
      '3',
      '40',
      'yes',
      'yes',
      '8901234567021',
      '',
      '',
      'Tissue Silk - Master Copy',
      'DSN-4010-TSMC',
      '',
    ],
    [
      'Design 4010 (Front Open Shirt)',
      '',
      'Casual',
      'Shirts',
      'Piece',
      'Din Couture',
      '2200',
      '6500',
      '5800',
      '20',
      '3',
      '40',
      'yes',
      'yes',
      '8901234567022',
      '',
      '',
      'Tissue Silk - Commercial Replica',
      'DSN-4010-TSCR',
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

/** Matrix/Bespoke: variant row has non-empty variation_name. */
export function isMatrixVariantRow(row: ParsedProductRow): boolean {
  return !!row.variation_name?.trim();
}

/** Group key for matrix import — same product name = one parent + variants. */
export function groupNameKeyForProduct(row: ParsedProductRow): string {
  return row.name.trim().toLowerCase();
}

/** Group rows by product name (preserves CSV order within each group). */
export function groupProductRowsByName(rows: ParsedProductRow[]): Map<string, ParsedProductRow[]> {
  const groups = new Map<string, ParsedProductRow[]>();
  for (const row of rows) {
    const key = groupNameKeyForProduct(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }
  return groups;
}

/** Parent row = empty variation_name; error if matrix group has 0 or >1 parents. */
export function resolveParentRow(rows: ParsedProductRow[]): { parent?: ParsedProductRow; error?: string } {
  const parentRows = rows.filter((r) => !isMatrixVariantRow(r));
  const hasVariants = rows.some((r) => isMatrixVariantRow(r));
  if (!hasVariants) {
    if (parentRows.length === 0) return { error: 'No product rows in group' };
    if (parentRows.length > 1) return { error: 'Simple product group must have one row' };
    return { parent: parentRows[0] };
  }
  if (parentRows.length === 0) {
    return { error: 'Matrix group requires one parent row (empty variation_name)' };
  }
  if (parentRows.length > 1) {
    return { error: 'Matrix group must have exactly one parent row (empty variation_name)' };
  }
  return { parent: parentRows[0] };
}

export function resolveVariantRows(rows: ParsedProductRow[]): ParsedProductRow[] {
  return rows.filter((r) => isMatrixVariantRow(r));
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

function stripIndex(row: ParsedProductRowWithIndex): ParsedProductRow {
  const { _sourceRowIndex: _idx, ...rest } = row;
  void _idx;
  return rest;
}

/** Warn when blank-SKU rows would share the same auto-generated parent SKU. */
export function validateDerivedSkuCollisions(
  rows: ParsedProductRowWithIndex[],
  autoGenerateSku: boolean
): CsvRowValidation[] {
  if (autoGenerateSku) return [];
  const issues: CsvRowValidation[] = [];
  const plainRows = rows.map(stripIndex);
  const groups = groupProductRowsByName(plainRows);
  const skuToGroups = new Map<
    string,
    { sku: string; groupKey: string; rowIndex: number; productName: string }[]
  >();

  for (const [groupKey, groupRows] of groups) {
    const parentResult = resolveParentRow(groupRows);
    const parent = parentResult.parent ?? groupRows[0];
    if (!parent || parent.sku?.trim()) continue;
    const sku = buildMatrixParentSku(parent);
    const skuKey = sku.toLowerCase();
    const rowIndex =
      rows.find((r) => groupNameKeyForProduct(r) === groupKey)?._sourceRowIndex ?? 1;
    const list = skuToGroups.get(skuKey) ?? [];
    list.push({ sku, groupKey, rowIndex, productName: parent.name });
    skuToGroups.set(skuKey, list);
  }

  for (const [, entries] of skuToGroups) {
    if (entries.length < 2) continue;
    const displaySku = entries[0]!.sku;
    for (const e of entries) {
      issues.push({
        rowIndex: e.rowIndex,
        severity: 'warning',
        field: 'sku',
        message: `Auto SKU collision: "${displaySku}" shared with ${entries.length - 1} other product(s) — use explicit sku column or enable ERP numbering`,
      });
    }
  }

  return issues;
}

export function validateProductsStructuralIndexed(
  rows: ParsedProductRowWithIndex[],
  autoGenerateSku: boolean
): CsvRowValidation[] {
  const issues: CsvRowValidation[] = [];
  const plainRows = rows.map(stripIndex);
  const groups = groupProductRowsByName(plainRows);
  const indexByRow = new Map<ParsedProductRow, number>();
  rows.forEach((r) => indexByRow.set(stripIndex(r), r._sourceRowIndex));

  for (const [, groupRows] of groups) {
    const hasVariants = groupRows.some((r) => isMatrixVariantRow(r));
    const parentResult = resolveParentRow(groupRows);
    const parent = parentResult.parent;
    const parentRowIndex = parent ? indexByRow.get(parent) ?? groupRows[0]?.name.length : 0;

    if (parentResult.error) {
      const firstIndexed = rows.find((r) => groupNameKeyForProduct(r) === groupNameKeyForProduct(groupRows[0]!));
      issues.push({
        rowIndex: firstIndexed?._sourceRowIndex ?? 1,
        severity: 'error',
        message: parentResult.error,
      });
      continue;
    }

    if (parent) {
      if (!Number.isFinite(parent.selling_price)) {
        issues.push({
          rowIndex: indexByRow.get(parent) ?? parentRowIndex,
          severity: 'error',
          field: 'selling_price',
          message: 'Selling price must be a valid number on parent row',
        });
      }
    }

    if (hasVariants && parent) {
      const parentIdx = indexByRow.get(parent) ?? 0;
      const variantRows = resolveVariantRows(groupRows);
      const seenVarSkus = new Set<string>();
      const previewParentSku = parent.sku?.trim() || buildMatrixParentSku(parent);

      for (const vRow of variantRows) {
        const vIdx = indexByRow.get(vRow) ?? parentIdx;
        if (!vRow.variation_name?.trim()) {
          issues.push({
            rowIndex: vIdx,
            severity: 'error',
            field: 'variation_name',
            message: 'Variant row requires variation_name',
          });
        }
        const providedVarSku = vRow.variation_sku?.trim();
        if (providedVarSku) {
          const skuKey = providedVarSku.toLowerCase();
          if (seenVarSkus.has(skuKey)) {
            issues.push({
              rowIndex: vIdx,
              severity: 'error',
              field: 'variation_sku',
              message: `Duplicate variation_sku "${vRow.variation_sku}" in group`,
            });
          }
          seenVarSkus.add(skuKey);
        } else {
          let suffixIndex = 0;
          let generated = buildMatrixVariantSku(previewParentSku, vRow.variation_name ?? '', suffixIndex);
          while (seenVarSkus.has(generated.toLowerCase())) {
            suffixIndex++;
            generated = buildMatrixVariantSku(previewParentSku, vRow.variation_name ?? '', suffixIndex);
          }
          seenVarSkus.add(generated.toLowerCase());
        }
        if (!Number.isFinite(vRow.selling_price)) {
          issues.push({
            rowIndex: vIdx,
            severity: 'error',
            field: 'selling_price',
            message: 'Variant selling price must be a valid number',
          });
        }
      }

      const firstVariantIdx = variantRows.length
        ? indexByRow.get(variantRows[0]!) ?? parentIdx
        : null;
      if (firstVariantIdx != null && parentIdx > 0 && firstVariantIdx < parentIdx) {
        issues.push({
          rowIndex: firstVariantIdx,
          severity: 'warning',
          message: 'Variant row appears before parent row; import will still use empty variation_name as parent',
        });
      }
    } else {
      for (const r of groupRows) {
        if (!Number.isFinite(r.selling_price)) {
          issues.push({
            rowIndex: indexByRow.get(r) ?? 1,
            severity: 'error',
            field: 'selling_price',
            message: 'Selling price must be a valid number',
          });
        }
      }
    }
  }

  issues.push(...validateDerivedSkuCollisions(rows, autoGenerateSku));

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
  /** Prefetched + in-flight SKUs for this import batch */
  skuIndex?: ImportSkuIndex;
  onProgress?: (progress: ProductImportProgress) => void;
  /** Bulk CSV: defer per-row opening GL; batch at end of commitProductImport */
  deferOpeningBalanceGlSync?: boolean;
  deferredOpeningMovementIds?: string[];
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
    const gk = groupNameKeyForProduct(row);
    if (seenGroups.has(gk)) continue;
    seenGroups.add(gk);

    const groupRows = rows.filter((r) => groupNameKeyForProduct(r) === gk);
    const parentResult = resolveParentRow(groupRows.map(stripIndex));
    const catalogRow = parentResult.parent ?? row;

    const dryError = checkProductCatalogRefsDry(catalog, catalogRow);
    if (dryError) {
      if (autoCreateCatalog) {
        const hints: string[] = [];
        if (row.category && dryError.includes('Category')) hints.push(`will create category "${catalogRow.category}"`);
        if (row.unit && dryError.includes('Unit')) hints.push(`will create unit "${catalogRow.unit}"`);
        if (row.brand && dryError.includes('Brand')) hints.push(`will create brand "${catalogRow.brand}"`);
        if (catalogRow.subcategory && dryError.includes('Subcategory')) {
          hints.push(`will create subcategory "${catalogRow.subcategory}"`);
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
  const isVariant = !!row.variation_name?.trim();
  const skuDisplay = isVariant
    ? previewSkuForRow(row)
    : row.sku?.trim()
      ? row.sku.trim()
      : previewSkuForRow(row);
  return {
    name: row.name,
    sku: skuDisplay,
    category: row.category ?? '',
    variation_name: row.variation_name ?? '',
    cost_price: row.cost_price,
    selling_price: row.selling_price,
    opening_stock: row.opening_stock,
  };
}

export type ResolvedImportSkus = {
  parentSku: string;
  variantSkus: Map<ParsedProductRow, string>;
  erpParentGenerated: boolean;
};

/** Resolve blank parent/variant SKUs before commit (boutique pattern or ERP parent). */
export async function resolveImportSkusForGroup(
  parentRow: ParsedProductRow,
  variantRows: ParsedProductRow[],
  deps: ProductCommitDeps,
  existingParentProductId?: string | null
): Promise<ResolvedImportSkus> {
  const { companyId, autoGenerateSku, generateDocumentNumberSafe, skuIndex } = deps;
  const findBySku = createSkuLookupWithIndex(
    skuIndex,
    (cid, sku) => productService.findProductBySku(cid, sku)
  );
  let parentSku = parentRow.sku?.trim() || '';
  let erpParentGenerated = false;

  if (!parentSku) {
    if (autoGenerateSku) {
      parentSku = await generateDocumentNumberSafe('production');
      erpParentGenerated = true;
      skuIndexAdd(skuIndex, parentSku);
    } else {
      parentSku = buildMatrixParentSku(parentRow);
    }
    const existing = await findBySku(companyId, parentSku);
    const existingId =
      existing && typeof existing === 'object' && 'id' in existing
        ? String((existing as { id: string }).id)
        : null;
    if (!existingId || existingId === '__import_reserved__') {
      parentSku = await ensureUniqueProductSku(
        companyId,
        parentSku,
        findBySku,
        existingParentProductId ?? null,
        20,
        skuIndex
      );
    } else if (existingParentProductId && existingId !== existingParentProductId) {
      parentSku = await ensureUniqueProductSku(
        companyId,
        parentSku,
        findBySku,
        existingParentProductId,
        20,
        skuIndex
      );
    }
  }

  const variantSkus = new Map<ParsedProductRow, string>();
  const seenVarSkus = new Set<string>();

  for (let i = 0; i < variantRows.length; i++) {
    const row = variantRows[i]!;
    let varSku = row.variation_sku?.trim() || '';
    if (!varSku) {
      let suffixIndex = 0;
      let candidate = buildMatrixVariantSku(parentSku, row.variation_name ?? '', suffixIndex);
      while (seenVarSkus.has(candidate.toLowerCase())) {
        suffixIndex++;
        candidate = buildMatrixVariantSku(parentSku, row.variation_name ?? '', suffixIndex);
      }
      varSku = candidate;
    }
    seenVarSkus.add(varSku.toLowerCase());
    variantSkus.set(row, varSku);
  }

  return { parentSku, variantSkus, erpParentGenerated };
}

function representativeRowIndex(rowsWithIndex: ParsedProductRowWithIndex[], parent: ParsedProductRow): number {
  const indices = rowsWithIndex
    .filter((r) => groupNameKeyForProduct(r) === groupNameKeyForProduct(parent))
    .map((r) => r._sourceRowIndex);
  return indices.length ? Math.min(...indices) : 1;
}

async function importOneProductGroup(
  key: string,
  rows: ParsedProductRow[],
  rowsWithIndex: ParsedProductRowWithIndex[],
  deps: ProductCommitDeps
): Promise<{ status: 'created' | 'updated' | 'skipped' | 'failed'; error?: ImportRowError }> {
  const {
    companyId,
    branchIdOrNull,
    catalog,
    autoCreateCatalog,
    incrementNextNumber,
  } = deps;

  const parentResult = resolveParentRow(rows);
  if (parentResult.error || !parentResult.parent) {
    const rowIndex = rowsWithIndex.find((r) => groupNameKeyForProduct(r) === key)?._sourceRowIndex ?? 1;
    return {
      status: 'skipped',
      error: {
        groupKey: key,
        productName: rows[0]?.name ?? '',
        rowIndex,
        message: parentResult.error ?? 'Could not resolve parent row',
        type: 'validation',
      },
    };
  }

  const parentRow = parentResult.parent;
  const variantRows = resolveVariantRows(rows);
  const hasVariations = variantRows.length > 0;
  const rowIndex = representativeRowIndex(rowsWithIndex, parentRow);

  const resolved = await resolveProductCatalogIds(companyId, catalog, parentRow, autoCreateCatalog);
  if (resolved.error) {
    return {
      status: 'skipped',
      error: {
        groupKey: key,
        productName: parentRow.name,
        rowIndex,
        message: resolved.error,
        type: 'validation',
      },
    };
  }
  const { categoryId, unitId, brandId } = resolved;

  let skuResolved: ResolvedImportSkus;
  try {
    skuResolved = await resolveImportSkusForGroup(parentRow, variantRows, deps);
  } catch {
    return {
      status: 'failed',
      error: {
        groupKey: key,
        productName: parentRow.name,
        rowIndex,
        message: 'Failed to generate SKU',
        type: 'failed',
      },
    };
  }

  const skuToUse = skuResolved.parentSku;

  try {
    const productData: Record<string, unknown> = {
      company_id: companyId,
      category_id: categoryId,
      brand_id: brandId,
      unit_id: unitId,
      name: parentRow.name,
      sku: skuToUse,
      barcode: parentRow.barcode || null,
      description: parentRow.description || null,
      cost_price: parentRow.cost_price,
      retail_price: parentRow.selling_price,
      wholesale_price: parentRow.wholesale_price ?? parentRow.selling_price,
      min_stock: parentRow.min_stock ?? 0,
      max_stock: parentRow.max_stock ?? 1000,
      has_variations: hasVariations,
      is_rentable: false,
      is_sellable: parentRow.is_sellable ?? true,
      track_stock: parentRow.track_stock ?? true,
      is_active: true,
      is_combo_product: false,
      opening_stock: hasVariations ? 0 : parentRow.opening_stock,
    };
    if (parentRow.image_url) {
      productData.image_urls = [parentRow.image_url];
    }

    const variations = variantRows.map((row) => ({
      name: row.variation_name!.trim(),
      sku: skuResolved.variantSkus.get(row) ?? row.variation_sku!.trim(),
      barcode: row.variation_barcode || null,
      attributes: { variant: row.variation_name!.trim() },
      cost_price: row.cost_price,
      retail_price: row.selling_price,
      wholesale_price: row.wholesale_price ?? row.selling_price,
      opening_stock: row.opening_stock,
    }));

    const saveResult = await productService.saveProductWithVariations({
      companyId,
      branchIdOrNull,
      parent: productData,
      variations,
      deferOpeningBalanceGlSync: deps.deferOpeningBalanceGlSync ?? false,
    });

    if (deps.deferredOpeningMovementIds && saveResult.openingMovementIds.length > 0) {
      deps.deferredOpeningMovementIds.push(...saveResult.openingMovementIds);
    }

    if (skuResolved.erpParentGenerated) {
      incrementNextNumber('production');
    }
    skuIndexAdd(deps.skuIndex, skuToUse);

    return { status: saveResult.parentCreated ? 'created' : 'updated' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return {
      status: 'failed',
      error: { groupKey: key, productName: parentRow.name, rowIndex, message: msg, type: 'failed' },
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
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  const plainRows = rowsWithIndex.map(stripIndex);
  const groups = groupProductRowsByName(plainRows);

  const skuIndex =
    deps.skuIndex ?? (await productService.listActiveProductSkuKeys(deps.companyId));
  const deferredOpeningMovementIds: string[] = deps.deferredOpeningMovementIds ?? [];
  const commitDeps: ProductCommitDeps = {
    ...deps,
    skuIndex,
    deferOpeningBalanceGlSync: deps.deferOpeningBalanceGlSync ?? true,
    deferredOpeningMovementIds,
  };

  const groupEntries = Array.from(groups.entries());
  const groupTotal = groupEntries.length;
  deps.onProgress?.({ phase: 'groups', completed: 0, total: groupTotal });
  const settled = await runChunkedAllSettled(
    groupEntries,
    DEFAULT_IMPORT_CHUNK_SIZE,
    ([key, rows]) => importOneProductGroup(key, rows, rowsWithIndex, commitDeps),
    (completed, total) => deps.onProgress?.({ phase: 'groups', completed, total })
  );

  let gi = 0;
  for (const s of settled) {
    const [key, rows] = groupEntries[gi++]!;
    const parentResult = resolveParentRow(rows);
    const parent = parentResult.parent ?? rows[0];
    const rowIndex = parent ? representativeRowIndex(rowsWithIndex, parent) : 0;
    if (s.status === 'rejected') {
      failed++;
      const msg = s.reason instanceof Error ? s.reason.message : String(s.reason ?? 'Unknown error');
      errors.push({
        groupKey: key,
        productName: parent?.name ?? '',
        rowIndex,
        message: msg,
        type: 'failed',
      });
      continue;
    }
    const r = s.value;
    if (r.status === 'created') {
      created++;
    } else if (r.status === 'updated') {
      updated++;
    } else if (r.status === 'skipped') {
      skipped++;
      if (r.error) errors.push(r.error);
    } else {
      failed++;
      if (r.error) errors.push(r.error);
    }
  }

  if (commitDeps.deferOpeningBalanceGlSync && deferredOpeningMovementIds.length > 0) {
    const glTotal = deferredOpeningMovementIds.length;
    deps.onProgress?.({ phase: 'gl', completed: 0, total: glTotal });
    try {
      await defaultAccountsService.ensureDefaultAccounts(deps.companyId);
      await runChunkedAllSettled(
        deferredOpeningMovementIds,
        OPENING_GL_SYNC_CHUNK_SIZE,
        async (movementId) => {
          try {
            await openingBalanceJournalService.syncInventoryOpeningFromStockMovementId(movementId, {
              suppressNotify: true,
            });
          } catch (glErr) {
            console.warn('[product import] Opening GL sync failed for movement', movementId, glErr);
          }
        },
        (completed, total) => deps.onProgress?.({ phase: 'gl', completed, total })
      );
    } catch (batchErr) {
      console.warn('[product import] Batch opening GL sync failed:', batchErr);
    }
  }

  return {
    created,
    updated,
    skipped,
    failed,
    errors,
    openingMovementsSynced: deferredOpeningMovementIds.length,
  };
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
