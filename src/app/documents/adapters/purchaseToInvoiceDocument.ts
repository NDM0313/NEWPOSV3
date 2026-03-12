/**
 * Map Purchase (from API/context) to InvoiceDocument shape for unified engine.
 * Reuses A4/Thermal invoice layout with "PO No" and "Bill From" (supplier).
 */
import type { InvoiceDocument, InvoiceDocumentItem, InvoiceDocumentTotals, InvoiceDocumentMeta } from '@/app/types/invoiceDocument';
import type { Purchase, PurchaseItem } from '@/app/context/PurchaseContext';

export interface PurchaseDocumentCompany {
  id: string;
  name: string;
  address?: string | null;
}

export function purchaseToInvoiceDocument(
  purchase: Purchase,
  company: PurchaseDocumentCompany
): InvoiceDocument {
  const items: InvoiceDocumentItem[] = (purchase.items || []).map((it: PurchaseItem, idx: number) => ({
    id: it.id || `item-${idx}`,
    product_name: it.productName || '',
    sku: it.sku || '',
    quantity: it.quantity ?? 0,
    unit: it.unit || 'pcs',
    unit_price: it.price ?? 0,
    discount_amount: it.discount ?? 0,
    tax_amount: it.tax ?? 0,
    total: it.total ?? 0,
    packing_details: it.packingDetails ?? null,
  }));

  const totals: InvoiceDocumentTotals = {
    subtotal: purchase.subtotal ?? 0,
    discount: purchase.discount ?? 0,
    tax: purchase.tax ?? 0,
    expenses: purchase.shippingCost ?? 0,
    total: purchase.total ?? 0,
    studio_charges: 0,
    grand_total: purchase.total ?? 0,
    paid: purchase.paid ?? 0,
    due: purchase.due ?? 0,
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
