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

  // Get all sales
  async getAllSales(companyId: string, branchId?: string) {
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

  // Get single sale
  async getSale(id: string) {
    const { data, error } = await supabase
      .from('sales')
      .select(`
        *,
        customer:contacts(*),
        items:sales_items(
          *,
          product:products(*),
          variation:product_variations(*)
        ),
        journal:journal_entries(entry_no, entry_date)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
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
  async recordPayment(saleId: string, amount: number, paymentMethod: string, accountId: string, companyId: string, branchId: string) {
    const { data, error } = await supabase
      .from('payments')
      .insert({
        company_id: companyId,
        branch_id: branchId,
        payment_type: 'received',
        reference_type: 'sale',
        reference_id: saleId,
        amount,
        payment_method: paymentMethod,
        payment_account_id: accountId,
        payment_date: new Date().toISOString().split('T')[0],
      })
      .select()
      .single();

    if (error) throw error;

    // Update sale paid_amount (trigger will handle this)
    return data;
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
};
