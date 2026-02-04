import { supabase } from '@/lib/supabase';

export interface Sale {
  id?: string;
  company_id: string;
  branch_id: string;
  invoice_no?: string;
  invoice_date: string;
  customer_id?: string;
  customer_name: string;
  contact_number?: string;
  type: 'invoice' | 'quotation';
  status: 'draft' | 'quotation' | 'order' | 'final';
  payment_status: 'paid' | 'partial' | 'unpaid';
  payment_method?: string;
  shipping_status?: 'pending' | 'processing' | 'delivered' | 'cancelled';
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  expenses: number; // Changed from shipping_charges to match DB
  total: number;
  paid_amount: number;
  due_amount: number;
  return_due?: number;
  notes?: string;
  created_by: string;
  is_studio?: boolean;
}

export interface SaleItem {
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

export const saleService = {
  // Create sale with items
  async createSale(sale: Sale, items: SaleItem[]) {
    // Start transaction
    const { data: saleData, error: saleError } = await supabase
      .from('sales')
      .insert(sale)
      .select()
      .single();

    if (saleError) throw saleError;

    // Insert items
    const itemsWithSaleId = items.map(item => ({
      ...item,
      sale_id: saleData.id,
    }));

    // CRITICAL FIX: Use sales_items table (created via migration)
    // Try sales_items first, fallback to sale_items for backward compatibility
    let itemsError: any = null;
    const { error: salesItemsError } = await supabase
      .from('sales_items')
      .insert(itemsWithSaleId);
    
    if (salesItemsError) {
      // If table doesn't exist, try old table name
      if (salesItemsError.code === '42P01' || salesItemsError.message?.includes('does not exist')) {
        const { error: fallbackError } = await supabase
          .from('sale_items')
          .insert(itemsWithSaleId);
        itemsError = fallbackError;
      } else {
        itemsError = salesItemsError;
      }
    }

    if (itemsError) {
      // ROLLBACK: Delete sale if items insert fails
      await supabase.from('sales').delete().eq('id', saleData.id);
      throw new Error(`Failed to create sale items: ${itemsError.message}. Sale rolled back.`);
    }

    // CRITICAL FIX: Fetch the complete sale with items to return
    // This ensures items are included in the response
    let completeSale = null;
    let fetchError = null;

    // Try sales_items first
    const { data: salesItemsData, error: fetchSalesItemsError } = await supabase
      .from('sales')
      .select(`
        *,
        customer:contacts(*),
        items:sales_items(
          *,
          product:products(*),
          variation:product_variations(*)
        )
      `)
      .eq('id', saleData.id)
      .single();

    if (fetchSalesItemsError) {
      // If sales_items fails, try sale_items (backward compatibility)
      if (fetchSalesItemsError.code === '42P01' || fetchSalesItemsError.message?.includes('does not exist')) {
        const { data: saleItemsData, error: fetchSaleItemsError } = await supabase
          .from('sales')
          .select(`
            *,
            customer:contacts(*),
            items:sale_items(
              *,
              product:products(*),
              variation:product_variations(*)
            )
          `)
          .eq('id', saleData.id)
          .single();
        
        if (!fetchSaleItemsError) {
          completeSale = saleItemsData;
        } else {
          fetchError = fetchSaleItemsError;
        }
      } else {
        fetchError = fetchSalesItemsError;
      }
    } else {
      completeSale = salesItemsData;
    }

    if (fetchError || !completeSale) {
      // If fetch fails, still return saleData (items will be fetched separately on refresh)
      console.warn('[SALE SERVICE] Failed to fetch sale with items:', fetchError);
      return saleData;
    }

    return completeSale;
  },

  // Get single sale by ID
  async getSaleById(saleId: string) {
    const { data, error } = await supabase
      .from('sales')
      .select(`
        *,
        customer:contacts(*),
        branch:branches(id, name, code),
        items:sales_items(
          *,
          product:products(*),
          variation:product_variations(*)
        )
      `)
      .eq('id', saleId)
      .single();

    if (error) throw error;
    return data;
  },

  // Get all sales
  async getAllSales(companyId: string, branchId?: string) {
    // Join with branches table to get branch name and code
    // CRITICAL FIX: Sort by created_at DESC to show newest first
    let query = supabase
      .from('sales')
      .select(`
        *,
        customer:contacts(*),
        branch:branches(id, name, code),
        items:sales_items(
          *,
          product:products(*),
          variation:product_variations(*)
        )
      `)
      .order('created_at', { ascending: false })
      .order('invoice_date', { ascending: false });
    
    if (branchId) {
      query = query.eq('branch_id', branchId);
    }
    
    const { data, error } = await query;
    
    // If error about sales_items, try sale_items (backward compatibility)
    if (error && (error.code === '42P01' || error.message?.includes('sales_items'))) {
      const retryQuery = supabase
        .from('sales')
        .select(`
          *,
          customer:contacts(*),
          branch:branches(id, name, code),
          items:sale_items(
            *,
            product:products(*),
            variation:product_variations(*)
          )
        `)
        .order('invoice_date', { ascending: false });
      
      if (branchId) {
        retryQuery.eq('branch_id', branchId);
      }
      
      const { data: retryData, error: retryError } = await retryQuery;
      if (retryError) throw retryError;
      return retryData;
    }
    
    if (error) throw error;
    return data;
  },

  /** Get next studio invoice number from DB (max existing STD-* + 1). Use when document_sequences has no studio row. */
  async getNextStudioInvoiceNumber(companyId: string): Promise<number> {
    const { data, error } = await supabase
      .from('sales')
      .select('invoice_no')
      .eq('company_id', companyId)
      .ilike('invoice_no', 'STD-%');
    if (error) return 1;
    const numbers = (data || [])
      .map((r: any) => {
        const match = (r.invoice_no || '').match(/^STD-0*(\d+)$/i);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((n: number) => !isNaN(n));
    const max = numbers.length > 0 ? Math.max(...numbers) : 0;
    return max + 1;
  },

  // Get sales for Studio Sales list by invoice_no prefix 'STD-%' so STD-0002 etc. show (avoids 400 when is_studio column missing).
  async getStudioSales(companyId: string, branchId?: string) {
    let q = supabase
      .from('sales')
      .select(`*, customer:contacts(name, phone), items:sales_items(*)`)
      .eq('company_id', companyId)
      .ilike('invoice_no', 'STD-%')
      .order('invoice_date', { ascending: false });
    if (branchId && branchId !== 'all') q = q.eq('branch_id', branchId);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },
  
  // Legacy getAllSales (keeping for backward compatibility)
  async getAllSales_OLD(companyId: string, branchId?: string) {
    // Note: company_id and invoice_date columns may not exist in all databases
    let query = supabase
      .from('sales')
      .select(`
        *,
        customer:contacts(name, phone),
        items:sales_items(
          *,
          product:products(name, sku)
        )
      `)
      .order('invoice_date', { ascending: false });

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query;
    
    // If error is about invoice_date column not existing, retry with created_at
    if (error && error.code === '42703' && error.message?.includes('invoice_date')) {
      const retryQuery = supabase
        .from('sales')
        .select(`
          *,
          customer:contacts(name, phone),
          branch:branches(id, name, code),
          items:sales_items(
            *,
            product:products(name, sku)
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
          .from('sales')
          .select(`
            *,
            customer:contacts(name, phone),
            branch:branches(id, name, code),
            items:sales_items(
              *,
              product:products(name, sku)
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
        .from('sales')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (branchId) {
        simpleQuery = simpleQuery.eq('branch_id', branchId);
      }
      
      const { data: simpleData, error: simpleError } = await simpleQuery;
      
      // If created_at doesn't exist, try without ordering
      if (simpleError && simpleError.code === '42703' && simpleError.message?.includes('created_at')) {
        let noOrderQuery = supabase
          .from('sales')
          .select('*');
        
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

  // Get single sale (fallback without journal_entries if relation causes 400/406)
  async getSale(id: string) {
    const withJournal = `
      *,
      customer:contacts(*),
      items:sales_items(
        *,
        product:products(*),
        variation:product_variations(*)
      ),
      journal:journal_entries(entry_no, entry_date)
    `;
    const withoutJournal = `
      *,
      customer:contacts(*),
      items:sales_items(
        *,
        product:products(*),
        variation:product_variations(*)
      )
    `;
    const { data, error } = await supabase
      .from('sales')
      .select(withJournal)
      .eq('id', id)
      .single();

    if (!error) return data;

    const { data: fallbackData, error: fallbackError } = await supabase
      .from('sales')
      .select(withoutJournal)
      .eq('id', id)
      .single();
    if (fallbackError) throw fallbackError;
    return fallbackData;
  },

  // Update sale status
  async updateSaleStatus(id: string, status: Sale['status']) {
    const { data, error } = await supabase
      .from('sales')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update sale (full update)
  async updateSale(id: string, updates: Partial<Sale>) {
    const { data, error } = await supabase
      .from('sales')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Delete sale (hard delete - removes sale and cascade deletes items)
  async deleteSale(id: string) {
    // CRITICAL FIX: Use hard delete since 'cancelled' status doesn't exist in enum
    // Cascade delete will automatically remove related sale_items/sales_items
    const { error } = await supabase
      .from('sales')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Record payment
  // CRITICAL: Enforces payment_account_id, payment_date, and reference_number
  async recordPayment(
    saleId: string, 
    amount: number, 
    paymentMethod: string, 
    accountId: string, 
    companyId: string, 
    branchId: string,
    paymentDate?: string,
    referenceNumber?: string
  ) {
    // CRITICAL VALIDATION: All required fields must be present
    if (!accountId) {
      throw new Error('Payment account_id is required. Cannot save payment without account.');
    }
    
    if (!companyId || !branchId) {
      throw new Error('Company and branch are required for payment.');
    }
    
    // CRITICAL FIX: Reference number will be auto-generated by database trigger
    // Only use provided reference if explicitly given, otherwise let trigger handle it
    const paymentRef = referenceNumber || null; // Let trigger generate sequential reference
    
    // Use provided date or current date
    const paymentDateValue = paymentDate || new Date().toISOString().split('T')[0];
    
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
    
    console.log('[SALE SERVICE] Payment method normalization:', {
      original: paymentMethod,
      normalized: normalizedPaymentMethod,
      enumValue: enumPaymentMethod
    });
    
    // Build payment data - use actual schema columns from 03_frontend_driven_schema.sql
    // Schema: company_id, branch_id, payment_type, reference_type, reference_id, amount, 
    //         payment_method, payment_date, payment_account_id, reference_number, notes, created_by
    const paymentData: any = {
      company_id: companyId,
      branch_id: branchId,
      payment_type: 'received',
      reference_type: 'sale',
      reference_id: saleId,
      amount,
      payment_method: enumPaymentMethod, // CRITICAL: Use lowercase enum value
      payment_date: paymentDateValue,
      payment_account_id: accountId, // CRITICAL: Always required
      reference_number: paymentRef, // Will be auto-generated by trigger if null
    };
    
    const { data, error } = await supabase
      .from('payments')
      .insert(paymentData)
      .select()
      .single();

    if (error) {
      console.error('[SALE SERVICE] Payment insert error:', {
        error,
        paymentData,
        accountId,
        companyId,
        branchId
      });
      throw error;
    }

    // Update sale paid_amount (trigger will handle this)
    return data;
  },

  // Update payment
  async updatePayment(
    paymentId: string,
    saleId: string,
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
        console.error('[SALE SERVICE] Error updating payment:', error);
        throw error;
      }

      // Triggers will handle:
      // 1. Journal entry update (if needed)
      // 2. Sale totals recalculation
      console.log('[SALE SERVICE] Payment updated successfully');
      return data;
    } catch (error: any) {
      console.error('[SALE SERVICE] Error updating payment:', error);
      throw error;
    }
  },

  // Get sales report
  async getSalesReport(companyId: string, startDate: string, endDate: string) {
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .eq('company_id', companyId)
      .eq('status', 'final')
      .gte('invoice_date', startDate)
      .lte('invoice_date', endDate)
      .order('invoice_date');

    if (error) throw error;
    return data;
  },

  // Get a single payment by ID (for ledger detail panel)
  async getPaymentById(paymentId: string) {
    const { data, error } = await supabase
      .from('payments')
      .select(`
        id,
        reference_number,
        payment_date,
        amount,
        payment_method,
        payment_account_id,
        reference_id,
        reference_type,
        notes,
        created_at,
        account:accounts(id, name)
      `)
      .eq('id', paymentId)
      .single();

    if (error || !data) return null;
    const p = data as any;
    return {
      id: p.id,
      referenceNo: p.reference_number || '',
      date: p.payment_date,
      amount: parseFloat(p.amount || 0),
      method: p.payment_method || 'cash',
      accountId: p.payment_account_id,
      accountName: p.account?.name || '',
      referenceId: p.reference_id,
      referenceType: p.reference_type,
      notes: p.notes || '',
      createdAt: p.created_at,
    };
  },

  // Get payments for a specific sale (by sale ID)
  async getSalePayments(saleId: string) {
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
      .eq('reference_type', 'sale')
      .eq('reference_id', saleId)
      .order('payment_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[SALE SERVICE] Error fetching payments:', error);
      return [];
    }

    // Transform to match Payment interface
    return (data || []).map((p: any) => ({
      id: p.id,
      date: p.payment_date,
      referenceNo: p.reference_number || '',
      amount: parseFloat(p.amount || 0),
      method: p.payment_method || 'cash',
      accountId: p.payment_account_id,
      accountName: p.account?.name || '',
      notes: p.notes || '',
      createdAt: p.created_at,
    }));
  },

  // Delete payment (with reverse entry for accounting integrity)
  async deletePayment(paymentId: string, saleId: string) {
    if (!paymentId || !saleId) {
      throw new Error('Payment ID and Sale ID are required');
    }

    try {
      // CRITICAL FIX: Use RPC function for transaction-safe deletion
      // This ensures all operations happen in a single transaction
      const { data, error } = await supabase.rpc('delete_payment_with_reverse', {
        p_payment_id: paymentId,
        p_sale_id: saleId
      });

      if (error) {
        // If RPC doesn't exist, fallback to direct delete (with proper error handling)
        if (error.code === '42883' || error.message?.includes('function') || error.message?.includes('does not exist')) {
          console.warn('[SALE SERVICE] RPC function not found, using direct delete');
          return await this.deletePaymentDirect(paymentId, saleId);
        }
        console.error('[SALE SERVICE] Error deleting payment via RPC:', error);
        throw error;
      }

      console.log('[SALE SERVICE] Payment deleted successfully with reverse entry');
      return true;
    } catch (error: any) {
      console.error('[SALE SERVICE] Error deleting payment:', error);
      throw error;
    }
  },

  // Direct delete fallback (if RPC not available)
  async deletePaymentDirect(paymentId: string, saleId: string) {
    try {
      // CRITICAL FIX: Fetch payment details before deletion
      const { data: paymentData, error: fetchError } = await supabase
        .from('payments')
        .select('*')
        .eq('id', paymentId)
        .single();

      if (fetchError || !paymentData) {
        throw new Error('Payment not found');
      }

      // CRITICAL FIX: Delete related journal entries first (if they exist)
      // Journal entries are linked via payment_id (FK with SET NULL, so safe to delete)
      const { data: journalEntries } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('payment_id', paymentId);

      if (journalEntries && journalEntries.length > 0) {
        // Delete journal entry lines first (foreign key constraint)
        for (const entry of journalEntries) {
          const { error: lineError } = await supabase
            .from('journal_entry_lines')
            .delete()
            .eq('journal_entry_id', entry.id);
          
          if (lineError) {
            console.error('[SALE SERVICE] Error deleting journal entry lines:', lineError);
            // Continue even if some lines fail
          }
        }

        // Then delete journal entries
        const { error: entryError } = await supabase
          .from('journal_entries')
          .delete()
          .eq('payment_id', paymentId);
        
        if (entryError) {
          console.error('[SALE SERVICE] Error deleting journal entries:', entryError);
          // Continue - payment can still be deleted
        }
      }

      // CRITICAL FIX: Delete the payment record
      // Database triggers will:
      // 1. Create reverse journal entry (trigger_create_payment_reverse_entry)
      // 2. Update sale totals (trigger_update_sale_totals_delete)
      const { error: deleteError } = await supabase
        .from('payments')
        .delete()
        .eq('id', paymentId);

      if (deleteError) {
        console.error('[SALE SERVICE] Error deleting payment:', deleteError);
        throw deleteError;
      }

      // CRITICAL FIX: Wait a bit for triggers to complete, then verify
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify sale totals were updated
      const { data: updatedSale } = await supabase
        .from('sales')
        .select('paid_amount, due_amount, payment_status')
        .eq('id', saleId)
        .single();

      if (updatedSale) {
        console.log('[SALE SERVICE] Payment deleted, updated sale totals:', {
          paid_amount: updatedSale.paid_amount,
          due_amount: updatedSale.due_amount,
          payment_status: updatedSale.payment_status
        });
      }

      return true;
    } catch (error: any) {
      console.error('[SALE SERVICE] Error in direct delete:', error);
      throw error;
    }
  },
};
