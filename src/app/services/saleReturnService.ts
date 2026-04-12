import { supabase } from '@/lib/supabase';
import { productService } from './productService';
import { accountingService } from './accountingService';
import { saleAccountingService } from './saleAccountingService';

function roundMoney2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** Original sale line shape used to proportionalize return stock $ (never full line on partial qty). */
type OriginalSaleLineRow = {
  id?: string;
  product_id: string;
  variation_id?: string | null;
  quantity: number;
  total?: number | null;
  unit_price?: number | null;
  price?: number | null;
};

function matchOriginalSaleLineForReturnItem(
  returnItem: { sale_item_id?: string | null; product_id: string; variation_id?: string | null },
  originalItems: OriginalSaleLineRow[]
): OriginalSaleLineRow | undefined {
  if (returnItem.sale_item_id) {
    const byId = originalItems.find((o) => o.id && String(o.id) === String(returnItem.sale_item_id));
    if (byId) return byId;
  }
  return originalItems.find(
    (oi) =>
      oi.product_id === returnItem.product_id &&
      (oi.variation_id === returnItem.variation_id || (!oi.variation_id && !returnItem.variation_id))
  );
}

/**
 * Canonical stock economics for a sale return line.
 * Linked returns: inventory value = (returned_qty / original_qty) × original_line_total (never full line on partial qty).
 * Standalone: qty × unit_price, with total/qty fallback when unit is missing.
 */
export function canonicalSaleReturnStockEconomics(
  returnItem: { quantity: unknown; unit_price: unknown; total: unknown; sale_item_id?: string | null; product_id: string; variation_id?: string | null },
  originalLine: OriginalSaleLineRow | undefined
): { qty: number; unitCost: number; totalCost: number } {
  const qty = Math.abs(Number(returnItem.quantity) || 0);

  if (originalLine) {
    const oq = Math.abs(Number(originalLine.quantity) || 0);
    const oTotalRaw =
      Number(originalLine.total ?? 0) ||
      (oq > 0 ? oq * (Number(originalLine.unit_price ?? originalLine.price ?? 0) || 0) : 0);
    const oTotal = roundMoney2(oTotalRaw);
    if (oq > 0 && oTotal > 0 && qty > 0) {
      const isFull = Math.abs(qty - oq) < 1e-6;
      const totalCost = isFull ? oTotal : roundMoney2((qty / oq) * oTotal);
      const unitCost = qty > 0 ? roundMoney2(totalCost / qty) : roundMoney2(oTotal / oq);
      return { qty, unitCost, totalCost };
    }
  }

  const storedUnit = Number(returnItem.unit_price) || 0;
  const storedTotal = Number(returnItem.total) || 0;
  let unitCost = storedUnit;
  let totalCost = qty > 0 && unitCost > 0 ? roundMoney2(qty * unitCost) : roundMoney2(storedTotal);
  if (qty > 0 && totalCost <= 0 && storedTotal > 0) {
    unitCost = roundMoney2(storedTotal / qty);
    totalCost = roundMoney2(qty * unitCost);
  }
  if (qty > 0 && unitCost <= 0 && totalCost > 0) {
    unitCost = roundMoney2(totalCost / qty);
  }
  return { qty, unitCost: roundMoney2(unitCost), totalCost: roundMoney2(totalCost) };
}

