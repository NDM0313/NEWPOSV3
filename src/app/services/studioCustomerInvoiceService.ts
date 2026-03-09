/**
 * Studio Customer Invoice Service (Safe Zone)
 * Generates customer sale invoice from a completed Studio Production V2 order.
 * Does NOT modify existing production cost logic. Worker costs remain separate.
 * Accounting: Production complete = Dr Finished Goods (1200) Cr Production Cost (5000).
 *             Sale = Dr AR Cr Sales; Dr COGS Cr Inventory.
 */

import { supabase } from '@/lib/supabase';
import { documentNumberService } from '@/app/services/documentNumberService';
import { saleService, type Sale, type SaleItem } from '@/app/services/saleService';
import { productService } from '@/app/services/productService';
import { studioProductionV2Service } from '@/app/services/studioProductionV2Service';
import { accountHelperService } from '@/app/services/accountHelperService';
import { accountingService, type JournalEntry, type JournalEntryLine } from '@/app/services/accountingService';

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

  // Accounting: Dr AR Cr Sales; Dr COGS Cr Inventory (studio invoice)
  try {
    const arAccount = await accountHelperService.getAccountByCode('1100', saleInfo.company_id);
    const salesAccount = await accountHelperService.getAccountByCode('4000', saleInfo.company_id);
    if (arAccount?.id && salesAccount?.id) {
      const lines: JournalEntryLine[] = [
        { id: '', journal_entry_id: '', account_id: arAccount.id, debit: customerPrice, credit: 0, description: `AR – ${invoiceNo}` },
        { id: '', journal_entry_id: '', account_id: salesAccount.id, debit: 0, credit: customerPrice, description: `Sales – ${invoiceNo}` },
      ];
      const productionCost = costSummary.productionCost || 0;
      if (productionCost > 0) {
        const cogsAccount = await accountHelperService.getAccountByCode('5100', saleInfo.company_id);
        const invAccount = await accountHelperService.getAccountByCode('1200', saleInfo.company_id);
        if (cogsAccount?.id && invAccount?.id) {
          lines.push({ id: '', journal_entry_id: '', account_id: cogsAccount.id, debit: productionCost, credit: 0, description: 'COGS – studio sale' });
          lines.push({ id: '', journal_entry_id: '', account_id: invAccount.id, debit: 0, credit: productionCost, description: 'Inventory – studio sale' });
        }
      }
      const entry: JournalEntry = {
        id: '',
        company_id: saleInfo.company_id,
        branch_id: saleInfo.branch_id,
        entry_no: `JE-STD-SL-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
        entry_date: saleDate,
        description: `Studio sale ${invoiceNo} to ${saleInfo.customer_name}`,
        reference_type: 'sale',
        reference_id: created.id,
        created_by: createdBy ?? undefined,
      };
      await accountingService.createEntry(entry, lines);
    }
  } catch (accountingErr: any) {
    console.warn('[studioCustomerInvoiceService] Sale accounting entry failed (sale already created):', accountingErr?.message);
  }

  return { saleId: created.id, invoiceNo: created.invoice_no || invoiceNo };
}

/**
 * Create a product from a completed production order (Job Order → Product flow).
 * Uses STD-PROD-xxxx SKU, product_type = 'production', and adds finished goods to inventory.
 */
export async function createProductFromProductionOrder(params: {
  productionOrderId: string;
  productName: string;
  companyId: string;
  categoryId?: string | null;
  branchId?: string | null;
  createdBy?: string | null;
}): Promise<{ productId: string; sku: string }> {
  const { productionOrderId, productName, companyId, categoryId, branchId, createdBy } = params;

  const order = await studioProductionV2Service.getOrderById(productionOrderId);
  if (!order) throw new Error('Production order not found');
  if (order.product_id) {
    throw new Error('A product is already linked to this production. Use "Generate Sale Invoice" to create the customer invoice.');
  }

  const sku = await documentNumberService.getNextProductionProductSKU(companyId);
  const costFromStages = await getProductionCostSummary(productionOrderId);
  const productionCost = costFromStages.productionCost || 0;

  const product = await productService.createProduct({
    company_id: companyId,
    name: productName.trim() || `Studio – ${order.production_no}`,
    sku,
    category_id: categoryId || (null as any),
    cost_price: productionCost,
    retail_price: 0,
    wholesale_price: 0,
    current_stock: 0,
    min_stock: 0,
    max_stock: 1000,
    has_variations: false,
    is_rentable: false,
    is_sellable: true,
    track_stock: true,
    is_active: true,
    product_type: 'production',
  });

  const created = product as { id: string; sku: string };
  await supabase
    .from('studio_production_orders_v2')
    .update({ product_id: created.id })
    .eq('id', productionOrderId);

  await productService.createStockMovement({
    company_id: companyId,
    branch_id: branchId ?? (order as { branch_id?: string }).branch_id ?? undefined,
    product_id: created.id,
    movement_type: 'production',
    quantity: 1,
    unit_cost: productionCost,
    reference_type: 'studio_production',
    reference_id: productionOrderId,
    notes: `Studio production ${order.production_no}`,
    created_by: createdBy ?? undefined,
  });

  // Accounting: Dr Finished Goods Inventory (1200) Cr Production Cost (5000)
  if (productionCost > 0) {
    const invAccount = await accountHelperService.getAccountByCode('1200', companyId);
    const prodCostAccount = await accountHelperService.getAccountByCode('5000', companyId);
    if (invAccount?.id && prodCostAccount?.id) {
      const entryNo = `JE-STD-FG-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
      const entry: JournalEntry = {
        id: '',
        company_id: companyId,
        branch_id: branchId ?? (order as { branch_id?: string }).branch_id ?? undefined,
        entry_no: entryNo,
        entry_date: new Date().toISOString().split('T')[0],
        description: `Finished goods from studio production ${order.production_no}`,
        reference_type: 'studio_production',
        reference_id: productionOrderId,
        created_by: createdBy ?? undefined,
      };
      const lines: JournalEntryLine[] = [
        { id: '', journal_entry_id: '', account_id: invAccount.id, debit: productionCost, credit: 0, description: 'Finished goods inventory' },
        { id: '', journal_entry_id: '', account_id: prodCostAccount.id, debit: 0, credit: productionCost, description: 'Production cost' },
      ];
      await accountingService.createEntry(entry, lines);
    }
  }

  return { productId: created.id, sku: created.sku || sku };
}

