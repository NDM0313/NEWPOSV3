import { supabase } from '@/lib/supabase';
import { productService } from './productService';

export interface SaleReturn {
  id?: string;
  company_id: string;
  branch_id: string;
  original_sale_id: string;
  return_no?: string;
  return_date: string;
  customer_id?: string;
  customer_name: string;
  status: 'draft' | 'final';
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
}

export interface CreateSaleReturnData {
  company_id: string;
  branch_id: string;
  original_sale_id: string;
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
  }>;
  reason?: string;
  notes?: string;
  created_by?: string;
}

export const saleReturnService = {
  /**
   * Create a new sale return (draft or final)
   */
  async createSaleReturn(data: CreateSaleReturnData): Promise<SaleReturn> {
    const { company_id, branch_id, original_sale_id, return_date, customer_id, customer_name, items, reason, notes, created_by } = data;

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const discount_amount = 0; // Can be enhanced later
    const tax_amount = 0; // Can be enhanced later
    const total = subtotal - discount_amount + tax_amount;

    // Generate return number
    const return_no = await this.generateReturnNumber(company_id, branch_id);

    // Create sale return record
    const { data: saleReturn, error: returnError } = await supabase
      .from('sale_returns')
      .insert({
        company_id,
        branch_id,
        original_sale_id,
        return_no,
        return_date,
        customer_id: customer_id || null,
        customer_name,
        status: 'draft', // Always start as draft
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

    // Create return items
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
    }));

    const { error: itemsError } = await supabase
      .from('sale_return_items')
      .insert(returnItems);

    if (itemsError) throw itemsError;

    return saleReturn as SaleReturn;
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

    // Get original sale
    const { data: originalSale, error: saleError } = await supabase
      .from('sales')
      .select('invoice_no, status')
      .eq('id', saleReturn.original_sale_id)
      .single();

    if (saleError) throw saleError;
    if (!originalSale) throw new Error('Original sale not found');

    // Validate: Cannot return Draft/Quotation sales
    if (originalSale.status === 'draft' || originalSale.status === 'quotation') {
      throw new Error('Cannot return Draft or Quotation sales. Only Final sales can be returned.');
    }

    // Validate: Check if return quantity exceeds original quantity
    const { data: originalItems } = await supabase
      .from('sale_items')
      .select('id, product_id, variation_id, quantity')
      .eq('sale_id', saleReturn.original_sale_id);

    if (originalItems) {
      for (const returnItem of saleReturn.items) {
        const originalItem = originalItems.find(
          oi => oi.product_id === returnItem.product_id &&
          (oi.variation_id === returnItem.variation_id || (!oi.variation_id && !returnItem.variation_id))
        );

        if (!originalItem) {
          throw new Error(`Product ${returnItem.product_name} not found in original sale`);
        }

        // Check already returned quantity
        const { data: existingReturns } = await supabase
          .from('sale_return_items')
          .select('quantity')
          .eq('sale_item_id', originalItem.id)
          .eq('sale_return_id', returnId);

        const alreadyReturned = existingReturns?.reduce((sum, r) => sum + Number(r.quantity), 0) || 0;
        const totalReturned = alreadyReturned + Number(returnItem.quantity);

        if (totalReturned > Number(originalItem.quantity)) {
          throw new Error(
            `Return quantity (${totalReturned}) exceeds original quantity (${originalItem.quantity}) for ${returnItem.product_name}`
          );
        }
      }
    }

    // Create stock movements (POSITIVE - stock IN)
    for (const item of saleReturn.items) {
      await productService.createStockMovement({
        company_id: companyId,
        branch_id: branchId === 'all' ? undefined : branchId,
        product_id: item.product_id,
        variation_id: item.variation_id || undefined,
        movement_type: 'sale_return',
        quantity: Number(item.quantity), // POSITIVE for stock IN
        unit_cost: Number(item.unit_price),
        total_cost: Number(item.total),
        reference_type: 'sale_return',
        reference_id: returnId,
        notes: `Sale Return ${saleReturn.return_no || returnId}: Original ${originalSale.invoice_no} - ${item.product_name}${item.variation_id ? ' (Variation)' : ''}`,
        created_by: userId,
      });
    }

    // Update sale return status to final
    const { error: updateError } = await supabase
      .from('sale_returns')
      .update({ status: 'final', updated_at: new Date().toISOString() })
      .eq('id', returnId);

    if (updateError) throw updateError;

    // Create accounting reversal entries
    // Note: This requires AccountingContext - will be called from component if needed
    // For now, stock movements are created above
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
  }>> {
    // Get original sale items
    const { data: saleItems, error: itemsError } = await supabase
      .from('sale_items')
      .select('*')
      .eq('sale_id', saleId)
      .order('created_at');

    if (itemsError) throw itemsError;
    if (!saleItems) return [];

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

    return saleItems.map(item => ({
      id: item.id,
      product_id: item.product_id,
      variation_id: item.variation_id || undefined,
      product_name: item.product_name,
      sku: item.sku,
      quantity: Number(item.quantity),
      unit: item.unit,
      unit_price: Number(item.unit_price),
      total: Number(item.total),
      already_returned: returnedMap[item.id] || 0,
    }));
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
   * Delete a draft sale return
   */
  async deleteSaleReturn(returnId: string, companyId: string): Promise<void> {
    const { error } = await supabase
      .from('sale_returns')
      .delete()
      .eq('id', returnId)
      .eq('company_id', companyId)
      .eq('status', 'draft'); // Only allow deleting drafts

    if (error) throw error;
  },
};
