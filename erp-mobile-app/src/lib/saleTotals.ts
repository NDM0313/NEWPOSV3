import { isBespokeGenericSku } from './bespokeCartInjection';
import type { ExtraExpense } from '../types/saleExtras';

/** Minimal cart line shape for billable total rules. */
export interface BillableSaleLine {
  total?: number;
  price?: number;
  quantity?: number;
  sku?: string;
  bespokeRole?: 'fabric' | string;
  isBespokeInjected?: boolean;
  bespokeParentCartId?: string | number | null;
}

export function sumExtraExpenses(extraExpenses: ExtraExpense[] | undefined): number {
  return (extraExpenses ?? []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
}

/** Fabric / injected child lines — stock & WO only, not customer invoice lines. */
export function isStockOnlyBespokeLine(line: BillableSaleLine): boolean {
  return (
    line.bespokeRole === 'fabric' ||
    line.isBespokeInjected === true ||
    (line.bespokeParentCartId != null && line.bespokeParentCartId !== '')
  );
}

export function lineCartTotal(line: BillableSaleLine): number {
  if (line.total != null && Number.isFinite(line.total)) return Number(line.total);
  const price = Number(line.price) || 0;
  const qty = Number(line.quantity) || 0;
  return price * qty;
}

/** Sum of all cart lines (including fabric children). */
export function computeRawCartSubtotal(lines: BillableSaleLine[] | undefined): number {
  return (lines ?? []).reduce((sum, p) => sum + lineCartTotal(p), 0);
}

/** Customer bill subtotal: parents + regular products only. */
export function computeBillableSubtotal(lines: BillableSaleLine[] | undefined): number {
  return (lines ?? [])
    .filter((p) => !isStockOnlyBespokeLine(p))
    .reduce((sum, p) => sum + lineCartTotal(p), 0);
}

/**
 * CUSTOM parent with a quoted dress price — stitching/fabric already in line price;
 * extra expenses must not inflate customer total.
 */
export function hasInclusiveBespokeParents(lines: BillableSaleLine[] | undefined): boolean {
  return (lines ?? []).some(
    (p) =>
      isBespokeGenericSku(p.sku) &&
      !isStockOnlyBespokeLine(p) &&
      (lineCartTotal(p) > 0 || (Number(p.price) || 0) > 0),
  );
}

/** Default checkbox when CUSTOM dress has quoted price (package often all-inclusive). */
export function defaultChargeExtrasToCustomer(products?: BillableSaleLine[]): boolean {
  return !hasInclusiveBespokeParents(products);
}

/**
 * Customer invoice grand total. Extras add only when chargeExtrasToCustomer is true (4120 package split UI).
 */
export function computeSaleGrandTotal(params: {
  subtotal?: number;
  products?: BillableSaleLine[];
  discount?: number;
  extraExpenses?: ExtraExpense[];
  shippingCharge?: number;
  shipping?: number;
  tax?: number;
  /** When true, extra lines are on the customer bill (ON). When false, package-only total (OFF). */
  chargeExtrasToCustomer?: boolean;
  /** @deprecated use chargeExtrasToCustomer (inverted) */
  excludeExtraExpensesFromTotal?: boolean;
}): number {
  const discount = Number(params.discount) || 0;
  const ship = Number(params.shippingCharge ?? params.shipping) || 0;
  const tax = Number(params.tax) || 0;
  const billable =
    params.subtotal != null && Number.isFinite(params.subtotal)
      ? Number(params.subtotal)
      : computeBillableSubtotal(params.products);
  let chargeOnBill = params.chargeExtrasToCustomer;
  if (chargeOnBill === undefined && params.excludeExtraExpensesFromTotal !== undefined) {
    chargeOnBill = !params.excludeExtraExpensesFromTotal;
  }
  if (chargeOnBill === undefined && params.products) {
    chargeOnBill = defaultChargeExtrasToCustomer(params.products);
  }
  const extras = chargeOnBill !== false ? sumExtraExpenses(params.extraExpenses) : 0;
  return Math.max(0, billable - discount + extras + ship + tax);
}

/** 25% cap on inclusive (package) extra total vs customer invoice value. */
export function validateInclusiveExtraChargeCap(params: {
  invoiceTotal: number;
  shippingCharge?: number;
  extraExpenses?: ExtraExpense[];
  chargeExtrasToCustomer?: boolean;
}): { ok: true } | { ok: false; error: string } {
  if (params.chargeExtrasToCustomer !== false) return { ok: true };
  const invoiceVal =
    (Number(params.invoiceTotal) || 0) + (Number(params.shippingCharge) || 0);
  if (invoiceVal <= 0) return { ok: true };
  const extraSum = sumExtraExpenses(params.extraExpenses);
  const max = Math.round(invoiceVal * 0.25 * 100) / 100;
  if (extraSum > max + 0.005) {
    return {
      ok: false,
      error: `Inclusive extra expenses (Rs. ${extraSum.toLocaleString()}) cannot exceed 25% of invoice total (max Rs. ${max.toLocaleString()}).`,
    };
  }
  return { ok: true };
}

/** Match web: Order, Final, or studio sale can use extras/shipping panel. */
export function saleExtrasPanelActive(saleType: 'regular' | 'studio', documentStatus?: string): boolean {
  if (saleType === 'studio') return true;
  const status = (documentStatus ?? 'order').toLowerCase();
  return status === 'order' || status === 'final';
}
