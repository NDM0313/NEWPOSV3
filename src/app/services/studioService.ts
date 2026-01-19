import { supabase } from '@/lib/supabase';

export interface StudioOrder {
  id?: string;
  company_id: string;
  branch_id: string;
  order_no?: string;
  order_date: string;
  customer_id: string;
  customer_name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  order_type?: 'stitching' | 'alteration' | 'design';
  total_cost: number;
  advance_paid: number;
  balance_due: number;
  delivery_date?: string;
  actual_delivery_date?: string;
  measurements?: any; // JSONB
  notes?: string;
  created_by: string;
}

export interface StudioOrderItem {
  id?: string;
  studio_order_id: string;
  item_description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface Worker {
  id?: string;
  company_id: string;
  name: string;
  phone?: string;
  cnic?: string;
  address?: string;
  worker_type?: 'tailor' | 'cutter' | 'finisher' | 'embroidery';
  payment_type?: 'per_piece' | 'daily' | 'monthly';
  rate: number;
  current_balance: number;
  is_active: boolean;
}

export interface JobCard {
  id?: string;
  studio_order_id: string;
  task_type: 'cutting' | 'stitching' | 'finishing' | 'embroidery';
  assigned_worker_id?: string;
  status: 'pending' | 'in_progress' | 'completed';
  start_date?: string;
  end_date?: string;
  payment_amount: number;
  is_paid: boolean;
  notes?: string;
}

export const studioService = {
  // Create studio order with items
  async createStudioOrder(order: Partial<StudioOrder>, items: StudioOrderItem[]) {
    // Insert order
    const { data: orderData, error: orderError } = await supabase
      .from('studio_orders')
      .insert(order)
      .select()
      .single();

    if (orderError) throw orderError;

    // Insert items
    const itemsWithOrderId = items.map(item => ({
      ...item,
      studio_order_id: orderData.id,
    }));

    const { error: itemsError } = await supabase
      .from('studio_order_items')
      .insert(itemsWithOrderId);

    if (itemsError) {
      // Rollback: Delete order
      await supabase.from('studio_orders').delete().eq('id', orderData.id);
      throw itemsError;
    }

    return orderData;
  },

  // Get all studio orders
  async getAllStudioOrders(companyId: string, branchId?: string) {
    let query = supabase
      .from('studio_orders')
      .select(`
        *,
        customer:contacts(name, phone),
        items:studio_order_items(*),
        created_by:users(full_name)
      `)
      .eq('company_id', companyId)
      .order('order_date', { ascending: false });

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  // Get single studio order
  async getStudioOrder(id: string) {
    const { data, error } = await supabase
      .from('studio_orders')
      .select(`
        *,
        customer:contacts(*),
        items:studio_order_items(*),
        job_cards:job_cards(
          *,
          worker:workers(name, phone)
        ),
        created_by:users(full_name, email)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  // Update studio order
  async updateStudioOrder(id: string, updates: Partial<StudioOrder>) {
    const { data, error } = await supabase
      .from('studio_orders')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Delete studio order (soft delete by setting status to cancelled)
  async deleteStudioOrder(id: string) {
    const { error } = await supabase
      .from('studio_orders')
      .update({ status: 'cancelled' })
      .eq('id', id);

    if (error) throw error;
  },

  // Get workers
  async getAllWorkers(companyId: string) {
    const { data, error } = await supabase
      .from('workers')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return data;
  },

  // Create worker
  async createWorker(worker: Partial<Worker>) {
    const { data, error } = await supabase
      .from('workers')
      .insert(worker)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update worker
  async updateWorker(id: string, updates: Partial<Worker>) {
    const { data, error } = await supabase
      .from('workers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Get job cards for an order
  async getJobCards(studioOrderId: string) {
    const { data, error } = await supabase
      .from('job_cards')
      .select(`
        *,
        worker:workers(name, phone, worker_type)
      `)
      .eq('studio_order_id', studioOrderId)
      .order('created_at');

    if (error) throw error;
    return data;
  },

  // Create job card
  async createJobCard(jobCard: Partial<JobCard>) {
    const { data, error } = await supabase
      .from('job_cards')
      .insert(jobCard)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update job card
  async updateJobCard(id: string, updates: Partial<JobCard>) {
    const { data, error } = await supabase
      .from('job_cards')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Get studio orders by status
  async getStudioOrdersByStatus(companyId: string, status: StudioOrder['status']) {
    const { data, error } = await supabase
      .from('studio_orders')
      .select('*')
      .eq('company_id', companyId)
      .eq('status', status)
      .order('order_date', { ascending: false });

    if (error) throw error;
    return data;
  },
};
