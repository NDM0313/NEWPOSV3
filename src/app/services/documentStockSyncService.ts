/**
 * Reconciles stock_movements with document line items for posted sales/purchases.
 *
 * Root issue: DB triggers only insert stock on first transition to final; line edits / item changes
 * afterward do not re-run triggers, and delta logic can drift (wrong table, rounding, partial paths).
 *
 * This module applies an idempotent delta: expectedSum − actualSum per (product_id, variation_id),
 * inserting one movement row per key when |delta| > ε. Re-running yields delta 0.
 */

import { supabase } from '@/lib/supabase';
import {
  canPostStockForPurchaseStatus,
  canPostStockForSaleStatus,
} from '@/app/lib/postingStatusGate';

const EPS = 1e-4;

function lineKey(productId: string, variationId: string | null | undefined): string {
  return `${productId}|${variationId ?? ''}`;
}

function normMovType(t: unknown): string {
  return String(t ?? '')
    .trim()
    .toLowerCase();
}

async function fetchSaleLines(saleId: string): Promise<
  { product_id: string; variation_id: string | null; quantity: number; unit_price: number }[]
> {
  let { data } = await supabase
    .from('sales_items')
    .select('product_id, variation_id, quantity, unit_price')
    .eq('sale_id', saleId);
  return (data || []).map((r: any) => ({
    product_id: String(r.product_id ?? ''),
    variation_id: r.variation_id ?? null,
    quantity: Number(r.quantity) || 0,
    unit_price: Number(r.unit_price) || 0,
  }));
}

async function fetchPurchaseLines(purchaseId: string): Promise<
  { product_id: string; variation_id: string | null; quantity: number; unit_price: number }[]
> {
  const { data } = await supabase
    .from('purchase_items')
    .select('product_id, variation_id, quantity, unit_price')
    .eq('purchase_id', purchaseId);
  return (data || []).map((r: any) => ({
    product_id: String(r.product_id ?? ''),
    variation_id: r.variation_id ?? null,
    quantity: Number(r.quantity) || 0,
    unit_price: Number(r.unit_price) || 0,
  }));
}

export type DocumentStockSyncResult = {
  saleId?: string;
  purchaseId?: string;
  adjustmentsInserted: number;
  keysAdjusted: string[];
};

/**
 * For a posted (final) sale: sum(movement qty) for movement_type sale should equal −line qty per SKU.
 */
