/**
 * Inventory stock balances CSV — parse + commit via stock movements (client-only).
 */

import { parseCsvToStructured } from '../parseCsv';
import { DEFAULT_IMPORT_CHUNK_SIZE, runChunkedAllSettled } from '../chunkedCommit';
import type { CsvWorkbenchResult, ParsedCsv } from '../types';
import { productService } from '@/app/services/productService';
import { inventoryService } from '@/app/services/inventoryService';
import { INVENTORY_STOCK_HEADERS } from '../backupPackage/flattenInventoryStock';

export interface ParsedInventoryStockRow {
  product_id?: string;
  variation_id?: string;
  sku: string;
  product_name?: string;
  branch_id?: string;
  current_stock: number;
  cost_price?: number;
  _sourceRowIndex: number;
}

export interface InventoryStockImportSummary {
  adjusted: number;
  skipped: number;
  failed: number;
  errors: Array<{ rowIndex: number; sku: string; message: string }>;
}

const HEADER_ALIASES: Record<string, string> = {
  product_id: 'product_id',
  variation_id: 'variation_id',
  sku: 'sku',
  product_name: 'product_name',
  branch_id: 'branch_id',
  current_stock: 'current_stock',
  'current stock': 'current_stock',
  cost_price: 'cost_price',
  'cost price': 'cost_price',
};

function buildColMap(headers: string[]): Record<string, number> {
  const colMap: Record<string, number> = {};
  headers.forEach((raw, i) => {
    const h = raw.trim().toLowerCase();
    const key = HEADER_ALIASES[h] ?? h.replace(/\s+/g, '_');
    colMap[key] = i;
  });
  return colMap;
}

function cell(row: string[], colMap: Record<string, number>, key: string): string {
  const i = colMap[key];
  return i === undefined ? '' : (row[i] ?? '').trim();
}

export function rowsFromInventoryStockCsv(parsed: ParsedCsv): ParsedInventoryStockRow[] {
  const colMap = buildColMap(parsed.headers);
  const out: ParsedInventoryStockRow[] = [];
  parsed.rows.forEach((row, idx) => {
    const sku = cell(row, colMap, 'sku');
    if (!sku) return;
    const stockRaw = cell(row, colMap, 'current_stock');
    out.push({
      product_id: cell(row, colMap, 'product_id') || undefined,
      variation_id: cell(row, colMap, 'variation_id') || undefined,
      sku,
      product_name: cell(row, colMap, 'product_name') || undefined,
      branch_id: cell(row, colMap, 'branch_id') || undefined,
      current_stock: Number(stockRaw) || 0,
      cost_price: Number(cell(row, colMap, 'cost_price')) || 0,
      _sourceRowIndex: idx + 2,
    });
  });
  return out;
}

export function parseInventoryStockCsvFile(
  text: string
): CsvWorkbenchResult<{ parsed: ParsedCsv; rows: ParsedInventoryStockRow[] }> {
  const structured = parseCsvToStructured(text);
  if ('error' in structured) {
    return { ok: false, error: structured.error };
  }
  const rows = rowsFromInventoryStockCsv(structured);
  return { ok: true, data: { parsed: structured, rows } };
}

export async function commitInventoryStockImport(
  rows: ParsedInventoryStockRow[],
  companyId: string,
  branchId: string | null
): Promise<InventoryStockImportSummary> {
  const errors: InventoryStockImportSummary['errors'] = [];
  let adjusted = 0;
  let skipped = 0;
  let failed = 0;

  const overview = await inventoryService.getInventoryOverview(companyId, branchId);
  const stockBySku = new Map<string, number>();
  overview.forEach((p) => {
    stockBySku.set(p.sku.toLowerCase(), p.stock);
    p.variations?.forEach((v) => {
      if (v.sku) stockBySku.set(v.sku.toLowerCase(), v.stock);
    });
  });

  const productIdBySku = new Map<string, { productId: string; variationId?: string }>();
  overview.forEach((p) => {
    productIdBySku.set(p.sku.toLowerCase(), { productId: p.productId });
    p.variations?.forEach((v) => {
      if (v.sku) {
        productIdBySku.set(v.sku.toLowerCase(), { productId: p.productId, variationId: v.id });
      }
    });
  });

  const ready = rows.filter((r) => {
    if (!r.sku.trim()) {
      skipped++;
      return false;
    }
    return true;
  });

  const settled = await runChunkedAllSettled(
    ready,
    DEFAULT_IMPORT_CHUNK_SIZE,
    async (row) => {
      const key = row.sku.toLowerCase();
      let productId = row.product_id;
      let variationId = row.variation_id || undefined;
      if (!productId) {
        const resolved = productIdBySku.get(key);
        if (!resolved) {
          throw new Error(`Unknown SKU: ${row.sku}`);
        }
        productId = resolved.productId;
        variationId = variationId ?? resolved.variationId;
      }

      const current = stockBySku.get(key) ?? 0;
      const target = row.current_stock;
      const delta = target - current;
      if (Math.abs(delta) < 1e-9) {
        return { status: 'skipped' as const };
      }

      await productService.createStockMovement({
        company_id: companyId,
        branch_id: branchId && branchId !== 'all' ? branchId : undefined,
        product_id: productId,
        variation_id: variationId,
        movement_type: 'adjustment',
        quantity: delta,
        unit_cost: row.cost_price ?? 0,
        reference_type: 'adjustment',
        notes: `Backup restore: set stock to ${target} (was ${current})`,
      });
      stockBySku.set(key, target);
      return { status: 'adjusted' as const };
    }
  );

  let ri = 0;
  for (const s of settled) {
    const row = ready[ri++]!;
    if (s.status === 'fulfilled') {
      if (s.value.status === 'adjusted') adjusted++;
      else skipped++;
    } else {
      failed++;
      const msg = s.reason instanceof Error ? s.reason.message : String(s.reason);
      errors.push({ rowIndex: row._sourceRowIndex, sku: row.sku, message: msg });
    }
  }

  return { adjusted, skipped, failed, errors };
}

export const INVENTORY_STOCK_CANONICAL_HEADERS = [...INVENTORY_STOCK_HEADERS];