async function saleReturnHasStockLine(
  companyId: string,
  returnId: string,
  movementType: 'sale_return' | 'sale_return_void',
  productId: string,
  variationId: string | null | undefined
): Promise<boolean> {
  let q = supabase
    .from('stock_movements')
    .select('id')
    .eq('company_id', companyId)
    .eq('reference_type', 'sale_return')
    .eq('reference_id', returnId)
    .eq('movement_type', movementType)
    .eq('product_id', productId)
    .limit(1);
  if (variationId) q = q.eq('variation_id', variationId);
  else q = q.is('variation_id', null);
  const { data } = await q.maybeSingle();
  return !!data;
}
export interface SaleReturn {
  id?: string;
  company_id: string;
  branch_id: string;
  /** When null = standalone return (no invoice); when set = return against this sale */
  original_sale_id?: string | null;
  return_no?: string;
  return_date: string;
  customer_id?: string;
  customer_name: string;
  status: 'draft' | 'final' | 'void';
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  reason?: string;
  notes?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SaleReturnItem {
  id?: string;
  sale_return_id: string;
  sale_item_id?: string;
  product_id: string;
  variation_id?: string;
  product_name: string;
  sku: string;
  quantity: number;
  unit?: string;
  unit_price: number;
  total: number;
  notes?: string;
  // Packing fields - preserved from original sale item
  packing_type?: string;
  packing_quantity?: number;
  packing_unit?: string;
  packing_details?: any; // JSONB
  // Return packing details - piece-level selection
  return_packing_details?: any; // JSONB - { returned_pieces: [{ box_no, piece_no, meters }], returned_boxes, returned_pieces_count, returned_total_meters }
}

export interface CreateSaleReturnData {
  company_id: string;
  branch_id: string;
  /** Omit or null = standalone return (no invoice) */
  original_sale_id?: string | null;
  return_date: string;
  customer_id?: string;
  customer_name: string;
  items: Array<{
    sale_item_id?: string;
    product_id: string;
    variation_id?: string;
    product_name: string;
    sku: string;
    quantity: number;
    unit?: string;
    unit_price: number;
    total: number;
    notes?: string;
    // Packing fields - preserved from original sale item
    packing_type?: string;
    packing_quantity?: number;
    packing_unit?: string;
    packing_details?: any; // JSONB
    // Return packing - piece-level selection (from Return Packing dialog only)
    return_packing_details?: any; // JSONB
  }>;
  reason?: string;
  notes?: string;
  created_by?: string;
  subtotal?: number; // Optional: if provided, use it; otherwise calculate from items
  discount_amount?: number; // Optional: discount on return amount
  total?: number; // Optional: final adjusted total; if provided, use it; otherwise calculate
}

/** Data for updating a draft sale return (same shape as create items; header fields optional) */
export type UpdateSaleReturnData = {
  return_date?: string;
  customer_id?: string;
  customer_name?: string;
  items: CreateSaleReturnData['items'];
  reason?: string;
  notes?: string;
  subtotal?: number;
  discount_amount?: number;
  total?: number;
};

export const saleReturnService = {
  /**
   * Create a new sale return (draft or final)
   */
  async createSaleReturn(data: CreateSaleReturnData): Promise<SaleReturn> {
    const { company_id, branch_id, original_sale_id, return_date, customer_id, customer_name, items, reason, notes, created_by, subtotal: providedSubtotal, discount_amount: providedDiscount, total: providedTotal } = data;

    // Calculate totals - use provided values if available, otherwise calculate
    const subtotal = providedSubtotal !== undefined ? providedSubtotal : items.reduce((sum, item) => sum + item.total, 0);
    const discount_amount = providedDiscount !== undefined ? providedDiscount : 0;
    const tax_amount = 0; // Can be enhanced later
    const total = providedTotal !== undefined ? providedTotal : (subtotal - discount_amount + tax_amount);

    // Generate return number
    const return_no = await this.generateReturnNumber(company_id, branch_id);

    // Create sale return record as DRAFT so finalizeSaleReturn() can run (stock + accounting, then status = final)
    const { data: saleReturn, error: returnError } = await supabase
      .from('sale_returns')
      .insert({
        company_id,
        branch_id,
        original_sale_id: original_sale_id ?? null,
        return_no,
        return_date,
        customer_id: customer_id || null,
        customer_name: customer_name || 'Walk-in',
        status: 'draft',
        subtotal,
        discount_amount,
        tax_amount,
        total,
        reason: reason || null,
        notes: notes || null,
        created_by: created_by || null,
      })
      .select()
      .single();

    if (returnError) throw returnError;
    if (!saleReturn) throw new Error('Failed to create sale return');

    // Create return items (preserve packing structure from original sale)
    const returnItems = items.map(item => ({
      sale_return_id: saleReturn.id,
      sale_item_id: item.sale_item_id || null,
      product_id: item.product_id,
      variation_id: item.variation_id || null,
      product_name: item.product_name,
      sku: item.sku,
      quantity: item.quantity,
      unit: item.unit || 'piece',
      unit_price: item.unit_price,
      total: item.total,
      notes: item.notes || null,
      // Preserve packing structure from original sale item
      packing_type: item.packing_type || null,
      packing_quantity: item.packing_quantity || null,
      packing_unit: item.packing_unit || null,
      packing_details: item.packing_details || null,
      // NEW: Return packing details (piece-level selection)
      return_packing_details: item.return_packing_details || null,
    }));

    const { error: itemsError } = await supabase
      .from('sale_return_items')
      .insert(returnItems);

    if (itemsError) throw itemsError;

    return saleReturn as SaleReturn;
  },

  /**
   * Update a draft sale return only. Final returns are locked.
   */
  async updateSaleReturn(returnId: string, companyId: string, data: UpdateSaleReturnData): Promise<SaleReturn> {
    const { data: existing, error: fetchErr } = await supabase
      .from('sale_returns')
      .select('id, status, branch_id, original_sale_id, return_date, customer_id, customer_name, reason, notes')
      .eq('id', returnId)
      .eq('company_id', companyId)
      .single();
    if (fetchErr || !existing) throw new Error('Sale return not found');
    if (existing.status === 'final') throw new Error('Cannot update a finalized sale return. It is locked.');
    if (String(existing.status || '').toLowerCase() === 'void') {
      throw new Error('Cannot update a voided sale return. It is locked for audit (same as a cancelled purchase return).');
    }

    const { return_date, customer_id, customer_name, items, reason, notes, subtotal: providedSubtotal, discount_amount: providedDiscount, total: providedTotal } = data;
    const subtotal = providedSubtotal !== undefined ? providedSubtotal : items.reduce((sum, item) => sum + item.total, 0);
    const discount_amount = providedDiscount !== undefined ? providedDiscount : 0;
    const tax_amount = 0;
    const total = providedTotal !== undefined ? providedTotal : (subtotal - discount_amount + tax_amount);

    const updatePayload: Record<string, unknown> = {
      return_date: return_date ?? existing.return_date,
      subtotal,
      discount_amount,
      tax_amount,
      total,
      updated_at: new Date().toISOString(),
    };
    if (customer_id !== undefined) updatePayload.customer_id = customer_id;
    if (customer_name !== undefined) updatePayload.customer_name = customer_name;
    if (reason !== undefined) updatePayload.reason = reason;
    if (notes !== undefined) updatePayload.notes = notes;

    const { error: updateError } = await supabase
      .from('sale_returns')
      .update(updatePayload)
      .eq('id', returnId)
      .eq('company_id', companyId)
      .eq('status', 'draft');
    if (updateError) throw updateError;

    const { error: deleteItemsErr } = await supabase
      .from('sale_return_items')
      .delete()
      .eq('sale_return_id', returnId);
    if (deleteItemsErr) throw deleteItemsErr;

    const returnItems = items.map(item => ({
      sale_return_id: returnId,
      sale_item_id: item.sale_item_id || null,
      product_id: item.product_id,
      variation_id: item.variation_id || null,
      product_name: item.product_name,
      sku: item.sku,
      quantity: item.quantity,
      unit: item.unit || 'piece',
      unit_price: item.unit_price,
      total: item.total,
      notes: item.notes || null,
      packing_type: item.packing_type || null,
      packing_quantity: item.packing_quantity || null,
      packing_unit: item.packing_unit || null,
      packing_details: item.packing_details || null,
      return_packing_details: item.return_packing_details || null,
    }));
    const { error: itemsError } = await supabase
      .from('sale_return_items')
      .insert(returnItems);
    if (itemsError) throw itemsError;

    const { data: updated, error: selectErr } = await supabase
      .from('sale_returns')
      .select()
      .eq('id', returnId)
      .eq('company_id', companyId)
      .single();
    if (selectErr || !updated) throw new Error('Failed to fetch updated sale return');
    return updated as SaleReturn;
  },

  /**
   * Finalize a sale return - creates stock movements and accounting entries
   */
  async finalizeSaleReturn(
    returnId: string,
    companyId: string,
    branchId: string,
    userId?: string
  ): Promise<void> {
    // Get return with items
    const { data: saleReturn, error: returnError } = await supabase
      .from('sale_returns')
      .select(`
        *,
        items:sale_return_items(*)
      `)
      .eq('id', returnId)
      .eq('company_id', companyId)
      .single();

    if (returnError) throw returnError;
    if (!saleReturn) throw new Error('Sale return not found');
    const stInit = String(saleReturn.status || '').toLowerCase();
    if (stInit === 'final') return;
    if (stInit === 'void') throw new Error('Cannot finalize a voided sale return.');
    if (stInit !== 'draft') throw new Error('Sale return must be in draft status to finalize.');

    const isStandalone = !saleReturn.original_sale_id;
    let originalSale: { invoice_no?: string } | null = null;
    let originalItems: any[] = [];

    if (!isStandalone) {
      // Linked return: validate against original sale
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .select('invoice_no, status')
        .eq('id', saleReturn.original_sale_id)
        .single();

      if (saleError) throw saleError;
      if (!sale) throw new Error('Original sale not found');
      originalSale = sale;

      if (sale.status === 'draft' || sale.status === 'quotation') {
        throw new Error('Cannot return Draft or Quotation sales. Only Final sales can be returned.');
      }

      const { data: salesItemsData, error: salesItemsError } = await supabase
        .from('sales_items')
        .select('id, product_id, variation_id, quantity, total, unit_price, packing_details')
        .eq('sale_id', saleReturn.original_sale_id);

      if (salesItemsError) {
        if (salesItemsError.code === '42P01' || salesItemsError.message?.includes('does not exist')) {
          const { data: saleItemsData, error: saleItemsError } = await supabase
            .from('sale_items')
            .select('id, product_id, variation_id, quantity, total, unit_price, price, packing_details')
            .eq('sale_id', saleReturn.original_sale_id);
          if (!saleItemsError && saleItemsData) originalItems = saleItemsData;
        } else {
          console.warn('[SALE RETURN] Error loading original items for validation:', salesItemsError);
        }
      } else if (salesItemsData) {
        originalItems = salesItemsData;
      }

      if (originalItems.length > 0) {
        // Pre-fetch IDs of all FINAL returns for this sale (exclude drafts).
        // Drafts are abandoned attempts that didn't commit — they must not inflate alreadyReturned.
        // This is consistent with getOriginalSaleItems which also filters by status='final'.
        const { data: finalReturnsForSale } = await supabase
          .from('sale_returns')
          .select('id')
          .eq('original_sale_id', saleReturn.original_sale_id)
          .eq('company_id', companyId)
          .eq('status', 'final');
        const finalReturnIds: string[] = (finalReturnsForSale || []).map((r: any) => r.id);
        // Sentinel for .in() when list is empty (avoids PostgREST syntax error with empty array)
        const finalReturnIdsOrSentinel = finalReturnIds.length > 0
          ? finalReturnIds
          : ['00000000-0000-0000-0000-000000000000'];

        for (const returnItem of saleReturn.items) {
          const originalItem = originalItems.find(
            (oi: any) => oi.product_id === returnItem.product_id &&
            (oi.variation_id === returnItem.variation_id || (!oi.variation_id && !returnItem.variation_id))
          );
          if (!originalItem) {
            throw new Error(`Product ${returnItem.product_name} not found in original sale`);
          }
          let alreadyReturned = 0;
          if (returnItem.sale_item_id) {
            const { data: existingReturns } = await supabase
              .from('sale_return_items')
              .select('quantity')
              .eq('sale_item_id', returnItem.sale_item_id)
              .in('sale_return_id', finalReturnIdsOrSentinel);
            alreadyReturned = existingReturns?.reduce((sum: number, r: any) => sum + Number(r.quantity), 0) || 0;
          } else {
            const { data: existingReturns } = await supabase
              .from('sale_return_items')
              .select('quantity')
              .eq('product_id', returnItem.product_id)
              .eq('variation_id', returnItem.variation_id || null)
              .is('sale_item_id', null)
              .in('sale_return_id', finalReturnIdsOrSentinel);
            alreadyReturned = existingReturns?.reduce((sum: number, r: any) => sum + Number(r.quantity), 0) || 0;
          }
          const totalReturned = alreadyReturned + Number(returnItem.quantity);
          if (totalReturned > Number(originalItem.quantity)) {
            throw new Error(
              `Return quantity (${totalReturned}) exceeds original quantity (${originalItem.quantity}) for ${returnItem.product_name}`
            );
          }
        }
      }
    }

    const { data: claimedFinal, error: claimErr } = await supabase
      .from('sale_returns')
      .update({ status: 'final', updated_at: new Date().toISOString() })
      .eq('id', returnId)
      .eq('company_id', companyId)
      .eq('status', 'draft')
      .select('id')
      .maybeSingle();

    if (claimErr) throw claimErr;
    if (!claimedFinal) {
      const { data: cur } = await supabase.from('sale_returns').select('status').eq('id', returnId).eq('company_id', companyId).maybeSingle();
      if (String((cur as { status?: string } | null)?.status || '').toLowerCase() === 'final') return;
      throw new Error('Sale return could not be finalized (concurrent update or invalid status).');
    }

    const rollbackToDraft = async () => {
      await supabase
        .from('sale_returns')
        .update({ status: 'draft', updated_at: new Date().toISOString() })
        .eq('id', returnId)
        .eq('company_id', companyId)
        .eq('status', 'final');
    };

    try {
    const origList = (originalItems || []) as OriginalSaleLineRow[];

    // Accumulate canonical cost across all return lines for the inventory/COGS reversal JE.
    // Computed here (pre-patch loop) to reflect the true cost basis before any DB write.
    let totalInventoryCostForJE = 0;
    for (const item of saleReturn.items as any[]) {
      const origForCost = isStandalone ? undefined : matchOriginalSaleLineForReturnItem(item, origList);
      const econForCost = canonicalSaleReturnStockEconomics(item, origForCost);
      totalInventoryCostForJE = roundMoney2(totalInventoryCostForJE + econForCost.totalCost);
    }

    // Align sale_return_items $ with canonical economics (partial return safety) before stock + GL context
    for (const item of saleReturn.items as any[]) {
      const orig = isStandalone ? undefined : matchOriginalSaleLineForReturnItem(item, origList);
      const econ = canonicalSaleReturnStockEconomics(item, orig);
      const rowId = item.id as string | undefined;
      if (
        rowId &&
        (roundMoney2(Number(item.total) || 0) !== econ.totalCost ||
          roundMoney2(Number(item.unit_price) || 0) !== econ.unitCost)
      ) {
        const { error: patchErr } = await supabase
          .from('sale_return_items')
          .update({
            unit_price: econ.unitCost,
            total: econ.totalCost,
          })
          .eq('id', rowId)
          .eq('sale_return_id', returnId);
        if (patchErr) {
          console.warn('[finalizeSaleReturn] Could not patch sale_return_items economics:', rowId, patchErr.message);
        }
      }
    }

    // Create stock movements (POSITIVE - stock IN) — use canonical $ only
    for (const item of saleReturn.items) {
      let boxChange = 0;
      let pieceChange = 0;

      if (!isStandalone && originalItems?.length) {
        const originalItem = originalItems.find(
          (oi: any) => oi.product_id === item.product_id &&
          (oi.variation_id === item.variation_id || (!oi.variation_id && !item.variation_id))
        );
        if (originalItem && item.packing_details) {
          const originalPacking = item.packing_details;
          const originalQty = Number(originalItem.quantity);
          const returnQty = Number(item.quantity);
          if (originalQty > 0) {
            const returnRatio = returnQty / originalQty;
            const originalBoxes = originalPacking.total_boxes || 0;
            const originalPieces = originalPacking.total_pieces || 0;
            boxChange = Math.round(originalBoxes * returnRatio);
            pieceChange = Math.round(originalPieces * returnRatio);
          }
        }
      }
      if (boxChange === 0 && pieceChange === 0) {
        // Standalone or no original packing: use return item's packing/return_packing
        const packing = item.return_packing_details || item.packing_details;
        if (packing) {
          boxChange = Math.round(Number(packing.total_boxes || 0));
          pieceChange = Math.round(Number(packing.total_pieces || 0));
        }
      }

      const notesStandalone = `Sale Return ${saleReturn.return_no || returnId} (no invoice): ${item.product_name}${item.variation_id ? ' (Variation)' : ''}`;
      const notesLinked = `Sale Return ${saleReturn.return_no || returnId}: Original ${originalSale?.invoice_no || 'N/A'} - ${item.product_name}${item.variation_id ? ' (Variation)' : ''}`;

      if (await saleReturnHasStockLine(companyId, returnId, 'sale_return', item.product_id, item.variation_id)) {
        continue;
      }

      const orig = isStandalone ? undefined : matchOriginalSaleLineForReturnItem(item, origList);
      const econ = canonicalSaleReturnStockEconomics(item, orig);

      await productService.createStockMovement({
        company_id: companyId,
        branch_id: branchId === 'all' ? undefined : branchId,
        product_id: item.product_id,
        variation_id: item.variation_id || undefined,
        movement_type: 'sale_return',
        quantity: econ.qty,
        unit_cost: econ.unitCost,
        total_cost: econ.totalCost,
        reference_type: 'sale_return',
        reference_id: returnId,
        notes: isStandalone ? notesStandalone : notesLinked,
        created_by: userId,
        box_change: boxChange !== 0 ? boxChange : undefined,
        piece_change: pieceChange !== 0 ? pieceChange : undefined,
      });
    }

    const { data: lineTotals } = await supabase.from('sale_return_items').select('total').eq('sale_return_id', returnId);
    const lineSum = roundMoney2((lineTotals || []).reduce((s, r) => s + Number((r as { total?: number }).total || 0), 0));
    const disc = Number(saleReturn.discount_amount) || 0;
    const tax = Number(saleReturn.tax_amount) || 0;
    await supabase
      .from('sale_returns')
      .update({
        subtotal: lineSum,
        total: Math.max(0, roundMoney2(lineSum - disc + tax)),
        updated_at: new Date().toISOString(),
      })
      .eq('id', returnId)
      .eq('company_id', companyId);

    if (saleReturn.original_sale_id) {
      await supabase.rpc('recalc_sale_payment_totals', { p_sale_id: saleReturn.original_sale_id });
    }

    // Post inventory/COGS reversal JE: Dr Inventory (1200) / Cr COGS (5000).
    // This is the second half of the complete sale-return double-entry.
    // The first half (Dr Sales Revenue / Cr AR or Cash/Bank) is handled separately
    // by accounting.recordSaleReturn() called from the UI after finalize.
    // Both JEs share reference_type='sale_return' / reference_id=returnId so
    // voidSaleReturn() auto-reverses them together.
    if (totalInventoryCostForJE > 0) {
      try {
        const returnBranchId = branchId === 'all' ? null : (branchId || null);
        await saleAccountingService.createSaleReturnInventoryReversalJE({
          returnId,
          companyId,
          branchId: returnBranchId,
          totalCostAmount: totalInventoryCostForJE,
          returnNo: (saleReturn as { return_no?: string }).return_no || returnId,
          performedBy: userId || null,
        });
      } catch (jeErr: any) {
        // Non-blocking: stock movements are the authoritative record; JE failure is surfaced as a warning.
        console.warn('[finalizeSaleReturn] Inventory reversal JE failed (non-blocking):', jeErr?.message || jeErr);
      }
    }

    if (typeof window !== 'undefined') {
      const cid = saleReturn.customer_id;
      if (companyId && cid) {
        window.dispatchEvent(new CustomEvent('ledgerUpdated', { detail: { ledgerType: 'customer', entityId: cid } }));
      }
    }
    } catch (e) {
      await rollbackToDraft();
      throw e;
    }
  },

  /**
   * Void a finalized sale return (standard method when saved by mistake).
   * Idempotent: if already void, returns `{ alreadyVoided: true }` with **no** stock or GL mutations.
   * Exclusive claim: only one concurrent caller can transition `final` → `void`; losers get no-op.
   * Posts `correction_reversal` JEs for active `sale_return` settlement rows (audit trail), then stock void lines (deduped).
   */
  async voidSaleReturn(
    returnId: string,
    companyId: string,
    branchId?: string,
    userId?: string
  ): Promise<{ alreadyVoided: boolean }> {
    const { data: saleReturn, error: returnError } = await supabase
      .from('sale_returns')
      .select(`
        *,
        items:sale_return_items(*)
      `)
      .eq('id', returnId)
      .eq('company_id', companyId)
      .single();

    if (returnError) throw returnError;
    if (!saleReturn) throw new Error('Sale return not found');

    const st0 = String(saleReturn.status || '').toLowerCase();
    if (st0 === 'void') {
      return { alreadyVoided: true };
    }
    if (st0 !== 'final') {
      throw new Error('Only finalized sale returns can be voided. Draft returns can be deleted.');
    }

    let originalSale: { invoice_no?: string } | null = null;
    let originalItems: any[] = [];
    if (saleReturn.original_sale_id) {
      const { data: sale } = await supabase
        .from('sales')
        .select('invoice_no')
        .eq('id', saleReturn.original_sale_id)
        .single();
      originalSale = sale || null;

      const { data: salesItemsData } = await supabase
        .from('sales_items')
        .select('id, product_id, variation_id, quantity, total, unit_price')
        .eq('sale_id', saleReturn.original_sale_id);
      if (salesItemsData?.length) {
        originalItems = salesItemsData;
      }
    }

    const origListVoid = (originalItems || []) as OriginalSaleLineRow[];

    const branchIdToUse = branchId === 'all' ? undefined : branchId;
    const branchForJe = branchIdToUse ?? (saleReturn.branch_id && saleReturn.branch_id !== 'all' ? saleReturn.branch_id : null);

    const { data: claimedVoid, error: claimVoidErr } = await supabase
      .from('sale_returns')
      .update({ status: 'void', updated_at: new Date().toISOString() })
      .eq('id', returnId)
      .eq('company_id', companyId)
      .eq('status', 'final')
      .select('id, customer_id, original_sale_id')
      .maybeSingle();

    if (claimVoidErr) throw claimVoidErr;
    if (!claimedVoid) {
      const { data: cur } = await supabase.from('sale_returns').select('status').eq('id', returnId).eq('company_id', companyId).maybeSingle();
      if (String((cur as { status?: string } | null)?.status || '').toLowerCase() === 'void') {
        return { alreadyVoided: true };
      }
      throw new Error('Return could not be voided (concurrent update). Try again.');
    }

    const rollbackToFinal = async () => {
      await supabase
        .from('sale_returns')
        .update({ status: 'final', updated_at: new Date().toISOString() })
        .eq('id', returnId)
        .eq('company_id', companyId)
        .eq('status', 'void');
    };

    try {
      const { data: docJes, error: jeListErr } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('company_id', companyId)
        .eq('reference_type', 'sale_return')
        .eq('reference_id', returnId)
        .or('is_void.is.null,is_void.eq.false');

      if (jeListErr) {
        console.warn('[voidSaleReturn] journal list:', jeListErr.message);
      } else {
        const reason = `Void sale return ${(saleReturn as { return_no?: string }).return_no || returnId}`;
        for (const row of docJes || []) {
          const jeId = (row as { id: string }).id;
          try {
            await accountingService.createReversalEntry(companyId, branchForJe, jeId, userId || null, reason, {
              bypassJournalSourceControlPolicy: true,
            });
          } catch (revErr: any) {
            console.warn('[voidSaleReturn] reversal JE skipped/failed for', jeId, revErr?.message || revErr);
          }
        }
      }

      for (const item of saleReturn.items) {
        let boxChange = 0;
        let pieceChange = 0;
        const originalItem = originalItems?.find(
          (oi: any) =>
            oi.product_id === item.product_id &&
            (oi.variation_id === item.variation_id || (!oi.variation_id && !item.variation_id))
        );
        if (originalItem && item.packing_details) {
          const originalPacking = item.packing_details;
          const originalQty = Number(originalItem.quantity);
          const returnQty = Number(item.quantity);
          if (originalQty > 0) {
            const returnRatio = returnQty / originalQty;
            const originalBoxes = originalPacking.total_boxes || 0;
            const originalPieces = originalPacking.total_pieces || 0;
            boxChange = -Math.round(originalBoxes * returnRatio);
            pieceChange = -Math.round(originalPieces * returnRatio);
          }
        } else if (item.packing_details) {
          const packing = item.packing_details;
          boxChange = -Math.round(Number(packing.total_boxes || 0));
          pieceChange = -Math.round(Number(packing.total_pieces || 0));
        }

        if (await saleReturnHasStockLine(companyId, returnId, 'sale_return_void', item.product_id, item.variation_id)) {
          continue;
        }

        const origV = saleReturn.original_sale_id ? matchOriginalSaleLineForReturnItem(item, origListVoid) : undefined;
        const econV = canonicalSaleReturnStockEconomics(item, origV);

        try {
          await productService.createStockMovement({
            company_id: companyId,
            branch_id: branchIdToUse,
            product_id: item.product_id,
            variation_id: item.variation_id || undefined,
            movement_type: 'sale_return_void',
            quantity: -econV.qty,
            unit_cost: econV.unitCost,
            total_cost: econV.totalCost,
            reference_type: 'sale_return',
            reference_id: returnId,
            notes: `Void Sale Return ${saleReturn.return_no || returnId}: ${item.product_name}`,
            created_by: userId,
            box_change: boxChange !== 0 ? boxChange : undefined,
            piece_change: pieceChange !== 0 ? pieceChange : undefined,
          });
        } catch (movErr: any) {
          const code = movErr?.code ?? movErr?.error?.code;
          const msg = String(movErr?.message || movErr || '');
          const dup =
            code === '23505' ||
            msg.toLowerCase().includes('duplicate') ||
            msg.toLowerCase().includes('unique');
          if (dup && (await saleReturnHasStockLine(companyId, returnId, 'sale_return_void', item.product_id, item.variation_id))) {
            console.warn('[voidSaleReturn] duplicate sale_return_void row skipped (race or unique index):', returnId, item.product_id);
            continue;
          }
          throw movErr;
        }
      }

      if (saleReturn.original_sale_id) {
        await supabase.rpc('recalc_sale_payment_totals', { p_sale_id: saleReturn.original_sale_id });
      }

      if (typeof window !== 'undefined') {
        const cid = saleReturn.customer_id;
        if (companyId && cid) {
          window.dispatchEvent(new CustomEvent('ledgerUpdated', { detail: { ledgerType: 'customer', entityId: cid } }));
        }
      }
      return { alreadyVoided: false };
    } catch (e) {
      await rollbackToFinal();
      throw e;
    }
  },

  /**
   * Undo **void** for a sale return (advanced / ops): removes `sale_return_void` stock rows, soft-voids active
   * `correction_reversal` JEs that point at this return’s document JEs, sets status back to `final`.
   * Original `sale_return` stock and original `sale_return` journal rows are left as-is (they were never removed on void).
   * Idempotent: if status is already `final`, returns `{ alreadyFinal: true }`.
   *
   * Note: RLS may block `stock_movements` delete for some roles — use `scripts/admin/restore-last-voided-sale-return.ts` with service role if the app call fails.
   */
  async restoreVoidedSaleReturnToFinal(
    returnId: string,
    companyId: string
  ): Promise<{ alreadyFinal: boolean; voidedReversalJeCount: number; deletedVoidStockRows: number }> {
    const { data: row, error } = await supabase
      .from('sale_returns')
      .select('id, status, original_sale_id, customer_id')
      .eq('id', returnId)
      .eq('company_id', companyId)
      .maybeSingle();
    if (error) throw error;
    if (!row) throw new Error('Sale return not found');
    const st = String((row as { status?: string }).status || '').toLowerCase();
    if (st === 'final') {
      return { alreadyFinal: true, voidedReversalJeCount: 0, deletedVoidStockRows: 0 };
    }
    if (st !== 'void') {
      throw new Error(
        'Only voided sale returns can be restored to final. For draft returns, use delete or edit from Sales.'
      );
    }

    const refId = String(returnId);

    const { data: docJes } = await supabase
      .from('journal_entries')
      .select('id')
      .eq('company_id', companyId)
      .eq('reference_type', 'sale_return')
      .eq('reference_id', refId)
      .or('is_void.is.null,is_void.eq.false');

    const originalJeIds = (docJes || []).map((r) => (r as { id: string }).id);
    let reversalVoided = 0;
    for (const origId of originalJeIds) {
      const { data: revs } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('company_id', companyId)
        .eq('reference_type', 'correction_reversal')
        .eq('reference_id', origId)
        .or('is_void.is.null,is_void.eq.false');
      for (const rev of revs || []) {
        const { error: uErr } = await supabase
          .from('journal_entries')
          .update({ is_void: true })
          .eq('id', (rev as { id: string }).id)
          .eq('company_id', companyId);
        if (!uErr) reversalVoided += 1;
      }
    }

    const { data: deletedRows, error: delErr } = await supabase
      .from('stock_movements')
      .delete()
      .eq('company_id', companyId)
      .eq('reference_type', 'sale_return')
      .eq('reference_id', refId)
      .eq('movement_type', 'sale_return_void')
      .select('id');
    if (delErr) throw delErr;
    const deletedCount = Array.isArray(deletedRows) ? deletedRows.length : 0;

    const { data: claimed, error: claimErr } = await supabase
      .from('sale_returns')
      .update({ status: 'final', updated_at: new Date().toISOString() })
      .eq('id', returnId)
      .eq('company_id', companyId)
      .eq('status', 'void')
      .select('id')
      .maybeSingle();
    if (claimErr) throw claimErr;
    if (!claimed) {
      throw new Error('Could not restore return to final (concurrent update?).');
    }

    const origSale = (row as { original_sale_id?: string | null }).original_sale_id;
    if (origSale) {
      await supabase.rpc('recalc_sale_payment_totals', { p_sale_id: origSale });
    }

    if (typeof window !== 'undefined') {
      const cid = (row as { customer_id?: string | null }).customer_id;
      if (companyId && cid) {
        window.dispatchEvent(new CustomEvent('ledgerUpdated', { detail: { ledgerType: 'customer', entityId: cid } }));
      }
    }

    return { alreadyFinal: false, voidedReversalJeCount: reversalVoided, deletedVoidStockRows: deletedCount };
  },

  /** Most recently updated void return for company (optional branch), restored to `final`. */
  async restoreLatestVoidedSaleReturnToFinal(companyId: string, branchId?: string): Promise<string> {
    let q = supabase
      .from('sale_returns')
      .select('id')
      .eq('company_id', companyId)
      .eq('status', 'void')
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(1);
    if (branchId && branchId !== 'all') {
      q = q.eq('branch_id', branchId);
    }
    const { data, error } = await q.maybeSingle();
    if (error) throw error;
    if (!data?.id) {
      throw new Error('No voided sale return found for this company/branch.');
    }
    await this.restoreVoidedSaleReturnToFinal(data.id as string, companyId);
    return data.id as string;
  },

  /**
   * Get sale return by ID
   */
  async getSaleReturnById(returnId: string, companyId: string): Promise<SaleReturn & { items: SaleReturnItem[] }> {
    const { data, error } = await supabase
      .from('sale_returns')
      .select(`
        *,
        items:sale_return_items(*)
      `)
      .eq('id', returnId)
      .eq('company_id', companyId)
      .single();

    if (error) throw error;
    return data as SaleReturn & { items: SaleReturnItem[] };
  },

  /**
   * Get all sale returns for a company
   */
  async getSaleReturns(companyId: string, branchId?: string): Promise<(SaleReturn & { items: SaleReturnItem[] })[]> {
    let query = supabase
      .from('sale_returns')
      .select(`
        *,
        items:sale_return_items(*)
      `)
      .eq('company_id', companyId)
      .order('return_date', { ascending: false });

    if (branchId && branchId !== 'all') {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as (SaleReturn & { items: SaleReturnItem[] })[];
  },

  /**
   * Get original sale items for return form
   */
  async getOriginalSaleItems(saleId: string, companyId: string): Promise<Array<{
    id: string;
    product_id: string;
    variation_id?: string;
    product_name: string;
    sku: string;
    quantity: number;
    unit?: string;
    unit_price: number;
    total: number;
    already_returned?: number;
    size?: string;
    color?: string;
    // Packing fields - preserved from original sale item
    packing_type?: string;
    packing_quantity?: number;
    packing_unit?: string;
    packing_details?: any; // JSONB
    variation?: {
      id?: string;
      size?: string;
      color?: string;
      attributes?: Record<string, unknown>;
      sku?: string;
    };
  }>> {
    // Get original sale items with variation data and packing
    // Try sales_items first (new table), fallback to sale_items (old table)
    let saleItems: any[] = [];
    let itemsError: any = null;
    let itemsFromSalesItems = false; // Track which table items came from
    
    const { data: salesItemsData, error: salesItemsError } = await supabase
      .from('sales_items')
      .select(`
        *,
        variation:product_variations(id, product_id, sku, attributes)
      `)
      .eq('sale_id', saleId)
      .order('created_at');

    if (salesItemsError) {
      // If sales_items fails, try sale_items (backward compatibility)
      if (salesItemsError.code === '42P01' || salesItemsError.message?.includes('does not exist')) {
        const { data: saleItemsData, error: saleItemsError } = await supabase
          .from('sale_items')
          .select(`
            *,
            variation:product_variations(id, product_id, sku, attributes)
          `)
          .eq('sale_id', saleId)
          .order('created_at');
        
        if (saleItemsError) {
          itemsError = saleItemsError;
        } else {
          saleItems = saleItemsData || [];
          itemsFromSalesItems = false; // Items from sale_items table
        }
      } else {
        itemsError = salesItemsError;
      }
    } else {
      saleItems = salesItemsData || [];
      itemsFromSalesItems = true; // Items from sales_items table
    }

    if (itemsError) {
      console.error('[SALE RETURN] Error loading sale items:', itemsError);
      throw itemsError;
    }
    
    if (!saleItems || saleItems.length === 0) {
      console.warn('[SALE RETURN] No items found for sale:', saleId);
      return [];
    }

    // Get already returned quantities
    const { data: returns } = await supabase
      .from('sale_returns')
      .select(`
        id,
        items:sale_return_items(sale_item_id, quantity)
      `)
      .eq('original_sale_id', saleId)
      .eq('company_id', companyId)
      .eq('status', 'final');

    const returnedMap: Record<string, number> = {};
    if (returns) {
      returns.forEach(ret => {
        ret.items.forEach((item: any) => {
          if (item.sale_item_id) {
            returnedMap[item.sale_item_id] = (returnedMap[item.sale_item_id] || 0) + Number(item.quantity);
          }
        });
      });
    }

    return saleItems.map(item => {
      // Handle SKU - might be in item, variation, or product
      const sku = item.sku || item.variation?.sku || item.product?.sku || 'N/A';
      
      // CRITICAL: sale_item_id FK points to sale_items table only
      // If items are from sales_items table, we must set sale_item_id to null
      // to avoid foreign key constraint violation
      const saleItemId = itemsFromSalesItems ? null : item.id;
      
      return {
        id: item.id,
        product_id: item.product_id,
        variation_id: item.variation_id || undefined,
        product_name: item.product_name,
        sku: sku,
        quantity: Number(item.quantity),
        unit: item.unit || 'piece',
        unit_price: Number(item.unit_price || item.price || 0),
        total: Number(item.total || 0),
        already_returned: returnedMap[item.id] || 0,
        size: item.size || item.variation?.size || undefined,
        color: item.color || item.variation?.color || undefined,
        // Packing fields - preserved from original sale item
        packing_type: item.packing_type || undefined,
        packing_quantity: item.packing_quantity ? Number(item.packing_quantity) : undefined,
        packing_unit: item.packing_unit || undefined,
        packing_details: item.packing_details || undefined,
        variation: item.variation ? {
          id: item.variation.id,
          size: item.variation.size,
          color: item.variation.color,
          attributes: item.variation.attributes,
          sku: item.variation.sku,
        } : undefined,
        // Store which table this came from for later use
        _fromSalesItems: itemsFromSalesItems,
        // Store the actual ID for reference (even if we can't use it as FK)
        _originalId: item.id,
      };
    });
  },

  /**
   * Generate return number
   */
  async generateReturnNumber(companyId: string, branchId?: string): Promise<string> {
    // Try to get from document_sequences
    const { data: sequence } = await supabase
      .from('document_sequences')
      .select('id, current_number, prefix, padding')
      .eq('company_id', companyId)
      .eq('document_type', 'sale_return')
      .eq('branch_id', branchId || null)
      .maybeSingle();

    if (sequence) {
      const nextNumber = (sequence.current_number || 0) + 1;
      const padded = String(nextNumber).padStart(sequence.padding || 4, '0');
      const returnNo = `${sequence.prefix}${padded}`;

      // Update sequence
      await supabase
        .from('document_sequences')
        .update({ current_number: nextNumber })
        .eq('id', sequence.id);

      return returnNo;
    }

    // Fallback: Generate based on date
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `RET-${year}${month}${day}-${Date.now().toString().slice(-4)}`;
  },

  /**
   * Delete a draft sale return only. Final returns are locked and cannot be deleted.
   */
  async deleteSaleReturn(returnId: string, companyId: string): Promise<void> {
    const { data: existing } = await supabase
      .from('sale_returns')
      .select('status')
      .eq('id', returnId)
      .eq('company_id', companyId)
      .single();
    if (existing?.status === 'final') {
      throw new Error('Cannot delete a finalized sale return. It is locked.');
    }
    if (String(existing?.status || '').toLowerCase() === 'void') {
      throw new Error('Cannot delete a voided sale return. It is locked for audit.');
    }
    const { error } = await supabase
      .from('sale_returns')
      .delete()
      .eq('id', returnId)
      .eq('company_id', companyId)
      .eq('status', 'draft');

    if (error) throw error;
  },
};
