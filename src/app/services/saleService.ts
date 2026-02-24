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
  status: 'draft' | 'quotation' | 'order' | 'final' | 'cancelled';
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
  attachments?: { url: string; name: string }[] | null;
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

  // Get single sale by ID (with items for edit form).
  // DB may have sale_items or sales_items; if nested items are empty, fetch items separately.
  async getSaleById(saleId: string) {
    const selectWithItems = (table: 'sales_items' | 'sale_items') => `
      *,
      customer:contacts(*),
      branch:branches(id, name, code),
      items:${table}(
        *,
        product:products(*),
        variation:product_variations(*)
      )
    `;
    let data: any = null;
    let err: any = null;

    const res1 = await supabase.from('sales').select(selectWithItems('sales_items')).eq('id', saleId).single();
    if (!res1.error && res1.data) {
      data = res1.data;
    } else {
      const res2 = await supabase.from('sales').select(selectWithItems('sale_items')).eq('id', saleId).single();
      if (!res2.error && res2.data) data = res2.data;
      else err = res2.error;
    }

    if (err) throw err;
    if (!data) throw new Error('Sale not found');

    // If items missing (wrong table or RLS), fetch line items directly
    if (!data.items || data.items.length === 0) {
      const { data: rows } = await supabase.from('sale_items').select('*, product:products(*), variation:product_variations(*)').eq('sale_id', saleId);
      if (rows && rows.length > 0) data.items = rows;
      else {
        const { data: rows2 } = await supabase.from('sales_items').select('*, product:products(*), variation:product_variations(*)').eq('sale_id', saleId);
        if (rows2 && rows2.length > 0) data.items = rows2;
      }
    }

    // 🔒 LOCK CHECK: Check if sale has returns (prevents editing)
    const { data: returns } = await supabase
      .from('sale_returns')
      .select('id')
      .eq('original_sale_id', saleId)
      .eq('status', 'final')
      .limit(1);
    
    data.hasReturn = (returns && returns.length > 0) || false;
    data.returnCount = returns?.length || 0;

    return data;
  },

  // Get all sales (with items for list count and edit)
  async getAllSales(companyId: string, branchId?: string) {
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
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .order('invoice_date', { ascending: false });

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query;

    if (error && (error.code === '42P01' || error.message?.includes('sales_items'))) {
      let retryQuery = supabase
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
        .eq('company_id', companyId)
        .order('invoice_date', { ascending: false });

      if (branchId) {
        retryQuery = retryQuery.eq('branch_id', branchId);
      }

      const { data: retryData, error: retryError } = await retryQuery;
      if (retryError) throw retryError;
      
      // 🔒 LOCK CHECK: Add hasReturn and returnCount to each sale
      if (retryData && retryData.length > 0) {
        const saleIds = retryData.map((s: any) => s.id);
        const { data: allReturns } = await supabase
          .from('sale_returns')
          .select('original_sale_id')
          .in('original_sale_id', saleIds)
          .eq('status', 'final');
        
        const returnsMap = new Map<string, number>();
        (allReturns || []).forEach((r: any) => {
          const count = returnsMap.get(r.original_sale_id) || 0;
          returnsMap.set(r.original_sale_id, count + 1);
        });
        
        retryData.forEach((sale: any) => {
          sale.hasReturn = returnsMap.has(sale.id);
          sale.returnCount = returnsMap.get(sale.id) || 0;
        });
      }
      
      return retryData;
    }

    if (error) throw error;
    
    // 🔒 LOCK CHECK: Add hasReturn and returnCount to each sale
    if (data && data.length > 0) {
      const saleIds = data.map((s: any) => s.id);
      const { data: allReturns } = await supabase
        .from('sale_returns')
        .select('original_sale_id')
        .in('original_sale_id', saleIds)
        .eq('status', 'final');
      
      const returnsMap = new Map<string, number>();
      (allReturns || []).forEach((r: any) => {
        const count = returnsMap.get(r.original_sale_id) || 0;
        returnsMap.set(r.original_sale_id, count + 1);
      });
      
      data.forEach((sale: any) => {
        sale.hasReturn = returnsMap.has(sale.id);
        sale.returnCount = returnsMap.get(sale.id) || 0;
      });
    }
    
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
    const selectWithItems = (itemsTable: 'sales_items' | 'sale_items') =>
      `*, customer:contacts(name, phone), items:${itemsTable}(*)`;
    const runQuery = async (itemsTable: 'sales_items' | 'sale_items', orderBy: string) => {
      let q = supabase.from('sales').select(selectWithItems(itemsTable)).eq('company_id', companyId).ilike('invoice_no', 'STD-%');
      if (branchId && branchId !== 'all') q = q.eq('branch_id', branchId);
      q = q.order(orderBy, { ascending: false });
      return await q;
    };
    let { data, error } = await runQuery('sales_items', 'invoice_date');
    if (error && (error.code === '42P01' || error.code === '42703' || String(error.message || '').includes('sales_items') || String(error.message || '').includes('invoice_date'))) {
      const ret = await runQuery('sale_items', 'created_at');
      data = ret.data;
      error = ret.error;
    }
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

  // Get single sale (journal_entries join can cause 400 if relation not defined - use base select)
  async getSale(id: string) {
    const baseSelect = `
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
      .select(baseSelect)
      .eq('id', id)
      .single();

    const saleData = data;
    if (error) throw error;

    // 🔒 LOCK CHECK: Check if sale has returns (prevents editing)
    const { data: returns } = await supabase
      .from('sale_returns')
      .select('id')
      .eq('original_sale_id', id)
      .eq('status', 'final')
      .limit(1);
    
    if (saleData) {
      saleData.hasReturn = (returns && returns.length > 0) || false;
      saleData.returnCount = returns?.length || 0;
    }

    return saleData;
  },

  // Update sale status (when 'cancelled': create SALE_CANCELLED stock reversals, then update status)
  async updateSaleStatus(id: string, status: Sale['status']) {
    if (status === 'cancelled') {
      const { data: saleRow } = await supabase.from('sales').select('id, invoice_no, branch_id, company_id').eq('id', id).single();
      if (!saleRow) throw new Error('Sale not found');
      const invoiceNo = (saleRow as any).invoice_no || `SL-${id.substring(0, 8)}`;

      const { data: existingReversal } = await supabase
        .from('stock_movements')
        .select('id')
        .eq('reference_type', 'sale')
        .eq('reference_id', id)
        .eq('movement_type', 'SALE_CANCELLED')
        .limit(1);
      if (existingReversal && existingReversal.length > 0) {
        const { data, error } = await supabase.from('sales').update({ status }).eq('id', id).select().single();
        if (error) throw error;
        return data;
      }

      const { data: stockMovements } = await supabase
        .from('stock_movements')
        .select('id, company_id, branch_id, product_id, variation_id, quantity, unit_cost, total_cost, box_change, piece_change')
        .eq('reference_type', 'sale')
        .eq('reference_id', id)
        .eq('movement_type', 'sale');

      if (stockMovements && stockMovements.length > 0) {
        for (const m of stockMovements) {
          const reverseMovement: Record<string, unknown> = {
            company_id: m.company_id,
            branch_id: m.branch_id,
            product_id: m.product_id,
            variation_id: m.variation_id ?? null,
            movement_type: 'SALE_CANCELLED',
            quantity: Math.abs(Number(m.quantity) || 0),
            unit_cost: Number(m.unit_cost) || 0,
            total_cost: Math.abs(Number(m.total_cost) || 0),
            reference_type: 'sale',
            reference_id: id,
            notes: `Reversal of ${invoiceNo} (Cancelled)`,
          };
          if (m.box_change != null) reverseMovement.box_change = Math.abs(Number(m.box_change) || 0);
          if (m.piece_change != null) reverseMovement.piece_change = Math.abs(Number(m.piece_change) || 0);
          const { error: insertErr } = await supabase.from('stock_movements').insert(reverseMovement);
          if (insertErr) throw insertErr;
        }
      }

      const { data, error } = await supabase.from('sales').update({ status }).eq('id', id).select().single();
      if (error) throw error;
      return data;
    }

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
    // 🔒 CANCELLED: No updates allowed on cancelled sales
    const { data: existingSale } = await supabase.from('sales').select('status').eq('id', id).single();
    if (existingSale && (existingSale as any).status === 'cancelled') {
      throw new Error('Cannot edit a cancelled invoice.');
    }
    // 🔒 LOCK CHECK: Prevent editing if sale has returns
    const { data: returns } = await supabase
      .from('sale_returns')
      .select('id')
      .eq('original_sale_id', id)
      .eq('status', 'final')
      .limit(1);
    
    if (returns && returns.length > 0) {
      throw new Error('Cannot edit sale: This sale has a return and is locked. Returns cannot be edited or deleted.');
    }

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
  // Delete sale with complete cascade delete (STEP 3: Reverse, not hide)
  // CRITICAL: This deletes ALL related data in correct order
  // Order: Payments → Journal Entries → Stock Movements (reverse) → Ledger Entries → Activity Logs → Sale Items → Sale
  async deleteSale(id: string) {
    // 🔒 CANCELLED: No delete allowed on cancelled sales (they are already reversed)
    const { data: existingSale } = await supabase.from('sales').select('status').eq('id', id).single();
    if (existingSale && (existingSale as any).status === 'cancelled') {
      throw new Error('Cannot delete a cancelled invoice.');
    }
    console.log('[SALE SERVICE] Starting cascade delete for sale:', id);
    
    try {
      // STEP 1: Delete all payments for this sale (and their journal entries)
      const { data: payments } = await supabase
        .from('payments')
        .select('id')
        .eq('reference_type', 'sale')
        .eq('reference_id', id);

      if (payments && payments.length > 0) {
        console.log(`[SALE SERVICE] Found ${payments.length} payments to delete`);
        for (const payment of payments) {
          try {
            await this.deletePaymentDirect(payment.id, id);
          } catch (paymentError: any) {
            console.error(`[SALE SERVICE] Error deleting payment ${payment.id}:`, paymentError);
            // Continue with other deletions even if one payment fails
          }
        }
      }

      // STEP 2: Reverse stock movements (to restore stock)
      // CRITICAL: Include variation_id for proper stock reversal
      const { data: stockMovements } = await supabase
        .from('stock_movements')
        .select('id, company_id, branch_id, product_id, variation_id, quantity, unit_cost, total_cost')
        .eq('reference_type', 'sale')
        .eq('reference_id', id);

      if (stockMovements && stockMovements.length > 0) {
        console.log(`[SALE SERVICE] Found ${stockMovements.length} stock movements to reverse`);
        // Create reverse stock movements before deleting (STEP 3: Reverse, not hide)
        for (const movement of stockMovements) {
          try {
            // Create reverse movement (positive quantity to restore stock - sale was negative)
            // CRITICAL: Include variation_id for variation-specific stock reversal
            const reverseMovement = {
              company_id: movement.company_id,
              branch_id: movement.branch_id,
              product_id: movement.product_id,
              variation_id: movement.variation_id || null, // CRITICAL: Include variation_id
              movement_type: 'adjustment',
              quantity: Math.abs(Number(movement.quantity) || 0), // Positive to reverse negative sale
              unit_cost: Number(movement.unit_cost) || 0,
              total_cost: Math.abs(Number(movement.total_cost) || 0), // Positive to reverse
              reference_type: 'sale',
              reference_id: id,
              notes: `Reverse stock from deleted sale ${id}`,
            };
            
            console.log('[SALE SERVICE] Creating reverse stock movement:', {
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
              console.error('[SALE SERVICE] ❌ Failed to create reverse stock movement:', reverseError);
              throw reverseError; // Don't allow silent failure
            }
            
            console.log('[SALE SERVICE] ✅ Reverse stock movement created:', reverseData?.id);
          } catch (reverseError: any) {
            console.error('[SALE SERVICE] ❌ CRITICAL: Could not create reverse stock movement:', reverseError);
            throw new Error(`Failed to reverse stock movement: ${reverseError.message || reverseError}`);
          }
        }
        
        // Delete original stock movements
        const { error: stockError } = await supabase
          .from('stock_movements')
          .delete()
          .eq('reference_type', 'sale')
          .eq('reference_id', id);

        if (stockError) {
          console.error('[SALE SERVICE] Error deleting stock movements:', stockError);
          throw stockError;
        }
      }

      // STEP 3: Delete ledger entries (customer ledger)
      // CRITICAL: Delete ALL entries related to this sale (sale, payment, discount)
      const { data: allLedgerEntries } = await supabase
        .from('ledger_entries')
        .select('id, source, reference_no, reference_id')
        .eq('reference_id', id);

      if (allLedgerEntries && allLedgerEntries.length > 0) {
        console.log(`[SALE SERVICE] Found ${allLedgerEntries.length} ledger entries to delete`);
        const { error: ledgerError } = await supabase
          .from('ledger_entries')
          .delete()
          .eq('reference_id', id);

        if (ledgerError) {
          console.error('[SALE SERVICE] Error deleting ledger entries:', ledgerError);
          throw ledgerError;
        }
      }

      // STEP 4: Delete journal entries directly linked to sale
      const { data: journalEntries } = await supabase
        .from('journal_entries')
        .select('id')
        .eq('reference_type', 'sale')
        .eq('reference_id', id);

      if (journalEntries && journalEntries.length > 0) {
        console.log(`[SALE SERVICE] Found ${journalEntries.length} journal entries to delete`);
        for (const entry of journalEntries) {
          // Delete journal entry lines first
          const { error: lineError } = await supabase
            .from('journal_entry_lines')
            .delete()
            .eq('journal_entry_id', entry.id);

          if (lineError) {
            console.error('[SALE SERVICE] Error deleting journal entry lines:', lineError);
          }

          // Then delete journal entry
          const { error: entryError } = await supabase
            .from('journal_entries')
            .delete()
            .eq('id', entry.id);

          if (entryError) {
            console.error('[SALE SERVICE] Error deleting journal entry:', entryError);
          }
        }
      }

      // STEP 5: Delete activity logs
      const { error: activityError } = await supabase
        .from('activity_logs')
        .delete()
        .eq('module', 'sale')
        .eq('entity_id', id);

      if (activityError) {
        console.warn('[SALE SERVICE] Error deleting activity logs (non-critical):', activityError);
        // Activity logs deletion failure is non-critical
      }

      // STEP 6: Delete sale items (cascade should handle this, but explicit for safety)
      const { error: itemsError } = await supabase
        .from('sale_items')
        .delete()
        .eq('sale_id', id);

      if (itemsError) {
        // Try sales_items table as well
        const { error: itemsError2 } = await supabase
          .from('sales_items')
          .delete()
          .eq('sale_id', id);
        
        if (itemsError2) {
          console.error('[SALE SERVICE] Error deleting sale items:', itemsError2);
          // Continue - sale deletion will cascade
        }
      }

      // STEP 7: Finally delete the sale record itself
      const { error: saleError } = await supabase
        .from('sales')
        .delete()
        .eq('id', id);

      if (saleError) {
        console.error('[SALE SERVICE] Error deleting sale:', saleError);
        throw saleError;
      }

      console.log('[SALE SERVICE] ✅ Cascade delete completed successfully for sale:', id);
    } catch (error: any) {
      console.error('[SALE SERVICE] ❌ Cascade delete failed for sale:', id, error);
      throw new Error(`Failed to delete sale: ${error.message || 'Unknown error'}`);
    }
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
    referenceNumber?: string,
    options?: { notes?: string; attachments?: any }
  ) {
    // 🔒 CANCELLED: No payment allowed on cancelled sales
    const { data: saleRow } = await supabase.from('sales').select('status').eq('id', saleId).single();
    if (saleRow && (saleRow as any).status === 'cancelled') {
      throw new Error('Cannot record payment on a cancelled invoice.');
    }
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
      payment_method: enumPaymentMethod,
      payment_date: paymentDateValue,
      payment_account_id: accountId,
      reference_number: paymentRef,
    };
    if (options?.notes !== undefined && options.notes !== '') {
      paymentData.notes = options.notes;
    }
    if (options?.attachments !== undefined && options.attachments != null) {
      const arr = Array.isArray(options.attachments) ? options.attachments : [options.attachments];
      if (arr.length > 0) {
        paymentData.attachments = JSON.parse(JSON.stringify(arr));
      }
    }

    let result = await supabase.from('payments').insert(paymentData).select().single();

    if (result.error && result.error.code === 'PGRST204' && result.error.message?.includes('attachments')) {
      delete paymentData.attachments;
      result = await supabase.from('payments').insert(paymentData).select().single();
    }
    if (result.error) {
      console.error('[SALE SERVICE] Payment insert error:', {
        error: result.error,
        paymentData,
        accountId,
        companyId,
        branchId
      });
      throw result.error;
    }
    return result.data;
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
      attachments?: any;
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
      if (updates.attachments !== undefined) {
        const arr = Array.isArray(updates.attachments) ? updates.attachments : [updates.attachments];
        updateData.attachments = arr.length > 0 ? JSON.parse(JSON.stringify(arr)) : null;
      }

      let updateResult = await supabase
        .from('payments')
        .update(updateData)
        .eq('id', paymentId)
        .select()
        .single();

      if (updateResult.error && updateResult.error.code === 'PGRST204' && updateResult.error.message?.includes('attachments')) {
        delete updateData.attachments;
        updateResult = await supabase.from('payments').update(updateData).eq('id', paymentId).select().single();
      }
      if (updateResult.error) {
        console.error('[SALE SERVICE] Error updating payment:', updateResult.error);
        throw updateResult.error;
      }
      const data = updateResult.data;

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
    console.log('[SALE SERVICE] getSalePayments called with saleId:', saleId);

    const selectWithAttachments = `
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
    `;
    let result = await supabase
      .from('payments')
      .select(selectWithAttachments)
      .eq('reference_type', 'sale')
      .eq('reference_id', saleId)
      .order('payment_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (result.error && result.error.code === 'PGRST204' && result.error.message?.includes('attachments')) {
      result = await supabase
        .from('payments')
        .select(`
          id,
          payment_date,
          reference_number,
          amount,
          payment_method,
          payment_account_id,
          notes,
          created_at,
          account:accounts(id, name)
        `)
        .eq('reference_type', 'sale')
        .eq('reference_id', saleId)
        .order('payment_date', { ascending: false })
        .order('created_at', { ascending: false });
    }

    const data = result.data;
    const error = result.error;

    console.log('[SALE SERVICE] Payment query result:', {
      dataCount: data?.length || 0,
      error: error?.message,
      saleId
    });

    if (error) {
      console.error('[SALE SERVICE] Error fetching payments:', error);
    }

    if (data && data.length > 0) {
      console.log('[SALE SERVICE] Found', data.length, 'payments for sale:', saleId);
      return data.map((p: any) => {
        let att = p.attachments;
        if (typeof att === 'string' && att) {
          try {
            att = JSON.parse(att);
          } catch {
            att = null;
          }
        }
        return {
          id: p.id,
          date: p.payment_date,
          referenceNo: p.reference_number || '',
          amount: parseFloat(p.amount || 0),
          method: p.payment_method || 'cash',
          accountId: p.payment_account_id,
          accountName: p.account?.name || '',
          notes: p.notes || '',
          attachments: att ?? null,
          createdAt: p.created_at,
        };
      });
    }

    // FALLBACK: If no payments found by reference_id, check if sale has paid_amount > 0
    // This handles cases where paid_amount was set but payment records are missing
    console.log('[SALE SERVICE] No payments found by reference_id, checking sale paid_amount...');
    try {
      const { data: saleData } = await supabase
        .from('sales')
        .select('id, invoice_no, paid_amount, due_amount')
        .eq('id', saleId)
        .single();

      if (saleData && saleData.paid_amount > 0) {
        console.warn('[SALE SERVICE] ⚠️ Sale has paid_amount > 0 but no payment records found!', {
          saleId,
          invoiceNo: saleData.invoice_no,
          paidAmount: saleData.paid_amount
        });
        // Return empty array - payments are missing, need to be created
        // TODO: Could auto-create payment record here, but that's risky without user confirmation
      }
    } catch (saleError) {
      console.error('[SALE SERVICE] Error checking sale paid_amount:', saleError);
    }

    return [];
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
