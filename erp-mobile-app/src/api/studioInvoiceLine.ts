/**
 * Mobile parity with web StudioSaleDetailNew.handleCreateProductAndInvoice:
 * upsert sales_items studio line, recalc sale totals, link studio_productions.generated_*.
 *
 * When every production stage is already `completed`, `upsertStudioInvoiceLine` calls
 * `tryFinalizeStudioProductionAfterInvoice` so sale becomes `final`, worker/stock steps run,
 * and `record_sale_with_accounting` posts the document JE (same RPC as other mobile documents).
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { createProduct, getNextProductSKU } from './products';
import { updateStudioProductionDesignName } from './studio';
import { tryFinalizeStudioProductionAfterMobileInvoice } from './studioFinalizeAfterInvoice';

export type StudioInvoiceProductRow = {
  id: string;
  name: string;
  sku: string;
  category_id: string | null;
};

/** Search products by name (studio invoice picker). */
export async function searchProductsForStudioInvoice(
  companyId: string,
  query: string
): Promise<{ data: StudioInvoiceProductRow[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  const q = (query || '').trim();
  if (!q) return { data: [], error: null };
  try {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, sku, category_id')
      .eq('company_id', companyId)
      .ilike('name', `%${q}%`)
      .eq('is_active', true)
      .limit(25);
    if (error) return { data: [], error: error.message };
    return {
      data: (data || []).map((r: Record<string, unknown>) => ({
        id: String(r.id),
        name: String(r.name ?? ''),
        sku: String(r.sku ?? ''),
        category_id: (r.category_id as string) ?? null,
      })),
      error: null,
    };
  } catch (e: unknown) {
    return { data: [], error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

async function setGeneratedInvoiceItemForMobile(
  productionId: string,
  generatedProductId: string,
  generatedInvoiceItemId: string
): Promise<void> {
  const { data: existing, error: fetchErr } = await supabase
    .from('studio_productions')
    .select(
      'id, status, quantity, actual_cost, company_id, branch_id, product_id, production_no'
    )
    .eq('id', productionId)
    .maybeSingle();
  if (fetchErr) throw new Error(fetchErr.message);
  const { error } = await supabase
    .from('studio_productions')
    .update({
      generated_product_id: generatedProductId,
      generated_invoice_item_id: generatedInvoiceItemId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', productionId);
  if (error) throw new Error(error.message);
  if (!existing || String((existing as { status?: string }).status || '') !== 'completed') return;
  const qty = Number((existing as { quantity?: number }).quantity) || 0;
  if (qty <= 0) return;
  const { data: existingMov } = await supabase
    .from('stock_movements')
    .select('id')
    .eq('reference_type', 'studio_production')
    .eq('reference_id', productionId)
    .eq('movement_type', 'PRODUCTION_IN')
    .eq('product_id', generatedProductId)
    .limit(1)
    .maybeSingle();
  if (existingMov) return;
  const ex = existing as {
    company_id: string;
    branch_id: string | null;
    actual_cost?: number | null;
    product_id?: string | null;
    production_no?: string | null;
  };
  const movementPayload: Record<string, unknown> = {
    company_id: ex.company_id,
    branch_id: ex.branch_id,
    product_id: generatedProductId,
    movement_type: 'PRODUCTION_IN',
    quantity: qty,
    unit_cost: ex.actual_cost ? Number(ex.actual_cost) / qty : 0,
    total_cost: ex.actual_cost ?? 0,
    reference_type: 'studio_production',
    reference_id: productionId,
    notes: `Production ${ex.production_no ?? ''} completed (studio line linked)`,
    created_by: null,
  };
  const { error: movErr } = await supabase.from('stock_movements').insert(movementPayload);
  if (movErr) {
    console.warn('[studioInvoiceLine] PRODUCTION_IN insert failed:', movErr.message);
    return;
  }
  const fabricProductId = ex.product_id;
  if (fabricProductId && fabricProductId !== generatedProductId) {
    await supabase.from('stock_movements').insert({
      company_id: ex.company_id,
      branch_id: ex.branch_id,
      product_id: fabricProductId,
      movement_type: 'adjustment',
      quantity: -qty,
      unit_cost: 0,
      total_cost: 0,
      reference_type: 'studio_production',
      reference_id: productionId,
      notes: `Reclass: stock moved to studio product (${ex.production_no ?? ''})`,
      created_by: null,
    });
  }
}

export interface UpsertStudioInvoiceLineInput {
  companyId: string;
  branchId: string | null;
  saleId: string;
  /** Primary studio_productions row for this order line */
  productionId: string;
  invoiceNoLabel: string;
  salePrice: number;
  /** Resolved product name for new create path */
  productName: string;
  categoryId?: string | null;
  description?: string | null;
  /** When set, reuse this product (exact) — no new row */
  existingProductId?: string | null;
  syncReplicaTitle?: boolean;
}

export interface UpsertStudioInvoiceLineResult {
  productId: string;
  productName: string;
  invoiceItemId: string;
}

/**
 * Create/reuse product, upsert studio invoice line on sale, link production.
 */
export async function upsertStudioInvoiceLine(
  input: UpsertStudioInvoiceLineInput
): Promise<{ data: UpsertStudioInvoiceLineResult | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  const price = Number(input.salePrice);
  if (!Number.isFinite(price) || price <= 0) return { data: null, error: 'Enter a valid sale price.' };

  try {
    let product: { id: string; name: string; sku: string };

    if (input.existingProductId) {
      const { data: row, error: pe } = await supabase
        .from('products')
        .select('id, name, sku')
        .eq('id', input.existingProductId)
        .eq('company_id', input.companyId)
        .maybeSingle();
      if (pe || !row) return { data: null, error: pe?.message || 'Product not found' };
      const r = row as { id: string; name: string; sku: string };
      product = { id: r.id, name: r.name, sku: r.sku ?? '' };
    } else {
      const name =
        (input.productName || '').trim() || `Studio – ${input.invoiceNoLabel}`;
      const { data: existingRows } = await supabase
        .from('products')
        .select('id, name, sku')
        .eq('company_id', input.companyId)
        .ilike('name', name)
        .limit(1);
      if (existingRows && existingRows.length > 0) {
        const r = existingRows[0] as { id: string; name: string; sku: string };
        product = { id: r.id, name: r.name, sku: r.sku ?? '' };
      } else {
        const sku = await getNextProductSKU(input.companyId, input.branchId).catch(() =>
          `STD-PROD-${Date.now().toString(36).toUpperCase()}`
        );
        const { data: created, error: ce } = await createProduct(input.companyId, {
          name,
          sku,
          categoryId: input.categoryId ?? null,
          description: input.description ?? undefined,
          costPrice: 0,
          retailPrice: price,
          wholesalePrice: price,
          stock: 0,
          minStock: 0,
          unit: 'piece',
          status: 'active',
          hasVariations: false,
        });
        if (ce || !created) return { data: null, error: ce || 'Failed to create product' };
        product = { id: created.id, name: created.name, sku: created.sku };
      }
    }

    const itemUpdatePayload: Record<string, unknown> = {
      product_id: product.id,
      product_name: product.name,
      sku: product.sku,
      unit_price: price,
      total: price,
      is_studio_product: true,
    };

    let finalItemId: string | null = null;
    const { data: prodRow } = await supabase
      .from('studio_productions')
      .select('generated_invoice_item_id')
      .eq('id', input.productionId)
      .maybeSingle();
    finalItemId = (prodRow as { generated_invoice_item_id?: string | null } | null)?.generated_invoice_item_id ?? null;

    if (!finalItemId) {
      const { data: studioItems } = await supabase
        .from('sales_items')
        .select('id')
        .eq('sale_id', input.saleId)
        .eq('is_studio_product', true)
        .limit(1);
      if (studioItems && studioItems.length > 0) {
        finalItemId = (studioItems[0] as { id: string }).id;
      }
    }

    if (finalItemId) {
      const { data: oldItemBefore } = await supabase
        .from('sales_items')
        .select('total')
        .eq('id', finalItemId)
        .maybeSingle();
      const oldItemTotal = Number((oldItemBefore as { total?: number })?.total) || 0;
      const { error: upErr } = await supabase.from('sales_items').update(itemUpdatePayload).eq('id', finalItemId);
      if (upErr) throw new Error(upErr.message || 'Failed to update invoice item');
      const { data: saleRow } = await supabase.from('sales').select('total, paid_amount').eq('id', input.saleId).single();
      const currentTotal = Number((saleRow as { total?: number })?.total) || 0;
      const paid = Number((saleRow as { paid_amount?: number })?.paid_amount) || 0;
      const newTotal = Math.max(0, currentTotal - oldItemTotal + price);
      const newDue = Math.max(0, newTotal - paid);
      await supabase
        .from('sales')
        .update({ total: newTotal, due_amount: newDue, updated_at: new Date().toISOString() })
        .eq('id', input.saleId);
    } else {
      const insertRow: Record<string, unknown> = {
        sale_id: input.saleId,
        quantity: 1,
        ...itemUpdatePayload,
      };
      const { data: inserted, error: insErr } = await supabase.from('sales_items').insert(insertRow).select('id').single();
      if (insErr) {
        const fallback: Record<string, unknown> = {
          sale_id: input.saleId,
          quantity: 1,
          product_id: product.id,
          product_name: product.name,
          sku: product.sku,
          unit_price: price,
          total: price,
          is_studio_product: true,
        };
        const { data: fbData, error: fbErr } = await supabase.from('sales_items').insert(fallback).select('id').single();
        if (fbErr) throw new Error(fbErr.message || 'Failed to add invoice line');
        finalItemId = (fbData as { id: string })?.id ?? null;
      } else {
        finalItemId = (inserted as { id: string })?.id ?? null;
      }
      const { data: saleRow } = await supabase.from('sales').select('total, paid_amount').eq('id', input.saleId).single();
      const currentTotal = Number((saleRow as { total?: number })?.total) || 0;
      const paid = Number((saleRow as { paid_amount?: number })?.paid_amount) || 0;
      const newTotal = currentTotal + price;
      const newDue = Math.max(0, newTotal - paid);
      await supabase
        .from('sales')
        .update({ total: newTotal, due_amount: newDue, updated_at: new Date().toISOString() })
        .eq('id', input.saleId);
    }

    if (!finalItemId) throw new Error('Could not resolve invoice line');

    await setGeneratedInvoiceItemForMobile(input.productionId, product.id, finalItemId);

    if (input.syncReplicaTitle !== false && product.name.trim()) {
      await updateStudioProductionDesignName(input.productionId, product.name.trim());
    }

    try {
      const fin = await tryFinalizeStudioProductionAfterMobileInvoice({ productionId: input.productionId });
      if (fin.ok === false) {
        console.warn('[studioInvoiceLine] Finalize after invoice:', fin.error);
      }
    } catch (e: unknown) {
      console.warn('[studioInvoiceLine] Finalize after invoice (non-fatal):', e);
    }

    return {
      data: { productId: product.id, productName: product.name, invoiceItemId: finalItemId },
      error: null,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { data: null, error: msg };
  }
}
