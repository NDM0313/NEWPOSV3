import { supabase } from '@/lib/supabase';

export interface Purchase {
  id?: string;
  company_id: string;
  branch_id: string;
  po_no?: string;
  po_date: string;
  supplier_id?: string;
  supplier_name: string;
  status: 'draft' | 'ordered' | 'received' | 'completed' | 'cancelled';
  payment_status: 'paid' | 'partial' | 'unpaid';
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  shipping_cost: number;
  total: number;
  paid_amount: number;
  due_amount: number;
  notes?: string;
  created_by: string;
}

export interface PurchaseItem {
  product_id: string;
  variation_id?: string;
  product_name: string;
  quantity: number;
  received_qty: number;
  unit_price: number;
  discount: number;
  tax: number;
  total: number;
  // Packing fields
  packing_type?: string;
  packing_quantity?: number;
  packing_unit?: string;
  packing_details?: any; // JSONB
}

export const purchaseService = {
  // Create purchase with items
  async createPurchase(purchase: Purchase, items: PurchaseItem[]) {
    const { data: purchaseData, error: purchaseError } = await supabase
      .from('purchases')
      .insert(purchase)
      .select()
      .single();

    if (purchaseError) throw purchaseError;

    // Insert items
    const itemsWithPurchaseId = items.map(item => ({
      ...item,
      purchase_id: purchaseData.id,
    }));

    const { error: itemsError } = await supabase
      .from('purchase_items')
      .insert(itemsWithPurchaseId);

    if (itemsError) {
      // Rollback: Delete purchase
      await supabase.from('purchases').delete().eq('id', purchaseData.id);
      throw itemsError;
    }

    return purchaseData;
  },

  // Get all purchases
  async getAllPurchases(companyId: string, branchId?: string) {
    // Note: company_id and po_date columns may not exist in all databases
    let query = supabase
      .from('purchases')
      .select(`
        *,
        supplier:contacts(name, phone),
        items:purchase_items(
          *,
          product:products(name)
        )
      `)
      .order('po_date', { ascending: false });

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query;
    
    // If error is about po_date column not existing, retry with created_at
    if (error && error.code === '42703' && error.message?.includes('po_date')) {
      const retryQuery = supabase
        .from('purchases')
        .select(`
          *,
          supplier:contacts(name, phone),
          items:purchase_items(
            *,
            product:products(name)
          )
        `)
        .order('created_at', { ascending: false });
      
      if (branchId) {
        retryQuery.eq('branch_id', branchId);
      }
      
      const { data: retryData, error: retryError } = await retryQuery;
      if (retryError) {
        // If created_at also doesn't exist, try without ordering
        const finalQuery = supabase
          .from('purchases')
          .select(`
            *,
            supplier:contacts(name, phone),
            items:purchase_items(
              *,
              product:products(name)
            )
          `);
        
        if (branchId) {
          finalQuery.eq('branch_id', branchId);
        }
        
        const { data: finalData, error: finalError } = await finalQuery;
        if (finalError) throw finalError;
        return finalData;
      }
      return retryData;
    }
    
    if (error) throw error;
    return data;
  },

  // Get single purchase
  async getPurchase(id: string) {
    const { data, error } = await supabase
      .from('purchases')
      .select(`
        *,
        supplier:contacts(*),
        items:purchase_items(
          *,
          product:products(*),
          variation:product_variations(*)
        ),
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  // Update purchase
  async updatePurchase(id: string, updates: Partial<Purchase>) {
    const { data, error } = await supabase
      .from('purchases')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Delete purchase (soft delete by setting status to cancelled)
  async deletePurchase(id: string) {
    const { error } = await supabase
      .from('purchases')
      .update({ status: 'cancelled' })
      .eq('id', id);

    if (error) throw error;
  },

  // Record payment
  async recordPayment(purchaseId: string, amount: number, paymentMethod: string, accountId: string, companyId: string, branchId: string) {
    const { data, error } = await supabase
      .from('payments')
      .insert({
        company_id: companyId,
        branch_id: branchId,
        payment_type: 'paid',
        reference_type: 'purchase',
        reference_id: purchaseId,
        amount,
        payment_method: paymentMethod,
        payment_account_id: accountId,
        payment_date: new Date().toISOString().split('T')[0],
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};
