/**
 * Studio Customer Invoice Service (Safe Zone)
 * Generates customer sale invoice from a completed Studio Production V2 order.
 * Does NOT modify existing production cost logic. Worker costs remain separate.
 * Accounting: Customer Invoice = Dr AR, Cr Sales. Worker payments = Dr Expense, Cr Cash.
 */

import { supabase } from '@/lib/supabase';
import { documentNumberService } from '@/app/services/documentNumberService';
import { saleService, type Sale, type SaleItem } from '@/app/services/saleService';
import { productService } from '@/app/services/productService';
import { studioProductionV2Service } from '@/app/services/studioProductionV2Service';

export const STUDIO_CUSTOMER_INVOICE_SOURCE = 'studio_production';

export interface ProductionCostSummary {
  productionCost: number;
  orderId: string;
  productionNo: string;
  allStagesCompleted: boolean;
}

export interface SaleInfoForOrder {
  customer_id: string | null;
  customer_name: string;
  contact_number: string | null;
  company_id: string;
  branch_id: string;
  firstProductId: string | null;
  firstProductName: string;
  firstProductSku: string;
}

/**
 * Get total production cost (sum of actual costs from stage receipts) for a V2 order.
 */
export async function getProductionCostSummary(orderId: string): Promise<ProductionCostSummary> {
  const order = await studioProductionV2Service.getOrderById(orderId);
  if (!order) throw new Error('Production order not found');

  const stages = await studioProductionV2Service.getStagesByOrderId(orderId);
  let productionCost = 0;
  for (const stage of stages) {
    const receipt = await studioProductionV2Service.getReceiptByStageId(stage.id);
    if (receipt) productionCost += Number(receipt.actual_cost) || 0;
  }

  const allStagesCompleted = stages.length > 0 && stages.every((s) => s.status === 'completed');

  return {
    productionCost,
    orderId,
    productionNo: order.production_no,
    allStagesCompleted,
  };
}

/**
 * Get sale and product info for the order (for customer + line item).
 * Prefer order.product_id (manufactured product) when set; else first item from linked STD sale.
 */
export async function getSaleInfoForOrder(orderId: string): Promise<SaleInfoForOrder> {
  const order = await studioProductionV2Service.getOrderById(orderId);
  if (!order) throw new Error('Production order not found');

  const { data: sale, error: saleErr } = await supabase
    .from('sales')
    .select('id, customer_id, customer_name, contact_number, company_id, branch_id')
    .eq('id', order.sale_id)
    .single();

  if (saleErr || !sale) throw new Error('Linked sale not found');

  const saleRow = sale as {
    customer_id: string | null;
    customer_name: string;
    contact_number: string | null;
    company_id: string;
    branch_id: string;
  };

  let firstProductId: string | null = null;
  let firstProductName = 'Custom Studio Dress';
  let firstProductSku = 'STUDIO-1';

  if (order.product_id) {
    const { data: prod } = await supabase
      .from('products')
      .select('id, name, sku')
      .eq('id', order.product_id)
      .maybeSingle();
    if (prod) {
      firstProductId = (prod as { id: string }).id;
      firstProductName = (prod as { name?: string }).name || firstProductName;
      firstProductSku = (prod as { sku?: string }).sku || firstProductSku;
    }
  }

  if (!firstProductId) {
    const { data: items } = await supabase
      .from('sales_items')
      .select('product_id, product_name, sku')
      .eq('sale_id', order.sale_id)
      .limit(1);

    if (items && items.length > 0) {
      const first = items[0] as { product_id: string; product_name?: string; sku?: string };
      firstProductId = first.product_id;
      firstProductName = first.product_name || firstProductName;
      firstProductSku = first.sku || firstProductSku;
    } else {
      const { data: legacyItems } = await supabase
        .from('sale_items')
        .select('product_id, product_name, sku')
        .eq('sale_id', order.sale_id)
        .limit(1);
      if (legacyItems && legacyItems.length > 0) {
        const first = legacyItems[0] as { product_id: string; product_name?: string; sku?: string };
        firstProductId = first.product_id;
        firstProductName = first.product_name || firstProductName;
        firstProductSku = first.sku || firstProductSku;
      }
    }
  }

  if (!firstProductId) {
    throw new Error(
      'Create a product from this production (Create Product) or add at least one product to the studio order before generating the customer invoice.'
    );
  }

  return {
    customer_id: saleRow.customer_id ?? null,
    customer_name: saleRow.customer_name || 'Customer',
    contact_number: saleRow.contact_number ?? null,
    company_id: saleRow.company_id,
    branch_id: saleRow.branch_id,
    firstProductId,
    firstProductName,
    firstProductSku,
  };
}

