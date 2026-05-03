/**
 * Studio Production V3 – Invoice & Product (Safe Zone)
 * Generate sales invoice from completed V3 order; create product; store cost breakdown.
 * Does NOT modify V2 or legacy studio tables.
 */

import { supabase } from '@/lib/supabase';
import { dispatchSaleLifecycleInvalidated, dispatchStudioDataInvalidated } from '@/app/lib/dataInvalidationBus';
import { documentNumberService } from '@/app/services/documentNumberService';
import { saleService, type Sale, type SaleItem } from '@/app/services/saleService';
import { productService } from '@/app/services/productService';
import {
  studioProductionV3Service,
  type StudioProductionOrderV3,
  type StudioProductionStageV3,
} from '@/app/services/studioProductionV3Service';

export const STUDIO_PRODUCTION_V3_SOURCE = 'studio_production_v3';

/** Get next SKU in form STUDIO-DRESS-001, STUDIO-DRESS-002, ... */
export async function getNextStudioProductSKU(companyId: string): Promise<string> {
  const { data, error } = await supabase
    .from('products')
    .select('sku')
    .eq('company_id', companyId)
    .like('sku', 'STUDIO-DRESS-%')
    .order('sku', { ascending: false })
    .limit(1);

  if (error) throw error;
  if (!data?.length) return 'STUDIO-DRESS-001';

  const last = (data[0] as { sku: string }).sku;
  const match = last.match(/STUDIO-DRESS-(\d+)/i);
  const nextNum = match ? parseInt(match[1], 10) + 1 : 1;
  return `STUDIO-DRESS-${String(nextNum).padStart(3, '0')}`;
}

export interface ProductionCostSummaryV3 {
  productionCost: number;
  orderId: string;
  productionNo: string;
  allStagesCompleted: boolean;
  stages: { stage_name: string; worker_name: string | null; worker_cost: number }[];
}

export async function getProductionCostSummaryV3(orderId: string): Promise<ProductionCostSummaryV3> {
  const order = await studioProductionV3Service.getOrderById(orderId);
  if (!order) throw new Error('Production order not found');

  const stages = await studioProductionV3Service.getStagesByOrderId(orderId);
  const workerIds = [...new Set(stages.map((s) => s.worker_id).filter(Boolean))] as string[];
  let workerNames: Record<string, string> = {};
  if (workerIds.length > 0) {
    const { data: workers } = await supabase.from('workers').select('id, name').in('id', workerIds);
    workerNames = (workers ?? []).reduce((acc, w: { id: string; name?: string }) => {
      acc[w.id] = w.name ?? '—';
      return acc;
    }, {} as Record<string, string>);
  }

  const stageRows = stages.map((s) => ({
    stage_name: s.stage_name,
    worker_name: s.worker_id ? workerNames[s.worker_id] ?? null : null,
    worker_cost: Number(s.actual_cost) || 0,
  }));
  const productionCost = stageRows.reduce((sum, r) => sum + r.worker_cost, 0);
  const allStagesCompleted = stages.length > 0 && stages.every((s) => s.status === 'completed');

  return {
    productionCost,
    orderId,
    productionNo: order.production_no,
    allStagesCompleted,
    stages: stageRows,
  };
}

export interface SaleInfoForOrderV3 {
  customer_id: string | null;
  customer_name: string;
  contact_number: string | null;
  company_id: string;
  branch_id: string;
  productId: string | null;
  productName: string;
  productSku: string;
}

export async function getSaleInfoForOrderV3(orderId: string): Promise<SaleInfoForOrderV3> {
  const order = await studioProductionV3Service.getOrderById(orderId);
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

  let productId: string | null = order.product_id;
  let productName = 'Studio Product';
  let productSku = 'STUDIO-DRESS-001';

  if (order.product_id) {
    const { data: prod } = await supabase
      .from('products')
      .select('id, name, sku')
      .eq('id', order.product_id)
      .maybeSingle();
    if (prod) {
      productId = (prod as { id: string }).id;
      productName = (prod as { name?: string }).name ?? productName;
      productSku = (prod as { sku?: string }).sku ?? productSku;
    }
  }

  if (!productId) {
    const { data: items } = await supabase
      .from('sales_items')
      .select('product_id, product_name, sku')
      .eq('sale_id', order.sale_id)
      .limit(1);
    if (items?.length) {
      const first = items[0] as { product_id: string; product_name?: string; sku?: string };
      productId = first.product_id;
      productName = first.product_name ?? productName;
      productSku = first.sku ?? productSku;
    }
  }

  return {
    customer_id: saleRow.customer_id ?? null,
    customer_name: saleRow.customer_name || 'Customer',
    contact_number: saleRow.contact_number ?? null,
    company_id: saleRow.company_id,
    branch_id: saleRow.branch_id,
    productId,
    productName,
    productSku,
  };
}

/**
 * Create product from V3 production order and link to order.
 */