export async function syncSaleStockForDocument(saleId: string): Promise<DocumentStockSyncResult> {
  const { data: sale, error } = await supabase
    .from('sales')
    .select('id, company_id, branch_id, status, invoice_no')
    .eq('id', saleId)
    .maybeSingle();
  if (error || !sale) throw new Error('Sale not found');
  const st = String((sale as any).status || '').toLowerCase();
  const { data: movements } = await supabase
    .from('stock_movements')
    .select('product_id, variation_id, quantity, movement_type')
    .eq('reference_type', 'sale')
    .eq('reference_id', saleId);

  /** Cancelled: net per SKU = sum(sale) + sum(sale_cancelled); insert sale Δ to reach zero. */
  if (st === 'cancelled') {
    const movMap = new Map<string, number>();
    for (const m of movements || []) {
      const mt = normMovType((m as any).movement_type);
      if (mt !== 'sale' && mt !== 'sale_cancelled') continue;
      const k = lineKey(String((m as any).product_id ?? ''), (m as any).variation_id ?? null);
      movMap.set(k, (movMap.get(k) ?? 0) + (Number((m as any).quantity) || 0));
    }
    const companyId = (sale as any).company_id as string;
    const branchId = (sale as any).branch_id as string | null;
    const invoiceNo = String((sale as any).invoice_no || saleId).slice(0, 80);
    let adjustmentsInserted = 0;
    const keysAdjusted: string[] = [];
    for (const k of movMap.keys()) {
      const actual = movMap.get(k) ?? 0;
      if (Math.abs(actual) <= EPS) continue;
      const delta = -actual;
      const [productId, varPart] = k.split('|');
      const variationId = varPart === '' ? null : varPart;
      const { data: auth } = await supabase.auth.getUser();
      const { error: insErr } = await supabase.from('stock_movements').insert({
        company_id: companyId,
        branch_id: branchId || null,
        product_id: productId,
        variation_id: variationId,
        quantity: delta,
        unit_cost: 0,
        total_cost: 0,
        movement_type: 'sale',
        reference_type: 'sale',
        reference_id: saleId,
        notes: `Stock sync ${invoiceNo} cancel net-zero Δ=${delta}`,
        created_by: auth?.user?.id ?? null,
      });
      if (insErr) {
        console.warn('[documentStockSyncService] sale cancel insert failed', k, insErr.message);
        continue;
      }
      adjustmentsInserted += 1;
      keysAdjusted.push(k);
    }
    return { saleId, adjustmentsInserted, keysAdjusted };
  }

  if (!canPostStockForSaleStatus(st)) {
    return { saleId, adjustmentsInserted: 0, keysAdjusted: [] };
  }

  const movMap = new Map<string, number>();
  for (const m of movements || []) {
    if (normMovType((m as any).movement_type) !== 'sale') continue;
    const k = lineKey(String((m as any).product_id ?? ''), (m as any).variation_id ?? null);
    movMap.set(k, (movMap.get(k) ?? 0) + (Number((m as any).quantity) || 0));
  }

  const lines = await fetchSaleLines(saleId);
  const lineMap = new Map<string, { qty: number; unit_price: number }>();
  for (const row of lines) {
    if (row.quantity <= 0) continue;
    const k = lineKey(row.product_id, row.variation_id);
    const cur = lineMap.get(k) || { qty: 0, unit_price: row.unit_price };
    cur.qty += row.quantity;
    if (row.unit_price) cur.unit_price = row.unit_price;
    lineMap.set(k, cur);
  }

  const keys = new Set([...lineMap.keys(), ...movMap.keys()]);
  const companyId = (sale as any).company_id as string;
  const branchId = (sale as any).branch_id as string | null;
  const invoiceNo = String((sale as any).invoice_no || saleId).slice(0, 80);

  let adjustmentsInserted = 0;
  const keysAdjusted: string[] = [];

  for (const k of keys) {
    const lineQty = lineMap.get(k)?.qty ?? 0;
    const expectedMovSum = -lineQty;
    const actual = movMap.get(k) ?? 0;
    const delta = expectedMovSum - actual;
    if (Math.abs(delta) <= EPS) continue;

    const [productId, varPart] = k.split('|');
    const variationId = varPart === '' ? null : varPart;
    const unitPrice = lineMap.get(k)?.unit_price || 0;
    const { data: auth } = await supabase.auth.getUser();

    const { error: insErr } = await supabase.from('stock_movements').insert({
      company_id: companyId,
      branch_id: branchId || null,
      product_id: productId,
      variation_id: variationId,
      quantity: delta,
      unit_cost: unitPrice,
      total_cost: delta * (unitPrice || 0),
      movement_type: 'sale',
      reference_type: 'sale',
      reference_id: saleId,
      notes: `Stock sync ${invoiceNo} Δ=${delta} (line vs movements)`,
      created_by: auth?.user?.id ?? null,
    });
    if (insErr) {
      console.warn('[documentStockSyncService] sale insert failed', k, insErr.message);
      continue;
    }
    adjustmentsInserted += 1;
    keysAdjusted.push(k);
  }

  return { saleId, adjustmentsInserted, keysAdjusted };
}

/**
 * For a posted purchase (final/received): sum(movement qty) for movement_type purchase should equal +line qty per SKU.
 */