/**
 * Link an existing production product to this order (Use Existing Production Product).
 * Only products with product_type = 'production' should be selected.
 */
export async function linkExistingProductToProductionOrder(params: {
  productionOrderId: string;
  productId: string;
}): Promise<void> {
  const { productionOrderId, productId } = params;
  const order = await studioProductionV2Service.getOrderById(productionOrderId);
  if (!order) throw new Error('Production order not found');
  if (order.product_id) {
    throw new Error('A product is already linked to this production.');
  }

  const { data: prod, error: prodErr } = await supabase
    .from('products')
    .select('id, product_type')
    .eq('id', productId)
    .eq('company_id', order.company_id)
    .maybeSingle();
  if (prodErr || !prod) throw new Error('Product not found');
  if ((prod as { product_type?: string }).product_type !== 'production') {
    throw new Error('Only production products (STD-PROD) can be linked. Select a product created from studio production.');
  }

  const { error } = await supabase
    .from('studio_production_orders_v2')
    .update({ product_id: productId })
    .eq('id', productionOrderId);
  if (error) throw new Error(error.message);
}

/** Search production products (product_type = 'production') for "Use Existing" in Create Product modal. */
export async function searchProductionProducts(params: {
  companyId: string;
  query?: string;
  limit?: number;
}): Promise<{ id: string; name: string; sku: string }[]> {
  const { companyId, query = '', limit = 20 } = params;
  let q = supabase
    .from('products')
    .select('id, name, sku')
    .eq('company_id', companyId)
    .eq('product_type', 'production')
    .eq('is_active', true)
    .order('sku', { ascending: false })
    .limit(limit);
  const term = query.trim();
  if (term) {
    q = q.or(`name.ilike.%${term}%,sku.ilike.%${term}%`);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as { id: string; name: string; sku: string }[];
}
