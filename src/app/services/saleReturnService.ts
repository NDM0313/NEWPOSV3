import { supabase } from '@/lib/supabase';
import { productService } from './productService';
import { getOrCreateLedger, addLedgerEntry } from './ledgerService';

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
    if (saleReturn.status === 'final') throw new Error('Sale return already finalized');

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
        .select('id, product_id, variation_id, quantity')
        .eq('sale_id', saleReturn.original_sale_id);

      if (salesItemsError) {
        if (salesItemsError.code === '42P01' || salesItemsError.message?.includes('does not exist')) {
          const { data: saleItemsData, error: saleItemsError } = await supabase
            .from('sale_items')
            .select('id, product_id, variation_id, quantity, packing_details')
            .eq('sale_id', saleReturn.original_sale_id);
          if (!saleItemsError && saleItemsData) originalItems = saleItemsData;
        } else {
          console.warn('[SALE RETURN] Error loading original items for validation:', salesItemsError);
        }
      } else if (salesItemsData) {
        originalItems = salesItemsData;
      }

      if (originalItems.length > 0) {
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
              .neq('sale_return_id', returnId);
            alreadyReturned = existingReturns?.reduce((sum: number, r: any) => sum + Number(r.quantity), 0) || 0;
          } else {
            const { data: existingReturns } = await supabase
              .from('sale_return_items')
              .select('quantity')
              .eq('product_id', returnItem.product_id)
              .eq('variation_id', returnItem.variation_id || null)
              .is('sale_item_id', null)
              .neq('sale_return_id', returnId);
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

    // Create stock movements (POSITIVE - stock IN)
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

      await productService.createStockMovement({
        company_id: companyId,
        branch_id: branchId === 'all' ? undefined : branchId,
        product_id: item.product_id,
        variation_id: item.variation_id || undefined,
        movement_type: 'sale_return',
        quantity: Number(item.quantity),
        unit_cost: Number(item.unit_price),
        total_cost: Number(item.total),
        reference_type: 'sale_return',
        reference_id: returnId,
        notes: isStandalone ? notesStandalone : notesLinked,
        created_by: userId,
        box_change: boxChange !== 0 ? boxChange : undefined,
        piece_change: pieceChange !== 0 ? pieceChange : undefined,
      });
    }

    // Customer Ledger: Sale Return already appears in customerLedgerAPI.getTransactions()
    // The customerLedgerAPI automatically includes sale_returns in the transaction list
    // No separate ledger entry needed - customer balance is calculated from sales, payments, and returns
    console.log('[SALE RETURN] ✅ Customer ledger will show this return via customerLedgerAPI');

    // Update sale return status to final
    const { error: updateError } = await supabase
      .from('sale_returns')
      .update({ status: 'final', updated_at: new Date().toISOString() })
      .eq('id', returnId);

    if (updateError) throw updateError;
  },

  /**
   * Void a finalized sale return (standard method when saved by mistake).
   * Reverses stock (takes back the returned qty from inventory) and marks return as void.
   * Void returns are excluded from customer ledger (only status = 'final' counts).
   * Record is kept for audit trail.
   */
  async voidSaleReturn(returnId: string, companyId: string, branchId?: string, userId?: string): Promise<void> {
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
    if (saleReturn.status !== 'final') {
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
        .select('id, product_id, variation_id, quantity')
        .eq('sale_id', saleReturn.original_sale_id);
      if (salesItemsData?.length) {
        originalItems = salesItemsData;
      } else {
        const { data: saleItemsData } = await supabase
          .from('sale_items')
          .select('id, product_id, variation_id, quantity')
          .eq('sale_id', saleReturn.original_sale_id);
        if (saleItemsData) originalItems = saleItemsData;
      }
    }

    const branchIdToUse = branchId === 'all' ? undefined : branchId;

    for (const item of saleReturn.items) {
      let boxChange = 0;
      let pieceChange = 0;
      const originalItem = originalItems?.find(
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
          boxChange = -Math.round(originalBoxes * returnRatio);
          pieceChange = -Math.round(originalPieces * returnRatio);
        }
      } else if (item.packing_details) {
        const packing = item.packing_details;
        boxChange = -Math.round(Number(packing.total_boxes || 0));
        pieceChange = -Math.round(Number(packing.total_pieces || 0));
      }

      await productService.createStockMovement({
        company_id: companyId,
        branch_id: branchIdToUse,
        product_id: item.product_id,
        variation_id: item.variation_id || undefined,
        movement_type: 'sale_return_void',
        quantity: -Number(item.quantity),
        unit_cost: Number(item.unit_price),
        total_cost: Number(item.total),
        reference_type: 'sale_return',
        reference_id: returnId,
        notes: `Void Sale Return ${saleReturn.return_no || returnId}: ${item.product_name}`,
        created_by: userId,
        box_change: boxChange !== 0 ? boxChange : undefined,
        piece_change: pieceChange !== 0 ? pieceChange : undefined,
      });
    }

    const { error: updateError } = await supabase
      .from('sale_returns')
      .update({ status: 'void', updated_at: new Date().toISOString() })
      .eq('id', returnId)
      .eq('company_id', companyId)
      .eq('status', 'final');

    if (updateError) throw updateError;
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
        variation:product_variations(*)
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
            variation:product_variations(*)
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
      .select('current_number, prefix, padding')
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
    const { error } = await supabase
      .from('sale_returns')
      .delete()
      .eq('id', returnId)
      .eq('company_id', companyId)
      .eq('status', 'draft');

    if (error) throw error;
  },
};
