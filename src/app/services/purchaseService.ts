import { supabase } from '@/lib/supabase';

export interface Purchase {
  id?: string;
  company_id: string;
  branch_id: string;
  po_no?: string;
  po_date: string;
  supplier_id?: string;
  supplier_name: string;
  status: 'draft' | 'ordered' | 'received' | 'final'; // Database enum values only
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
  sku: string; // Required in DB
  quantity: number;
  unit?: string;
  unit_price: number;
  discount_percentage?: number;
  discount_amount?: number;
  tax_percentage?: number;
  tax_amount?: number;
  total: number;
  // Packing fields
  packing_type?: string;
  packing_quantity?: number;
  packing_unit?: string;
  packing_details?: any; // JSONB
  notes?: string;
}

export const purchaseService = {
  // Create purchase with items
  async createPurchase(purchase: Purchase, items: PurchaseItem[]) {
    const { data: purchaseData, error: purchaseError } = await supabase
      .from('purchases')
      .insert(purchase)
      .select('*')
      .single();

    if (purchaseError) {
      console.error('[PURCHASE SERVICE] Error creating purchase:', purchaseError);
      throw purchaseError;
    }

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
        branch:branches(id, name, code),
        created_by_user:users(id, full_name, email),
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
          branch:branches(id, name, code),
          created_by_user:users(id, full_name, email),
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
          branch:branches(id, name, code),
          created_by_user:users(id, full_name, email),
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
    
    // If error is about foreign key relationship or other issues, try without nested selects
    if (error && (error.code === '42703' || error.code === '42P01' || error.code === 'PGRST116')) {
      // Try simpler query without nested relationships
      let simpleQuery = supabase
        .from('purchases')
        .select(`
          *,
          created_by_user:users(id, full_name, email)
        `)
        .order('created_at', { ascending: false });
      
      if (branchId) {
        simpleQuery = simpleQuery.eq('branch_id', branchId);
      }
      
      const { data: simpleData, error: simpleError } = await simpleQuery;
      
      // If created_at doesn't exist, try without ordering
      if (simpleError && simpleError.code === '42703' && simpleError.message?.includes('created_at')) {
        let noOrderQuery = supabase
          .from('purchases')
          .select(`
            *,
            created_by_user:users(id, full_name, email)
          `);
        
        if (branchId) {
          noOrderQuery = noOrderQuery.eq('branch_id', branchId);
        }
        
        const { data: noOrderData, error: noOrderError } = await noOrderQuery;
        if (noOrderError) throw noOrderError;
        return noOrderData;
      }
      
      if (simpleError) throw simpleError;
      return simpleData;
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
        created_by_user:users(id, full_name, email),
        items:purchase_items(
          *,
          product:products(*),
          variation:product_variations(*)
        )
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

  // Record payment – allowed only when purchase status is final/completed (ERP rule)
  async recordPayment(purchaseId: string, amount: number, paymentMethod: string, accountId: string, companyId: string, branchId?: string | null) {
    // CRITICAL FIX: Get branch_id from purchase record, not from context (context can be "all")
    const { data: purchase, error: fetchError } = await supabase
      .from('purchases')
      .select('id, status, branch_id')
      .eq('id', purchaseId)
      .single();

    if (fetchError || !purchase) {
      throw new Error('Purchase not found');
    }
    
    // STEP 2 FIX: Allow payment for 'received' and 'final' status (like payment section in form)
    const status = (purchase as any).status;
    if (status !== 'final' && status !== 'completed' && status !== 'received') {
      throw new Error('Payment not allowed until purchase is Received or Final. Current status: ' + (status || 'unknown'));
    }

    // CRITICAL FIX: Use purchase's branch_id, not context branchId (which can be "all")
    const purchaseBranchId = (purchase as any).branch_id;
    
    // Validate branchId - must be UUID or null, not "all"
    const validBranchId = (purchaseBranchId && purchaseBranchId !== 'all') ? purchaseBranchId : 
                          (branchId && branchId !== 'all') ? branchId : null;

    // CRITICAL FIX: Normalize payment method to lowercase enum values
    // Enum expects: 'cash', 'bank', 'card', 'other' (lowercase)
    // PaymentMethod type uses: 'Cash', 'Bank', 'Mobile Wallet' (capitalized)
    const normalizedPaymentMethod = paymentMethod.toLowerCase().trim();
    const paymentMethodMap: Record<string, string> = {
      'cash': 'cash',
      'Cash': 'cash',
      'bank': 'bank',
      'Bank': 'bank',
      'card': 'card',
      'Card': 'card',
      'cheque': 'other',
      'Cheque': 'other',
      'mobile wallet': 'other',
      'Mobile Wallet': 'other',
      'mobile_wallet': 'other',
      'wallet': 'other',
      'Wallet': 'other',
    };
    // Try exact match first, then normalized match, then default to 'cash'
    const enumPaymentMethod = paymentMethodMap[paymentMethod] || paymentMethodMap[normalizedPaymentMethod] || 'cash';
    
    console.log('[PURCHASE SERVICE] Payment method normalization:', {
      original: paymentMethod,
      normalized: normalizedPaymentMethod,
      enumValue: enumPaymentMethod
    });

    const { data, error } = await supabase
      .from('payments')
      .insert({
        company_id: companyId,
        branch_id: validBranchId, // Use purchase's branch_id, not context branchId
        payment_type: 'paid',
        reference_type: 'purchase',
        reference_id: purchaseId,
        amount,
        payment_method: enumPaymentMethod, // CRITICAL: Use lowercase enum value
        payment_account_id: accountId,
        payment_date: new Date().toISOString().split('T')[0],
      })
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  // Update payment
  async updatePayment(
    paymentId: string,
    purchaseId: string,
    updates: {
      amount?: number;
      paymentMethod?: string;
      accountId?: string;
      paymentDate?: string;
      referenceNumber?: string;
      notes?: string;
    }
  ) {
    try {
      // Normalize payment method if provided
      let normalizedPaymentMethod = updates.paymentMethod;
      if (updates.paymentMethod) {
        const normalized = updates.paymentMethod.toLowerCase().trim();
        const paymentMethodMap: Record<string, string> = {
          'cash': 'cash',
          'Cash': 'cash',
          'bank': 'bank',
          'Bank': 'bank',
          'card': 'card',
          'Card': 'card',
          'cheque': 'other',
          'Cheque': 'other',
          'mobile wallet': 'other',
          'Mobile Wallet': 'other',
          'mobile_wallet': 'other',
          'wallet': 'other',
          'Wallet': 'other',
        };
        normalizedPaymentMethod = paymentMethodMap[updates.paymentMethod] || paymentMethodMap[normalized] || 'cash';
      }

      // Build update data
      const updateData: any = {};
      if (updates.amount !== undefined) updateData.amount = updates.amount;
      if (normalizedPaymentMethod) updateData.payment_method = normalizedPaymentMethod;
      if (updates.accountId) updateData.payment_account_id = updates.accountId;
      if (updates.paymentDate) updateData.payment_date = updates.paymentDate;
      if (updates.referenceNumber !== undefined) updateData.reference_number = updates.referenceNumber;
      if (updates.notes !== undefined) updateData.notes = updates.notes;

      const { data, error } = await supabase
        .from('payments')
        .update(updateData)
        .eq('id', paymentId)
        .select()
        .single();

      if (error) {
        console.error('[PURCHASE SERVICE] Error updating payment:', error);
        throw error;
      }

      // Triggers will handle:
      // 1. Journal entry update (if needed)
      // 2. Purchase totals recalculation
      console.log('[PURCHASE SERVICE] Payment updated successfully');
      return data;
    } catch (error: any) {
      console.error('[PURCHASE SERVICE] Error updating payment:', error);
      throw error;
    }
  },

  // Get purchase payments (STEP 2 FIX: Like Sale module)
  async getPurchasePayments(purchaseId: string) {
    const { data, error } = await supabase
      .from('payments')
      .select(`
        id,
        payment_date,
        reference_number,
        amount,
        payment_method,
        payment_account_id,
        notes,
        attachments,
        created_at,
        account:accounts(id, name)
      `)
      .eq('reference_type', 'purchase')
      .eq('reference_id', purchaseId)
      .order('payment_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[PURCHASE SERVICE] Error fetching payments:', error);
      throw error;
    }

    // Transform to Payment format
    return (data || []).map((p: any) => ({
      id: p.id,
      date: p.payment_date || p.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
      referenceNo: p.reference_number || '',
      amount: parseFloat(p.amount || 0),
      method: p.payment_method || 'cash',
      accountId: p.payment_account_id,
      accountName: p.account?.name || '',
      notes: p.notes || '',
      attachments: p.attachments || null,
      createdAt: p.created_at,
    }));
  },

  // Delete payment (similar to saleService.deletePayment)
  // Tries RPC delete_payment first; if 404 or missing, uses direct deletion.
  async deletePayment(paymentId: string, purchaseId: string) {
    const tryRpc = async () => {
      const { error } = await supabase.rpc('delete_payment', {
        p_payment_id: paymentId,
        p_reference_id: purchaseId
      });
      return error;
    };

    try {
      const rpcError = await tryRpc();
      if (!rpcError) return; // RPC success
      // RPC failed (e.g. 404 function not found) → use direct delete
      return await this.deletePaymentDirect(paymentId, purchaseId);
    } catch (err: any) {
      // RPC request can throw (e.g. 404) → use direct delete
      return await this.deletePaymentDirect(paymentId, purchaseId);
    }
  },

  // Direct delete fallback (if RPC not available)
  async deletePaymentDirect(paymentId: string, purchaseId: string) {
    try {
      // Fetch payment details before deletion
      const { data: paymentData, error: fetchError } = await supabase
        .from('payments')
        .select('*')
        .eq('id', paymentId)
        .single();

      if (fetchError || !paymentData) {
        throw new Error('Payment not found');
      }

      // Delete related journal entries first
      const { data: journalEntries } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('payment_id', paymentId);

      if (journalEntries && journalEntries.length > 0) {
        // Delete journal entry lines first
        for (const entry of journalEntries) {
          const { error: lineError } = await supabase
            .from('journal_entry_lines')
            .delete()
            .eq('journal_entry_id', entry.id);
          
          if (lineError) {
            console.error('[PURCHASE SERVICE] Error deleting journal entry lines:', lineError);
          }
        }

        // Then delete journal entries
        const { error: entryError } = await supabase
          .from('journal_entries')
          .delete()
          .eq('payment_id', paymentId);
        
        if (entryError) {
          console.error('[PURCHASE SERVICE] Error deleting journal entries:', entryError);
        }
      }

      // Finally delete the payment
      const { error: deleteError } = await supabase
        .from('payments')
        .delete()
        .eq('id', paymentId);

      if (deleteError) {
        throw deleteError;
      }
    } catch (error: any) {
      console.error('[PURCHASE SERVICE] Error in deletePaymentDirect:', error);
      throw error;
    }
  },
};
