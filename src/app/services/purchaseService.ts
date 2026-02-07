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

  // Delete purchase with complete cascade delete
  // CRITICAL: This deletes ALL related data in correct order
  // Order: Payments → Journal Entries → Stock Movements → Ledger Entries → Activity Logs → Purchase Items → Purchase
  async deletePurchase(id: string) {
    console.log('[PURCHASE SERVICE] Starting cascade delete for purchase:', id);
    
    try {
      // STEP 1: Delete all payments for this purchase (and their journal entries)
      const { data: payments } = await supabase
        .from('payments')
        .select('id')
        .eq('reference_type', 'purchase')
        .eq('reference_id', id);

      if (payments && payments.length > 0) {
        console.log(`[PURCHASE SERVICE] Found ${payments.length} payments to delete`);
        for (const payment of payments) {
          try {
            // Delete payment using the existing deletePaymentDirect method
            await this.deletePaymentDirect(payment.id, id);
          } catch (paymentError: any) {
            console.error(`[PURCHASE SERVICE] Error deleting payment ${payment.id}:`, paymentError);
            // Continue with other deletions even if one payment fails
          }
        }
      }

      // STEP 2: Delete stock movements (to reverse stock)
      // CRITICAL: Include variation_id for proper stock reversal
      const { data: stockMovements } = await supabase
        .from('stock_movements')
        .select('id, company_id, branch_id, product_id, variation_id, quantity, unit_cost, total_cost')
        .eq('reference_type', 'purchase')
        .eq('reference_id', id);

      if (stockMovements && stockMovements.length > 0) {
        console.log(`[PURCHASE SERVICE] Found ${stockMovements.length} stock movements to reverse`);
        // Create reverse stock movements before deleting (STEP 3: Reverse, not hide)
        for (const movement of stockMovements) {
          try {
            // Create reverse movement (negative quantity to reverse stock)
            // CRITICAL: Include variation_id for variation-specific stock reversal
            const reverseMovement = {
              company_id: movement.company_id,
              branch_id: movement.branch_id,
              product_id: movement.product_id,
              variation_id: movement.variation_id || null, // CRITICAL: Include variation_id
              movement_type: 'adjustment',
              quantity: -(Number(movement.quantity) || 0), // Negative to reverse
              unit_cost: Number(movement.unit_cost) || 0,
              total_cost: -(Number(movement.total_cost) || 0), // Negative to reverse
              reference_type: 'purchase',
              reference_id: id,
              notes: `Reverse stock from deleted purchase ${id}`,
            };
            
            console.log('[PURCHASE SERVICE] Creating reverse stock movement:', {
              product_id: reverseMovement.product_id,
              variation_id: reverseMovement.variation_id,
              quantity: reverseMovement.quantity
            });
            
            const { data: reverseData, error: reverseError } = await supabase
              .from('stock_movements')
              .insert(reverseMovement)
              .select()
              .single();
            
            if (reverseError) {
              console.error('[PURCHASE SERVICE] ❌ Failed to create reverse stock movement:', reverseError);
              throw reverseError; // Don't allow silent failure
            }
            
            console.log('[PURCHASE SERVICE] ✅ Reverse stock movement created:', reverseData?.id);
          } catch (reverseError: any) {
            console.error('[PURCHASE SERVICE] ❌ CRITICAL: Could not create reverse stock movement:', reverseError);
            throw new Error(`Failed to reverse stock movement: ${reverseError.message || reverseError}`);
          }
        }
        
        // Delete original stock movements
        const { error: stockError } = await supabase
          .from('stock_movements')
          .delete()
          .eq('reference_type', 'purchase')
          .eq('reference_id', id);

        if (stockError) {
          console.error('[PURCHASE SERVICE] Error deleting stock movements:', stockError);
          // Continue with other deletions
        }
      }

      // STEP 3: Delete ledger entries (supplier ledger)
      // CRITICAL: Delete ALL entries related to this purchase (purchase, payment, discount, cargo)
      const { data: ledgerEntries } = await supabase
        .from('ledger_entries')
        .select('id, source, reference_no')
        .or(`and(source.eq.purchase,reference_id.eq.${id}),and(source.eq.payment,reference_id.eq.${id})`)
        .like('reference_no', `%${id}%`); // Also match by reference_no pattern

      // More comprehensive: Delete by reference_id regardless of source
      const { data: allLedgerEntries } = await supabase
        .from('ledger_entries')
        .select('id, source, reference_no, reference_id')
        .eq('reference_id', id);

      const entriesToDelete = allLedgerEntries || ledgerEntries || [];
      
      if (entriesToDelete.length > 0) {
        console.log(`[PURCHASE SERVICE] Found ${entriesToDelete.length} ledger entries to delete:`, entriesToDelete.map(e => ({ source: e.source, ref: e.reference_no })));
        
        // Delete by reference_id (catches all entries linked to this purchase)
        const { error: ledgerError } = await supabase
          .from('ledger_entries')
          .delete()
          .eq('reference_id', id);

        if (ledgerError) {
          console.error('[PURCHASE SERVICE] Error deleting ledger entries:', ledgerError);
          // Try alternative: delete by source and reference_no pattern
          const purchaseNo = entriesToDelete[0]?.reference_no;
          if (purchaseNo) {
            const { error: altError } = await supabase
              .from('ledger_entries')
              .delete()
              .eq('reference_no', purchaseNo);
            
            if (altError) {
              console.error('[PURCHASE SERVICE] Alternative ledger delete also failed:', altError);
            } else {
              console.log('[PURCHASE SERVICE] ✅ Deleted ledger entries by reference_no');
            }
          }
        } else {
          console.log('[PURCHASE SERVICE] ✅ Deleted ledger entries by reference_id');
        }
      }

      // STEP 4: Delete journal entries directly linked to purchase (if any)
      const { data: journalEntries } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('reference_type', 'purchase')
        .eq('reference_id', id);

      if (journalEntries && journalEntries.length > 0) {
        console.log(`[PURCHASE SERVICE] Found ${journalEntries.length} journal entries to delete`);
        for (const entry of journalEntries) {
          // Delete journal entry lines first
          const { error: lineError } = await supabase
            .from('journal_entry_lines')
            .delete()
            .eq('journal_entry_id', entry.id);

          if (lineError) {
            console.error('[PURCHASE SERVICE] Error deleting journal entry lines:', lineError);
          }

          // Then delete journal entry
          const { error: entryError } = await supabase
            .from('journal_entries')
            .delete()
            .eq('id', entry.id);

          if (entryError) {
            console.error('[PURCHASE SERVICE] Error deleting journal entry:', entryError);
          }
        }
      }

      // STEP 5: Delete activity logs
      const { error: activityError } = await supabase
        .from('activity_logs')
        .delete()
        .eq('module', 'purchase')
        .eq('entity_id', id);

      if (activityError) {
        console.warn('[PURCHASE SERVICE] Error deleting activity logs (non-critical):', activityError);
        // Activity logs deletion failure is non-critical
      }

      // STEP 6: Delete purchase items (cascade should handle this, but explicit for safety)
      const { error: itemsError } = await supabase
        .from('purchase_items')
        .delete()
        .eq('purchase_id', id);

      if (itemsError) {
        console.error('[PURCHASE SERVICE] Error deleting purchase items:', itemsError);
        // Continue - purchase deletion will cascade
      }

      // STEP 7: Finally delete the purchase record itself
      const { error: purchaseError } = await supabase
        .from('purchases')
        .delete()
        .eq('id', id);

      if (purchaseError) {
        console.error('[PURCHASE SERVICE] Error deleting purchase:', purchaseError);
        throw purchaseError;
      }

      console.log('[PURCHASE SERVICE] ✅ Cascade delete completed successfully for purchase:', id);
    } catch (error: any) {
      console.error('[PURCHASE SERVICE] ❌ Cascade delete failed for purchase:', id, error);
      throw new Error(`Failed to delete purchase: ${error.message || 'Unknown error'}`);
    }
  },

  // Record payment – allowed only when purchase status is final/completed (ERP rule). referenceNumber = PAY-xxxx from Numbering.
  async recordPayment(purchaseId: string, amount: number, paymentMethod: string, accountId: string, companyId: string, branchId?: string | null, referenceNumber?: string | null) {
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

    // 🔧 FIX 4: PAYMENT ACCOUNT VALIDATION (MANDATORY)
    if (!accountId) {
      throw new Error('Payment account is required. Please select an account.');
    }

    const { data, error } = await supabase
      .from('payments')
      .insert({
        company_id: companyId,
        branch_id: validBranchId,
        payment_type: 'paid',
        reference_type: 'purchase',
        reference_id: purchaseId,
        amount,
        payment_method: enumPaymentMethod,
        payment_account_id: accountId,
        payment_date: new Date().toISOString().split('T')[0],
        ...(referenceNumber ? { reference_number: referenceNumber } : {}),
      })
      .select('*')
      .single();

    if (error) throw error;
    
    // 🔧 FIX 3: PURCHASE PAYMENT JOURNAL ENTRY (MANDATORY)
    // CRITICAL: ALWAYS create journal entry for purchase payment
    // Rule: Accounts Payable Dr, Cash/Bank Cr
    try {
      // Get Accounts Payable account
      const { data: apAccounts } = await supabase
        .from('accounts')
        .select('id')
        .eq('company_id', companyId)
        .or('name.ilike.Accounts Payable,code.eq.2000')
        .limit(1);
      
      const apAccountId = apAccounts?.[0]?.id;
      
      // Get payment account (Cash/Bank)
      const { data: paymentAccount } = await supabase
        .from('accounts')
        .select('id, name')
        .eq('id', accountId)
        .single();
      
      if (!apAccountId || !paymentAccount) {
        console.error('[PURCHASE SERVICE] ❌ CRITICAL: Missing accounts for payment journal entry');
        throw new Error('Missing required accounts for payment journal entry');
      }
      
      // Create journal entry for payment
      const { data: journalEntry, error: journalError } = await supabase
        .from('journal_entries')
        .insert({
          company_id: companyId,
          branch_id: validBranchId,
          entry_date: new Date().toISOString().split('T')[0],
          description: `Payment for purchase ${purchaseId}`,
          reference_type: 'payment',
          reference_id: data.id, // Payment ID
          payment_id: data.id,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single();
      
      if (journalError || !journalEntry) {
        console.error('[PURCHASE SERVICE] ❌ CRITICAL: Failed to create payment journal entry:', journalError);
        throw new Error(`Failed to create payment journal entry: ${journalError?.message || 'Unknown error'}`);
      }
      
      // Debit: Accounts Payable (we paid supplier, reduces what we owe)
      const { error: debitError } = await supabase
        .from('journal_entry_lines')
        .insert({
          journal_entry_id: journalEntry.id,
          account_id: apAccountId,
          debit: amount,
          credit: 0,
          description: `Payment to supplier for purchase ${purchaseId}`,
        });
      
      if (debitError) {
        console.error('[PURCHASE SERVICE] ❌ CRITICAL: Failed to create AP debit line:', debitError);
        throw debitError;
      }
      
      // Credit: Cash/Bank (money went out)
      const { error: creditError } = await supabase
        .from('journal_entry_lines')
        .insert({
          journal_entry_id: journalEntry.id,
          account_id: accountId,
          debit: 0,
          credit: amount,
          description: `Payment from ${paymentAccount.name}`,
        });
      
      if (creditError) {
        console.error('[PURCHASE SERVICE] ❌ CRITICAL: Failed to create payment account credit line:', creditError);
        throw creditError;
      }
      
      console.log('[PURCHASE SERVICE] ✅ Created payment journal entry:', journalEntry.id);
    } catch (journalErr: any) {
      console.error('[PURCHASE SERVICE] ❌ CRITICAL: Payment journal entry failed:', journalErr);
      // Don't delete payment if journal fails - payment is already created
      // But log error for manual correction
      throw new Error(`Payment recorded but journal entry failed: ${journalErr.message}`);
    }
    
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
    console.log('[PURCHASE SERVICE] getPurchasePayments called with purchaseId:', purchaseId);
    
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

    console.log('[PURCHASE SERVICE] Payment query result:', { 
      dataCount: data?.length || 0, 
      error: error?.message,
      purchaseId 
    });

    if (error) {
      console.error('[PURCHASE SERVICE] Error fetching payments:', error);
      // Don't throw - return empty array and log warning
    }

    // 🔒 GOLDEN RULE: Payment history = payments table ONLY (no fallback to paid_amount)
    if (data && data.length > 0) {
      console.log('[PURCHASE SERVICE] Found', data.length, 'payments for purchase:', purchaseId);
      return data.map((p: any) => ({
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
    }

    // 🔒 GOLDEN RULE: Return empty array if no payments found (never fallback to paid_amount)
    console.log('[PURCHASE SERVICE] No payments found in payments table for purchase:', purchaseId);
    return [];

    return [];
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
