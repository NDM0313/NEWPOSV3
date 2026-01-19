import { supabase } from '@/lib/supabase';

export interface Sale {
  id?: string;
  company_id: string;
  branch_id: string;
  invoice_no?: string;
  invoice_date: string;
  customer_id?: string;
  customer_name: string;
  status: 'draft' | 'quotation' | 'order' | 'final';
  payment_status: 'paid' | 'partial' | 'unpaid';
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  shipping_charges: number;
  total: number;
  paid_amount: number;
  due_amount: number;
  notes?: string;
  created_by: string;
}

export interface SaleItem {
  product_id: string;
  variation_id?: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
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

    const { error: itemsError } = await supabase
      .from('sale_items')
      .insert(itemsWithSaleId);

    if (itemsError) {
      // Rollback: Delete sale
      await supabase.from('sales').delete().eq('id', saleData.id);
      throw itemsError;
    }

    return saleData;
  },

  // Get all sales
  async getAllSales(companyId: string, branchId?: string) {
    let query = supabase
      .from('sales')
      .select(`
        *,
        customer:contacts(name, phone),
        items:sale_items(
          *,
          product:products(name)
        ),
        created_by_user:users(full_name)
      `)
      .eq('company_id', companyId)
      .order('invoice_date', { ascending: false });

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query;
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
        items:sale_items(
          *,
          product:products(*),
          variation:product_variations(*)
        ),
        journal:journal_entries(entry_no, entry_date),
        created_by_user:users(full_name, email)
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

  // Delete sale (soft delete by setting status to cancelled)
  async deleteSale(id: string) {
    const { error } = await supabase
      .from('sales')
      .update({ status: 'cancelled' })
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
