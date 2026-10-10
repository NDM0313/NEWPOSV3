/**
 * Map Purchase (from API/context) to InvoiceDocument shape for unified engine.
 * Reuses A4/Thermal invoice layout with "PO No" and "Bill From" (supplier).
 * Foreign-doc purchases: line/totals use FC amounts so print symbols match document currency.
 */
import type { InvoiceDocument, InvoiceDocumentItem, InvoiceDocumentTotals, InvoiceDocumentMeta } from '@/app/types/invoiceDocument';
import type { Purchase, PurchaseItem } from '@/app/context/PurchaseContext';
import {
  basePkrToForeign,
  isForeignPurchaseDoc,
  normalizeImportDocCurrency,
} from '@/app/lib/importFxHelpers';

export interface PurchaseDocumentCompany {
  id: string;
  name: string;
  address?: string | null;
}

export function purchaseToInvoiceDocument(
  purchase: Purchase,
  company: PurchaseDocumentCompany
): InvoiceDocument {
  const fxDoc = isForeignPurchaseDoc(purchase);
  const rate = Number(purchase.fxRateToBase) || 0;

  const items: InvoiceDocumentItem[] = (purchase.items || []).map((it: PurchaseItem, idx: number) => {
    const qty = it.quantity ?? 0;
    const unitFc =
      fxDoc && it.foreignUnitPrice != null && Number.isFinite(Number(it.foreignUnitPrice))
        ? Number(it.foreignUnitPrice)
        : it.price ?? 0;
    const lineFc =
      fxDoc && it.foreignLineTotal != null && Number.isFinite(Number(it.foreignLineTotal))
        ? Number(it.foreignLineTotal)
        : fxDoc && it.foreignUnitPrice != null
          ? Number(it.foreignUnitPrice) * qty
          : it.total ?? 0;
    return {
      id: it.id || `item-${idx}`,
      product_name: it.productName || '',
      sku: it.sku || '',
      quantity: qty,
      unit: it.unit || 'pcs',
      unit_price: unitFc,
      discount_amount: it.discount ?? 0,
      tax_amount: it.tax ?? 0,
      total: lineFc,
      packing_details: it.packingDetails ?? null,
    };
  });

  const foreignTotal =
    purchase.foreignTotal != null && Number.isFinite(Number(purchase.foreignTotal))
      ? Number(purchase.foreignTotal)
      : null;
  const foreignSub =
    purchase.foreignSubtotal != null && Number.isFinite(Number(purchase.foreignSubtotal))
      ? Number(purchase.foreignSubtotal)
      : foreignTotal;

  const paidPkr = purchase.paid ?? 0;
  const duePkr = purchase.due ?? 0;
  const paidDisplay =
    fxDoc && rate > 0 ? basePkrToForeign(paidPkr, rate) ?? paidPkr : paidPkr;
  const dueDisplay =
    fxDoc && foreignTotal != null && rate > 0
      ? Math.round((foreignTotal - (basePkrToForeign(paidPkr, rate) ?? 0)) * 100) / 100
      : duePkr;

  const totals: InvoiceDocumentTotals = {
    subtotal: fxDoc && foreignSub != null ? foreignSub : purchase.subtotal ?? 0,
    discount: purchase.discount ?? 0,
    tax: purchase.tax ?? 0,
    expenses: purchase.shippingCost ?? 0,
    total: fxDoc && foreignTotal != null ? foreignTotal : purchase.total ?? 0,
    studio_charges: 0,
    grand_total: fxDoc && foreignTotal != null ? foreignTotal : purchase.total ?? 0,
    paid: paidDisplay,
    due: dueDisplay,
  };

  const meta: InvoiceDocumentMeta = {
    sale_id: purchase.id,
    invoice_no: purchase.purchaseNo,
    invoice_date: purchase.date,
    fiscal_period: null,
    status: purchase.status,
    type: 'purchase',
    payment_status: purchase.paymentStatus ?? 'unpaid',
    notes: purchase.notes ?? null,
    branch_id: purchase.branchId ?? '',
  };

  return {
    company: { id: company.id, name: company.name, address: company.address ?? null },
    customer: {
      id: purchase.supplier || '',
      name: purchase.supplierName || 'Supplier',
      contact_number: purchase.contactNumber || '',
      address: purchase.location || null,
    },
    items,
    studio_cost: 0,
    payments: [],
    totals,
    meta,
  };
}

/** Currency code to pass into formatCurrency for this purchase print. */
export function purchaseInvoiceDisplayCurrency(purchase: Purchase | null | undefined): string | undefined {
  if (!isForeignPurchaseDoc(purchase)) return undefined;
  return normalizeImportDocCurrency(purchase?.documentCurrency);
}
