/**
 * Batch-fetch sale/purchase/studio reference metadata for stock movement UIs.
 * Read-only — no stock_movements writes.
 */

import { supabase } from '@/lib/supabase';
import type { EnrichmentContext } from '@/app/lib/stockMovementReportLogic';

export interface StockMovementRefMeta {
  invoiceNo: string;
  partyName: string | null;
}

export type StockMovementEnrichment = EnrichmentContext;

export interface StockMovementRefSource {
  reference_type?: string | null;
  reference_id?: string | null;
  branch_id?: string | null;
}

export function getMovementRefKey(
  referenceType: string | null | undefined,
  referenceId: string | null | undefined,
): string {
  if (!referenceType || !referenceId) return '';
  return `${referenceType}:${referenceId}`;
}

export function isSaleReferenceType(referenceType: string | null | undefined): boolean {
  const rt = String(referenceType || '').toLowerCase();
  return rt.includes('sale') && !rt.includes('return');
}

export function isPurchaseReferenceType(referenceType: string | null | undefined): boolean {
  const rt = String(referenceType || '').toLowerCase();
  return rt.includes('purchase') && !rt.includes('return');
}

export function isStudioProductionReferenceType(referenceType: string | null | undefined): boolean {
  const rt = String(referenceType || '').toLowerCase();
  return rt === 'studio_production' || rt === 'production';
}

export function resolveMovementPartyName(
  enrichment: StockMovementEnrichment | null | undefined,
  movement: StockMovementRefSource,
): string | null {
  const key = getMovementRefKey(movement.reference_type, movement.reference_id);
  if (!key) return null;
  const party = enrichment?.partyNames?.[key];
  return party && String(party).trim() ? String(party).trim() : null;
}

export function resolveMovementInvoiceNo(
  enrichment: StockMovementEnrichment | null | undefined,
  movement: StockMovementRefSource,
): string | null {
  const key = getMovementRefKey(movement.reference_type, movement.reference_id);
  if (!key) return null;
  const label = enrichment?.referenceLabels?.[key];
  return label && String(label).trim() ? String(label).trim() : null;
}

export async function fetchSaleRefs(
  ids: Set<string>,
): Promise<Record<string, StockMovementRefMeta>> {
  if (!ids.size) return {};
  const { data } = await supabase
    .from('sales')
    .select('id, invoice_no, order_no, customer_name')
    .in('id', Array.from(ids));
  const map: Record<string, StockMovementRefMeta> = {};
  for (const r of data || []) {
    const invoice = String(r.invoice_no ?? '').trim();
    const order = String(r.order_no ?? '').trim();
    map[String(r.id)] = {
      invoiceNo: invoice || order || '',
      partyName: String(r.customer_name ?? '').trim() || null,
    };
  }
  return map;
}

export async function fetchPurchaseRefs(
  ids: Set<string>,
): Promise<Record<string, StockMovementRefMeta>> {
  if (!ids.size) return {};
  const { data } = await supabase
    .from('purchases')
    .select('id, po_no, supplier_name')
    .in('id', Array.from(ids));
  const map: Record<string, StockMovementRefMeta> = {};
  for (const r of data || []) {
    map[String(r.id)] = {
      invoiceNo: String(r.po_no ?? '').trim(),
      partyName: String(r.supplier_name ?? '').trim() || null,
    };
  }
  return map;
}

export async function fetchStudioProductionRefs(
  ids: Set<string>,
): Promise<Record<string, { refNo: string; partyName: string | null }>> {
  if (!ids.size) return {};
  const { data: prodRows } = await supabase
    .from('studio_productions')
    .select('id, production_no, sale_id')
    .in('id', Array.from(ids));
  const saleIds = new Set<string>();
  for (const r of prodRows || []) {
    if (r.sale_id) saleIds.add(String(r.sale_id));
  }
  const salesMap = await fetchSaleRefs(saleIds);
  const map: Record<string, { refNo: string; partyName: string | null }> = {};
  for (const r of prodRows || []) {
    const id = String(r.id);
    const sale = r.sale_id ? salesMap[String(r.sale_id)] : null;
    map[id] = {
      refNo: String(r.production_no ?? '').trim() || sale?.invoiceNo || '',
      partyName: sale?.partyName ?? null,
    };
  }
  return map;
}

export async function fetchBranchNames(ids: Set<string>): Promise<Record<string, string>> {
  if (!ids.size) return {};
  const { data } = await supabase.from('branches').select('id, name').in('id', Array.from(ids));
  const map: Record<string, string> = {};
  for (const r of data || []) {
    map[String(r.id)] = String(r.name ?? '');
  }
  return map;
}

export function collectReferenceIds(movements: StockMovementRefSource[]): {
  saleIds: Set<string>;
  purchaseIds: Set<string>;
  studioIds: Set<string>;
  branchIds: Set<string>;
} {
  const saleIds = new Set<string>();
  const purchaseIds = new Set<string>();
  const studioIds = new Set<string>();
  const branchIds = new Set<string>();

  movements.forEach((m) => {
    const rt = String(m.reference_type || '').toLowerCase();
    const rid = m.reference_id ? String(m.reference_id) : '';
    if (!rid) return;
    if (isSaleReferenceType(rt)) saleIds.add(rid);
    else if (isPurchaseReferenceType(rt)) purchaseIds.add(rid);
    else if (isStudioProductionReferenceType(rt)) studioIds.add(rid);
    if (m.branch_id) branchIds.add(m.branch_id);
  });

  return { saleIds, purchaseIds, studioIds, branchIds };
}

export async function buildStockMovementEnrichment(
  movements: StockMovementRefSource[],
): Promise<StockMovementEnrichment> {
  const { saleIds, purchaseIds, studioIds, branchIds } = collectReferenceIds(movements);

  const [salesMap, purchasesMap, studioMap, branchNames] = await Promise.all([
    fetchSaleRefs(saleIds),
    fetchPurchaseRefs(purchaseIds),
    fetchStudioProductionRefs(studioIds),
    fetchBranchNames(branchIds),
  ]);

  const referenceLabels: Record<string, string> = {};
  const partyNames: Record<string, string> = {};

  movements.forEach((m) => {
    const rt = String(m.reference_type || '').toLowerCase();
    const rid = m.reference_id ? String(m.reference_id) : '';
    if (!rid) return;
    const key = getMovementRefKey(m.reference_type, rid);
    if (isSaleReferenceType(rt)) {
      referenceLabels[key] = salesMap[rid]?.invoiceNo || rid;
      partyNames[key] = salesMap[rid]?.partyName ?? '';
    } else if (isPurchaseReferenceType(rt)) {
      referenceLabels[key] = purchasesMap[rid]?.invoiceNo || rid;
      partyNames[key] = purchasesMap[rid]?.partyName ?? '';
    } else if (isStudioProductionReferenceType(rt)) {
      referenceLabels[key] = studioMap[rid]?.refNo || rid;
      partyNames[key] = studioMap[rid]?.partyName ?? '';
    } else if (rt === 'opening_balance') {
      referenceLabels[key] = 'Opening Balance';
    } else {
      referenceLabels[key] = rid;
    }
  });

  return { branchNames, referenceLabels, partyNames };
}