export async function syncPurchaseStockForDocument(purchaseId: string): Promise<DocumentStockSyncResult> {
  const { data: pur, error } = await supabase
    .from('purchases')
    .select('id, company_id, branch_id, status, po_no')
    .eq('id', purchaseId)
    .maybeSingle();
  if (error || !pur) throw new Error('Purchase not found');
  const st = String((pur as any).status || '').toLowerCase();
  const { data: movements } = await supabase
    .from('stock_movements')
    .select('product_id, variation_id, quantity, movement_type')
    .eq('reference_type', 'purchase')
    .eq('reference_id', purchaseId);

  if (st === 'cancelled') {
    const movMap = new Map<string, number>();
    for (const m of movements || []) {
      const mt = normMovType((m as any).movement_type);
      if (mt !== 'purchase' && mt !== 'purchase_cancelled') continue;
      const k = lineKey(String((m as any).product_id ?? ''), (m as any).variation_id ?? null);
      movMap.set(k, (movMap.get(k) ?? 0) + (Number((m as any).quantity) || 0));
    }
    const companyId = (pur as any).company_id as string;
    const branchId = (pur as any).branch_id as string | null;
    const poNo = String((pur as any).po_no || purchaseId).slice(0, 80);
    let adjustmentsInserted = 0;
    const keysAdjusted: string[] = [];
    for (const k of movMap.keys()) {
      const actual = movMap.get(k) ?? 0;
      if (Math.abs(actual) <= EPS) continue;
      const delta = -actual;
      const [productId, varPart] = k.split('|');
      const variationId = varPart === '' ? null : varPart;
      const { data: auth } = await supabase.auth.getUser();
      const { error: insErr } = await supabase.from('stock_movements').insert({
        company_id: companyId,
        branch_id: branchId || null,
        product_id: productId,
        variation_id: variationId,
        quantity: delta,
        unit_cost: 0,
        total_cost: 0,
        movement_type: 'purchase',
        reference_type: 'purchase',
        reference_id: purchaseId,
        notes: `Stock sync ${poNo} cancel net-zero Δ=${delta}`,
        created_by: auth?.user?.id ?? null,
      });
      if (insErr) {
        console.warn('[documentStockSyncService] purchase cancel insert failed', k, insErr.message);
        continue;
      }
      adjustmentsInserted += 1;
      keysAdjusted.push(k);
    }
    return { purchaseId, adjustmentsInserted, keysAdjusted };
  }

  if (!canPostStockForPurchaseStatus(st)) {
    return { purchaseId, adjustmentsInserted: 0, keysAdjusted: [] };
  }

  const movMap = new Map<string, number>();
  for (const m of movements || []) {
    if (normMovType((m as any).movement_type) !== 'purchase') continue;
    const k = lineKey(String((m as any).product_id ?? ''), (m as any).variation_id ?? null);
    movMap.set(k, (movMap.get(k) ?? 0) + (Number((m as any).quantity) || 0));
  }

  const lines = await fetchPurchaseLines(purchaseId);
  const lineMap = new Map<string, { qty: number; unit_price: number }>();
  for (const row of lines) {
    if (row.quantity <= 0) continue;
    const k = lineKey(row.product_id, row.variation_id);
    const cur = lineMap.get(k) || { qty: 0, unit_price: row.unit_price };
    cur.qty += row.quantity;
    if (row.unit_price) cur.unit_price = row.unit_price;
    lineMap.set(k, cur);
  }

  const keys = new Set([...lineMap.keys(), ...movMap.keys()]);
  const companyId = (pur as any).company_id as string;
  const branchId = (pur as any).branch_id as string | null;
  const poNo = String((pur as any).po_no || purchaseId).slice(0, 80);

  let adjustmentsInserted = 0;
  const keysAdjusted: string[] = [];

  for (const k of keys) {
    const lineQty = lineMap.get(k)?.qty ?? 0;
    const expectedMovSum = lineQty;
    const actual = movMap.get(k) ?? 0;
    const delta = expectedMovSum - actual;
    if (Math.abs(delta) <= EPS) continue;

    const [productId, varPart] = k.split('|');
    const variationId = varPart === '' ? null : varPart;
    const unitPrice = lineMap.get(k)?.unit_price || 0;
    const { data: auth } = await supabase.auth.getUser();

    const { error: insErr } = await supabase.from('stock_movements').insert({
      company_id: companyId,
      branch_id: branchId || null,
      product_id: productId,
      variation_id: variationId,
      quantity: delta,
      unit_cost: unitPrice,
      total_cost: delta * (unitPrice || 0),
      movement_type: 'purchase',
      reference_type: 'purchase',
      reference_id: purchaseId,
      notes: `Stock sync ${poNo} Δ=${delta} (line vs movements)`,
      created_by: auth?.user?.id ?? null,
    });
    if (insErr) {
      console.warn('[documentStockSyncService] purchase insert failed', k, insErr.message);
      continue;
    }
    adjustmentsInserted += 1;
    keysAdjusted.push(k);
  }

  return { purchaseId, adjustmentsInserted, keysAdjusted };
}
