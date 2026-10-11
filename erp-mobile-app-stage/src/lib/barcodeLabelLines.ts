/**
 * Build label print rows for Products catalog and Purchase PO lines.
 */
import { supabase, isSupabaseConfigured } from './supabase';
import type { MobileBarcodeLabelSettings } from '../api/settings';
import type { LabelPrintLine } from '../services/barcodeLabelPrint';

export interface ProductForLabels {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  retailPrice?: number;
}

export interface PackingDetailsForLabels {
  total_boxes?: number;
  total_pieces?: number;
  total_meters?: number;
  packs?: number;
  units_per_pack?: number;
}

export interface PurchaseItemForLabels {
  id: string;
  productId?: string;
  variationId?: string | null;
  sku?: string | null;
  productName: string;
  quantity: number;
  packingDetails?: PackingDetailsForLabels | null;
}

/** Format packing for label line (boxes / pieces / meters or packs). */
export function formatPackingSummary(pd: PackingDetailsForLabels | null | undefined): string | undefined {
  if (!pd) return undefined;
  const boxes = pd.total_boxes ?? 0;
  const pieces = pd.total_pieces ?? 0;
  const meters = pd.total_meters ?? 0;
  if (boxes > 0 || pieces > 0 || meters > 0) {
    const parts: string[] = [];
    if (boxes > 0) parts.push(`${boxes} bx`);
    if (pieces > 0) parts.push(`${pieces} pc`);
    if (meters > 0) parts.push(`${meters.toFixed(0)} m`);
    return parts.join(' · ');
  }
  const packs = pd.packs ?? 0;
  const upp = pd.units_per_pack ?? 0;
  if (packs > 0 && upp > 0) return `${packs} pk × ${upp}`;
  return undefined;
}

function mergePacking(
  existing: string | undefined,
  incoming: string | undefined,
): string | undefined {
  if (!incoming) return existing;
  if (!existing) return incoming;
  if (existing === incoming) return existing;
  return `${existing}; ${incoming}`;
}

export function linesFromProducts(
  products: ProductForLabels[],
  settings: MobileBarcodeLabelSettings,
): LabelPrintLine[] {
  return products.map((p) => {
    const code = (p.barcode || p.sku || '').trim();
    return {
      lineKey: p.id,
      productId: p.id,
      productName: p.name,
      sku: p.sku || code,
      barcode: code,
      price: p.retailPrice,
      labelCount: settings.defaultQuantity,
      selected: true,
    };
  });
}

export function aggregatePurchaseItemsForLabels(
  items: PurchaseItemForLabels[],
  settings: MobileBarcodeLabelSettings,
): LabelPrintLine[] {
  const map = new Map<
    string,
    {
      productId?: string;
      variationId?: string | null;
      productName: string;
      sku: string;
      qtySum: number;
      lineCount: number;
      packingSummary?: string;
    }
  >();

  for (const item of items) {
    const key = `${item.productId ?? item.id}:${item.variationId ?? ''}`;
    const sku = (item.sku || '').trim();
    const packStr = formatPackingSummary(item.packingDetails ?? undefined);
    const existing = map.get(key);
    if (existing) {
      existing.qtySum += item.quantity;
      existing.lineCount += 1;
      if (!existing.sku && sku) existing.sku = sku;
      existing.packingSummary = mergePacking(existing.packingSummary, packStr);
    } else {
      map.set(key, {
        productId: item.productId,
        variationId: item.variationId,
        productName: item.productName,
        sku,
        qtySum: item.quantity,
        lineCount: 1,
        packingSummary: packStr,
      });
    }
  }

  return [...map.entries()].map(([key, row]) => {
    const defaultQty = settings.defaultLabelsFromPurchaseQty
      ? Math.max(1, Math.round(row.qtySum))
      : settings.defaultQuantity;
    return {
      lineKey: key,
      productId: row.productId,
      variationId: row.variationId,
      productName: row.productName,
      sku: row.sku,
      barcode: row.sku,
      packingSummary: row.packingSummary,
      labelCount: defaultQty,
      selected: true,
      mergedLineCount: row.lineCount > 1 ? row.lineCount : undefined,
    };
  });
}

export async function enrichLinesWithBarcodes(
  companyId: string,
  lines: LabelPrintLine[],
): Promise<LabelPrintLine[]> {
  if (!isSupabaseConfigured || !companyId) return lines;

  const productIds = [...new Set(lines.map((l) => l.productId).filter(Boolean) as string[])];
  const variationIds = [...new Set(lines.map((l) => l.variationId).filter(Boolean) as string[])];

  const byProduct = new Map<string, { barcode?: string; sku?: string; retail_price?: number }>();
  if (productIds.length > 0) {
    const { data } = await supabase
      .from('products')
      .select('id, barcode, sku, retail_price')
      .eq('company_id', companyId)
      .in('id', productIds);
    for (const row of data || []) {
      const r = row as { id: string; barcode?: string; sku?: string; retail_price?: number };
      byProduct.set(r.id, r);
    }
  }

  const byVariation = new Map<
    string,
    { name?: string; barcode?: string; retail_price?: number; sku?: string }
  >();
  if (variationIds.length > 0) {
    const { data: vars } = await supabase
      .from('product_variations')
      .select('id, name, barcode, retail_price, sku')
      .in('id', variationIds);
    for (const row of vars || []) {
      const r = row as {
        id: string;
        name?: string;
        barcode?: string;
        retail_price?: number;
        sku?: string;
      };
      byVariation.set(r.id, r);
    }
  }

  return lines.map((line) => {
    let next = { ...line };
    if (line.productId) {
      const p = byProduct.get(line.productId);
      if (p) {
        const barcode = (p.barcode || line.barcode || p.sku || line.sku || '').trim();
        const sku = (p.sku || line.sku || barcode).trim();
        next = {
          ...next,
          barcode,
          sku,
          price: next.price ?? (p.retail_price != null ? Number(p.retail_price) : undefined),
        };
      }
    }
    if (line.variationId) {
      const v = byVariation.get(line.variationId);
      if (v) {
        const vCode = (v.barcode || v.sku || '').trim();
        if (vCode) {
          next = { ...next, barcode: vCode, sku: v.sku || next.sku || vCode };
        }
        if (v.name) next = { ...next, variationName: v.name };
        if (v.retail_price != null) {
          next = { ...next, price: Number(v.retail_price) };
        }
      }
    }
    return next;
  });
}

export function countSelectedLabels(lines: LabelPrintLine[]): number {
  return lines
    .filter((l) => l.selected && (l.barcode || l.sku || '').trim())
    .reduce((sum, l) => sum + Math.max(0, l.labelCount), 0);
}

export function hasPrintableCode(line: LabelPrintLine): boolean {
  return !!(line.barcode || line.sku || '').trim();
}
