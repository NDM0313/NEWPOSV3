/**
 * Studio Production – Invoice auto-adjustment (no regeneration).
 * Updates ONLY the sales_items row linked to the studio production (generated_invoice_item_id).
 * Never updates the original fabric/product line. Product base price is NOT changed.
 */

import { supabase } from '@/lib/supabase';
import { studioProductionService } from '@/app/services/studioProductionService';

export interface SyncInvoiceParams {
  /** Profit margin percent (e.g. 20 => 20%). Profit = productionCost * (profitMarginPercent / 100). */
  profitMarginPercent?: number;
  /** Or fixed profit amount. If set, overrides profitMarginPercent. */
  profitAmount?: number;
}

export interface SyncInvoiceResult {
  success: boolean;
  saleId: string;
  invoiceNo: string;
  productionCost: number;
  profit: number;
  finalLinePrice: number;
  newTotal: number;
  newDueAmount: number;
  paidAmount: number;
  error?: string;
}

/**
 * Resolve which sales_items id is the studio-generated line for this production.
 * Uses generated_invoice_item_id or generated_product_id when set; otherwise infers from fabric.
 */
function resolveStudioItemId(
  production: {
    generated_invoice_item_id?: string | null;
    generated_product_id?: string | null;
    product_id: string;
  },
  items: { id: string; product_id: string }[]
): string | null {
  if (production.generated_invoice_item_id) {
    const exists = items.some((i) => i.id === production.generated_invoice_item_id);
    if (exists) return production.generated_invoice_item_id;
  }
  if (production.generated_product_id) {
    const match = items.find((i) => i.product_id === production.generated_product_id);
    if (match) return match.id;
  }
  return null;
}

/**
 * When no link is stored: infer the studio line as the single item that is NOT the fabric (production.product_id).
 * Returns that item's id so we can update and backfill the link. Returns null if 0 or >1 non-fabric items.
 */
function inferStudioItemId(
  production: { product_id: string },
  items: { id: string; product_id: string }[]
): { itemId: string; productId: string } | null {
  const nonFabric = items.filter((i) => i.product_id !== production.product_id);
  if (nonFabric.length !== 1) return null;
  return { itemId: nonFabric[0].id, productId: nonFabric[0].product_id };
}

/**
 * Sync invoice with production pricing: update ONLY the sales_items row linked to the studio order.
 * Never update by array index or first item. Recomputes sales.total and sales.due_amount.
 */
export async function syncInvoiceWithProductionPricing(
  saleId: string,
  params: SyncInvoiceParams = {}
): Promise<SyncInvoiceResult> {
  const { profitMarginPercent = 0, profitAmount } = params;

  const result: SyncInvoiceResult = {
    success: false,
    saleId,
    invoiceNo: '',
    productionCost: 0,
    profit: 0,
    finalLinePrice: 0,
    newTotal: 0,
    newDueAmount: 0,
    paidAmount: 0,
  };

  try {
    const [saleRow, productions, itemsRows, shipmentsRows] = await Promise.all([
      supabase.from('sales').select('id, invoice_no, total, paid_amount, due_amount').eq('id', saleId).single(),
      studioProductionService.getProductionsBySaleId(saleId),
      supabase.from('sales_items').select('id, quantity, unit_price, total, product_id').eq('sale_id', saleId).order('created_at'),
      supabase.from('sale_shipments').select('charged_to_customer').eq('sale_id', saleId),
    ]);

    if (saleRow.error || !saleRow.data) {
      result.error = 'Sale not found';
      return result;
    }
    const sale = saleRow.data as { id: string; invoice_no: string; total: number; paid_amount: number; due_amount: number };
    result.invoiceNo = sale.invoice_no || '';
    result.paidAmount = Number(sale.paid_amount) || 0;

    const items = (itemsRows.data || []) as { id: string; quantity: number; unit_price: number; total: number; product_id: string }[];
    if (items.length === 0) {
      result.error = 'No sale items';
      return result;
    }

    const production = productions[0];
    if (!production) {
      result.error = 'No studio production linked to this sale';
      return result;
    }

    let studioItemId = resolveStudioItemId(production, items);
    let inferredLink: { itemId: string; productId: string } | null = null;
    if (!studioItemId) {
      inferredLink = inferStudioItemId(production, items);
      if (inferredLink) studioItemId = inferredLink.itemId;
    }
    if (!studioItemId) {
      result.error = 'No studio invoice item linked. Add the studio product line (Create Product + Generate Invoice) and save again.';
      return result;
    }

    const stages = await studioProductionService.getStagesByProductionId(production.id);
    const productionCost = stages.reduce((sum, s) => {
      const st = (s as any).status;
      const cost = st === 'completed' ? (Number((s as any).cost) || 0) : (Number((s as any).expected_cost) || 0);
      return sum + cost;
    }, 0);
    result.productionCost = productionCost;

    const profit = profitAmount != null
      ? Math.max(0, profitAmount)
      : Math.max(0, productionCost * (profitMarginPercent / 100));
    result.profit = profit;

    const finalLinePrice = productionCost + profit;
    result.finalLinePrice = finalLinePrice;

    const studioItem = items.find((i) => i.id === studioItemId);
    if (!studioItem) {
      result.error = 'Studio invoice item not found';
      return result;
    }
    const qty = Number(studioItem.quantity) || 1;
    const newStudioTotal = finalLinePrice * qty;

    const shipmentTotal = (shipmentsRows.data || []).reduce((s: number, r: any) => s + (Number(r.charged_to_customer) || 0), 0);
    const itemsTotal =
      items.reduce((sum, item) => sum + (item.id === studioItemId ? newStudioTotal : Number(item.total) || 0), 0);
    const newTotal = itemsTotal + shipmentTotal;
    const newDueAmount = Math.max(0, newTotal - result.paidAmount);
    result.newTotal = newTotal;
    result.newDueAmount = newDueAmount;

    const { error: upErr } = await supabase
      .from('sales_items')
      .update({ unit_price: finalLinePrice, total: newStudioTotal })
      .eq('id', studioItemId);
    if (upErr) {
      result.error = `Failed to update studio item: ${upErr.message}`;
      return result;
    }

    const studioItemProductId = studioItem.product_id;
    const needsBackfill =
      !production.generated_invoice_item_id ||
      production.generated_invoice_item_id !== studioItemId ||
      production.generated_product_id !== studioItemProductId;
    if (needsBackfill) {
      try {
        await studioProductionService.setGeneratedInvoiceItem(production.id, studioItemProductId, studioItemId);
      } catch (_) {
        // non-fatal: columns may not exist yet
      }
    }

    const salePayload: Record<string, unknown> = {
      total: newTotal,
      due_amount: newDueAmount,
      updated_at: new Date().toISOString(),
    };
    const { error: saleUpErr } = await supabase.from('sales').update(salePayload).eq('id', saleId);
    if (saleUpErr) {
      result.error = `Failed to update sale: ${saleUpErr.message}`;
      return result;
    }

    result.success = true;
    return result;
  } catch (e: any) {
    result.error = e?.message || 'Sync failed';
    return result;
  }
}

/**
 * Check if sale has any payments (paid_amount > 0).
 * Editing is allowed either way; if payment exists we keep it and recalc balance_due.
 */
export async function getSalePaidAmount(saleId: string): Promise<number> {
  const { data } = await supabase.from('sales').select('paid_amount').eq('id', saleId).single();
  return Number((data as any)?.paid_amount) || 0;
}