/**
 * Generate a customer sale invoice from a completed Studio Production V2 order.
 * Creates sale with source='studio_production', source_id=orderId.
 * Updates order: generated_sale_id, customer_invoice_generated = true.
 */
export async function generateCustomerInvoiceFromProduction(params: {
  productionOrderId: string;
  customerPrice: number;
  createdBy: string;
}): Promise<{ saleId: string; invoiceNo: string }> {
  const { productionOrderId, customerPrice, createdBy } = params;

  const order = await studioProductionV2Service.getOrderById(productionOrderId);
  if (!order) throw new Error('Production order not found');
  if (order.status !== 'completed') {
    throw new Error('Production must be completed before generating the customer invoice.');
  }
  if (order.customer_invoice_generated && order.generated_sale_id) {
    throw new Error('Customer invoice already generated for this production.');
  }

  const [costSummary, saleInfo] = await Promise.all([
    getProductionCostSummary(productionOrderId),
    getSaleInfoForOrder(productionOrderId),
  ]);

  let invoiceNo: string;
  try {
    invoiceNo = await documentNumberService.getNextDocumentNumber(
      saleInfo.company_id,
      saleInfo.branch_id,
      'sale',
      false
    );
  } catch {
    invoiceNo = await documentNumberService.getNextDocumentNumberGlobal(saleInfo.company_id, 'SL');
  }

  const saleDate = new Date().toISOString().split('T')[0];

  const sale: Sale & { source?: string; source_id?: string } = {
    company_id: saleInfo.company_id,
    branch_id: saleInfo.branch_id,
    invoice_no: invoiceNo,
    invoice_date: saleDate,
    customer_id: saleInfo.customer_id || undefined,
    customer_name: saleInfo.customer_name,
    contact_number: saleInfo.contact_number || undefined,
    type: 'invoice',
    status: 'final',
    payment_status: 'unpaid',
    payment_method: 'Cash',
    shipping_status: 'delivered',
    subtotal: customerPrice,
    discount_amount: 0,
    tax_amount: 0,
    expenses: 0,
    total: customerPrice,
    paid_amount: 0,
    due_amount: customerPrice,
    return_due: 0,
    notes: `Generated from Studio Production ${order.production_no}`,
    created_by: createdBy,
    source: STUDIO_CUSTOMER_INVOICE_SOURCE,
    source_id: productionOrderId,
  };

  const items: SaleItem[] = [
    {
      product_id: saleInfo.firstProductId!,
      product_name: saleInfo.firstProductName,
      sku: saleInfo.firstProductSku,
      quantity: 1,
      unit: 'piece',
      unit_price: customerPrice,
      total: customerPrice,
    },
  ];

  const created = await saleService.createSale(sale, items, { allowNegativeStock: true });
  if (!created?.id) throw new Error('Failed to create sale');

  await supabase
    .from('studio_production_orders_v2')
    .update({
      customer_invoice_generated: true,
      generated_sale_id: created.id,
    })
    .eq('id', productionOrderId);

  return { saleId: created.id, invoiceNo: created.invoice_no || invoiceNo };
}

/**
 * Create a product from a completed production order (Job Order → Product flow).
 * Links the product to the order so "Generate Sale Invoice" uses it as the line item.
 */
export async function createProductFromProductionOrder(params: {
  productionOrderId: string;
  productName: string;
  companyId: string;
  categoryId?: string | null;
}): Promise<{ productId: string; sku: string }> {
  const { productionOrderId, productName, companyId, categoryId } = params;

  const order = await studioProductionV2Service.getOrderById(productionOrderId);
  if (!order) throw new Error('Production order not found');
  if (order.product_id) {
    throw new Error('A product is already linked to this production. Use "Generate Sale Invoice" to create the customer invoice.');
  }

  const sku = await documentNumberService.getNextProductSKU(companyId, null);
  const product = await productService.createProduct({
    company_id: companyId,
    name: productName.trim() || `Studio – ${order.production_no}`,
    sku,
    category_id: categoryId || (null as any),
    cost_price: 0,
    retail_price: 0,
    wholesale_price: 0,
    current_stock: 0,
    min_stock: 0,
    max_stock: 1000,
    has_variations: false,
    is_rentable: false,
    is_sellable: true,
    track_stock: false,
    is_active: true,
  });

  const created = product as { id: string; sku: string };
  await supabase
    .from('studio_production_orders_v2')
    .update({ product_id: created.id })
    .eq('id', productionOrderId);

  return { productId: created.id, sku: created.sku || sku };
}