export async function createProductFromProductionOrderV3(params: {
  productionOrderId: string;
  productName: string;
  companyId: string;
  categoryId?: string | null;
}): Promise<{ productId: string; sku: string }> {
  const { productionOrderId, productName, companyId, categoryId } = params;

  const order = await studioProductionV3Service.getOrderById(productionOrderId);
  if (!order) throw new Error('Production order not found');
  if (order.product_id) {
    throw new Error('A product is already linked to this production.');
  }

  const sku = await getNextStudioProductSKU(companyId);
  const product = await productService.createProduct({
    company_id: companyId,
    name: (productName || `Studio – ${order.production_no}`).trim(),
    sku,
    category_id: categoryId ?? (null as any),
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
  await studioProductionV3Service.updateOrder(productionOrderId, { product_id: created.id });
  return { productId: created.id, sku: created.sku || sku };
}

/**
 * Build cost breakdown rows for storage and invoice display.
 */
function buildCostBreakdownRows(
  stages: { stage_name: string; worker_name: string | null; worker_cost: number }[],
  profitAmount: number
): { stage_name: string; worker_name: string | null; worker_cost: number; type: 'worker_cost' | 'profit' }[] {
  const rows = stages.map((s) => ({
    stage_name: s.stage_name,
    worker_name: s.worker_name,
    worker_cost: s.worker_cost,
    type: 'worker_cost' as const,
  }));
  if (profitAmount > 0) {
    rows.push({
      stage_name: 'Profit',
      worker_name: null,
      worker_cost: profitAmount,
      type: 'profit',
    });
  }
  return rows;
}

/**
 * Generate sales invoice from completed V3 order.
 * Optionally include shipping; store breakdown; set show_studio_breakdown on sale.
 */
export async function generateSalesInvoiceFromProductionV3(params: {
  productionOrderId: string;
  finalPrice: number;
  shippingAmount?: number;
  showProductionDetail?: boolean;
  createdBy: string;
}): Promise<{ saleId: string; invoiceNo: string }> {
  const { productionOrderId, finalPrice, shippingAmount = 0, showProductionDetail = false, createdBy } = params;

  const order = await studioProductionV3Service.getOrderById(productionOrderId);
  if (!order) throw new Error('Production order not found');
  if (order.generated_invoice_id) {
    throw new Error('Invoice already generated for this production.');
  }

  const [costSummary, saleInfo] = await Promise.all([
    getProductionCostSummaryV3(productionOrderId),
    getSaleInfoForOrderV3(productionOrderId),
  ]);

  if (!saleInfo.productId) {
    throw new Error('Link or create a product for this production before generating the invoice.');
  }

  const profitAmount = Math.max(0, finalPrice - costSummary.productionCost - shippingAmount);
  const breakdownRows = buildCostBreakdownRows(costSummary.stages, profitAmount);
  await studioProductionV3Service.saveCostBreakdown(productionOrderId, breakdownRows);

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

  const total = finalPrice + shippingAmount;
  const saleDate = new Date().toISOString().split('T')[0];

  const sale: Sale & { source?: string; source_id?: string; show_studio_breakdown?: boolean } = {
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
    subtotal: finalPrice,
    discount_amount: 0,
    tax_amount: 0,
    expenses: shippingAmount,
    total,
    paid_amount: 0,
    due_amount: total,
    return_due: 0,
    notes: `Generated from Studio Production V3 ${order.production_no}`,
    created_by: createdBy,
    source: STUDIO_PRODUCTION_V3_SOURCE,
    source_id: productionOrderId,
    show_studio_breakdown: showProductionDetail,
  };

  const items: SaleItem[] = [
    {
      product_id: saleInfo.productId,
      product_name: saleInfo.productName,
      sku: saleInfo.productSku,
      quantity: 1,
      unit: 'piece',
      unit_price: finalPrice,
      total: finalPrice,
    },
  ];

  const created = await saleService.createSale(sale, items, { allowNegativeStock: true });
  if (!created?.id) throw new Error('Failed to create sale');

  await supabase.from('sales').update({ show_studio_breakdown: showProductionDetail }).eq('id', created.id);

  // Update product cost_price for COGS calculation (matches V1/V2 pattern)
  if (saleInfo.productId && costSummary.productionCost > 0) {
    await supabase.from('products').update({ cost_price: costSummary.productionCost }).eq('id', saleInfo.productId);
  }

  const profitPercent = costSummary.productionCost > 0
    ? (profitAmount / costSummary.productionCost) * 100
    : null;
  await studioProductionV3Service.updateOrder(productionOrderId, {
    generated_invoice_id: created.id,
    status: 'completed',
    final_price: finalPrice,
    profit_amount: profitAmount,
    profit_percent: profitPercent,
  });

  dispatchSaleLifecycleInvalidated({
    companyId: saleInfo.company_id,
    branchId: saleInfo.branch_id,
    customerId: saleInfo.customer_id,
    saleId: created.id,
    reason: 'studio-v3-invoice-generated',
  });
  dispatchStudioDataInvalidated({
    companyId: saleInfo.company_id,
    branchId: saleInfo.branch_id,
    reason: 'studio-v3-invoice-generated',
  });

  return { saleId: created.id, invoiceNo: (created as { invoice_no?: string }).invoice_no || invoiceNo };
}
