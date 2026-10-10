/**
 * Pure wholesale import purchase calculations (no Supabase).
 */

export type FreightSettlement = 'supplier' | 'courier';

export type WholesalePurchaseRow = {
  freight_settlement?: string | null;
  freightSettlement?: string | null;
  clearance_courier_id?: string | null;
  clearanceCourierId?: string | null;
  subtotal?: number | null;
  discount_amount?: number | null;
  discount?: number | null;
  tax_amount?: number | null;
  tax?: number | null;
  shipping_cost?: number | null;
  shippingCost?: number | null;
  total?: number | null;
  paid_amount?: number | null;
  paid?: number | null;
};

const COURIER_FREIGHT_TYPES = new Set([
  'freight',
  'shipping',
  'cargo',
  'courier',
  'customs',
  'duty',
  'clearance',
]);

export function getFreightSettlement(p: WholesalePurchaseRow): FreightSettlement {
  const v = String(p.freight_settlement ?? p.freightSettlement ?? 'supplier').toLowerCase();
  return v === 'courier' ? 'courier' : 'supplier';
}

export function isWholesaleImportClearance(p: WholesalePurchaseRow): boolean {
  return getFreightSettlement(p) === 'courier' && !!(p.clearance_courier_id ?? p.clearanceCourierId);
}

export function purchaseSupplierPayableBase(p: WholesalePurchaseRow): number {
  const sub = Number(p.subtotal ?? 0) || 0;
  const disc = Number(p.discount_amount ?? p.discount ?? 0) || 0;
  const tax = Number(p.tax_amount ?? p.tax ?? 0) || 0;
  return Math.max(0, Math.round((sub - disc + tax) * 100) / 100);
}

export function purchaseSupplierDue(p: WholesalePurchaseRow): number {
  const base = purchaseSupplierPayableBase(p);
  const paid = Number(p.paid_amount ?? p.paid ?? 0) || 0;
  return Math.max(0, Math.round((base - paid) * 100) / 100);
}

export function purchaseClearanceAmount(p: WholesalePurchaseRow): number {
  return Number(p.shipping_cost ?? p.shippingCost ?? 0) || 0;
}

export function isCourierFreightChargeType(typeRaw: string): boolean {
  const t = String(typeRaw || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_');
  return COURIER_FREIGHT_TYPES.has(t);
}
