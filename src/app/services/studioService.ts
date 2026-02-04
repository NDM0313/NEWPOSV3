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
    // Handle missing table gracefully
    try {
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

      // Only filter by branch when a specific branch is selected (not "all")
      if (branchId && branchId !== 'all') {
        query = query.eq('branch_id', branchId);
      }

      const { data, error } = await query;
      
      // If table doesn't exist (PGRST205), return empty array
      if (error && (error.code === 'PGRST205' || error.message?.includes('Could not find the table'))) {
        console.warn('[STUDIO SERVICE] studio_orders table not found, returning empty array');
        return [];
      }
      
      if (error) throw error;
      return data || [];
    } catch (error: any) {
      // If table doesn't exist, return empty array instead of throwing
      if (error?.code === 'PGRST205' || error?.message?.includes('Could not find the table')) {
        console.warn('[STUDIO SERVICE] studio_orders table not found, returning empty array');
        return [];
      }
      throw error;
    }
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
    // Handle missing table gracefully
    try {
      const { data, error } = await supabase
        .from('workers')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('name');

      // If table doesn't exist (PGRST205), return empty array
      if (error && (error.code === 'PGRST205' || error.message?.includes('Could not find the table'))) {
        console.warn('[STUDIO SERVICE] workers table not found, returning empty array');
        return [];
      }

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      // If table doesn't exist, return empty array instead of throwing
      if (error?.code === 'PGRST205' || error?.message?.includes('Could not find the table')) {
        console.warn('[STUDIO SERVICE] workers table not found, returning empty array');
        return [];
      }
      throw error;
    }
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

  /**
   * Workers with real stats: active/pending/completed from studio_production_stages,
   * total earnings from worker_ledger_entries (all), due balance from UNPAID ledger entries only.
   * Due balance = sum of worker_ledger_entries.amount where status = 'unpaid' (ledger-driven, not workers.current_balance).
   */
  async getWorkersWithStats(companyId: string): Promise<Array<Worker & {
    activeJobs: number;
    pendingJobs: number;
    completedJobs: number;
    pendingAmount: number;
    totalEarnings: number;
  }>> {
    const workers = await this.getAllWorkers(companyId);
    const list = (workers || []) as (Worker & { current_balance?: number })[];

    let stageCounts: Record<string, { pending: number; in_progress: number; completed: number }> = {};
    let totalEarningsByWorker: Record<string, number> = {};
    let dueBalanceByWorker: Record<string, number> = {};

    try {
      const { data: prods } = await supabase
        .from('studio_productions')
        .select('id')
        .eq('company_id', companyId);
      const prodIds = (prods || []).map((p: { id: string }) => p.id);

      if (prodIds.length > 0) {
        const { data: stageRows } = await supabase
          .from('studio_production_stages')
          .select('assigned_worker_id, status')
          .in('production_id', prodIds);

        (stageRows || []).forEach((row: { assigned_worker_id?: string | null; status: string }) => {
          const wid = row.assigned_worker_id;
          if (!wid) return;
          if (!stageCounts[wid]) stageCounts[wid] = { pending: 0, in_progress: 0, completed: 0 };
          const status = (row.status || '').toLowerCase();
          if (status === 'pending') stageCounts[wid].pending++;
          else if (status === 'in_progress') stageCounts[wid].in_progress++;
          else if (status === 'completed') stageCounts[wid].completed++;
        });
      }

      // Ledger: total earnings (all entries) + due balance (unpaid entries only)
      let ledgerRows: Array<{ worker_id: string; amount: number; status?: string }> = [];
      const { data: withStatus, error: errStatus } = await supabase
        .from('worker_ledger_entries')
        .select('worker_id, amount, status')
        .eq('company_id', companyId);
      if (errStatus && (errStatus.code === '42703' || errStatus.message?.includes('status'))) {
        const { data: noStatus } = await supabase
          .from('worker_ledger_entries')
          .select('worker_id, amount')
          .eq('company_id', companyId);
        ledgerRows = (noStatus || []).map((r: any) => ({ ...r, status: 'unpaid' }));
      } else {
        ledgerRows = withStatus || [];
      }

      ledgerRows.forEach((row: { worker_id: string; amount: number; status?: string }) => {
        const wid = row.worker_id;
        const amt = Number(row.amount) || 0;
        totalEarningsByWorker[wid] = (totalEarningsByWorker[wid] || 0) + amt;
        const status = (row.status || '').toLowerCase();
        if (status !== 'paid') {
          dueBalanceByWorker[wid] = (dueBalanceByWorker[wid] || 0) + amt;
        }
      });
    } catch (e: any) {
      if (e?.code !== 'PGRST205' && !e?.message?.includes('Could not find')) throw e;
    }

    return list.map((w) => {
      const id = w.id!;
      const counts = stageCounts[id] || { pending: 0, in_progress: 0, completed: 0 };
      const pendingAmount = dueBalanceByWorker[id] ?? 0;
      const totalEarnings = totalEarningsByWorker[id] || 0;
      return {
        ...w,
        activeJobs: counts.in_progress,
        pendingJobs: counts.pending,
        completedJobs: counts.completed,
        pendingAmount,
        totalEarnings,
      };
    });
  },

  /**
   * Single worker detail with current and recent stages (as jobs) for WorkerDetailPage.
   */
  async getWorkerDetail(companyId: string, workerId: string): Promise<{
    worker: Worker & { activeJobs: number; pendingJobs: number; completedJobs: number; pendingAmount: number; totalEarnings: number };
    currentStages: Array<{
      id: string;
      stage_type: string;
      status: string;
      cost: number;
      expected_completion_date?: string | null;
      completed_at?: string | null;
      production_no?: string;
      sale_id?: string;
      customer_name?: string;
    }>;
    recentCompletedStages: Array<{
      id: string;
      stage_type: string;
      cost: number;
      completed_at?: string | null;
      production_no?: string;
    }>;
  } | null> {
    const withStats = await this.getWorkersWithStats(companyId);
    const worker = withStats.find((w) => w.id === workerId) || null;
    if (!worker) return null;

    const currentStages: Array<{
      id: string;
      stage_type: string;
      status: string;
      cost: number;
      expected_completion_date?: string | null;
      completed_at?: string | null;
      production_no?: string;
      sale_id?: string;
      customer_name?: string;
    }> = [];
    const recentCompletedStages: Array<{
      id: string;
      stage_type: string;
      cost: number;
      completed_at?: string | null;
      production_no?: string;
    }> = [];

    try {
      const { data: prods } = await supabase
        .from('studio_productions')
        .select('id, production_no, sale_id, sale:sales(customer:contacts(name))')
        .eq('company_id', companyId);
      const prodMap = new Map((prods || []).map((p: any) => [p.id, p]));

      const { data: stages } = await supabase
        .from('studio_production_stages')
        .select('id, production_id, stage_type, status, cost, expected_completion_date, completed_at')
        .eq('assigned_worker_id', workerId)
        .in('status', ['pending', 'in_progress', 'completed'])
        .order('created_at', { ascending: false });

      (stages || []).forEach((s: any) => {
        const prod = prodMap.get(s.production_id);
        const productionNo = prod?.production_no;
        const sale = prod?.sale;
        const customerName = sale?.customer?.name;
        const item = {
          id: s.id,
          stage_type: s.stage_type,
          status: s.status,
          cost: Number(s.cost) || 0,
          expected_completion_date: s.expected_completion_date,
          completed_at: s.completed_at,
          production_no: productionNo,
          sale_id: prod?.sale_id,
          customer_name: customerName,
        };
        if (s.status === 'completed') {
          recentCompletedStages.push({
            id: s.id,
            stage_type: s.stage_type,
            cost: item.cost,
            completed_at: s.completed_at,
            production_no: productionNo,
          });
        } else {
          currentStages.push(item);
        }
      });
      recentCompletedStages.sort((a, b) => {
        const da = a.completed_at ? new Date(a.completed_at).getTime() : 0;
        const db = b.completed_at ? new Date(b.completed_at).getTime() : 0;
        return db - da;
      });
      const keepRecent = 10;
      if (recentCompletedStages.length > keepRecent) recentCompletedStages.length = keepRecent;
    } catch (e: any) {
      if (e?.code !== 'PGRST205' && !e?.message?.includes('Could not find')) throw e;
    }

    return {
      worker: {
        ...worker,
        activeJobs: worker.activeJobs,
        pendingJobs: worker.pendingJobs,
        completedJobs: worker.completedJobs,
        pendingAmount: worker.pendingAmount,
        totalEarnings: worker.totalEarnings,
      },
      currentStages,
      recentCompletedStages,
    };
  },

  /**
   * Ledger entries for a worker (Payable / Paid) for "View Full Ledger" on Worker Detail.
   */
  async getWorkerLedgerEntries(companyId: string, workerId: string): Promise<Array<{
    id: string;
    amount: number;
    status: string;
    reference_type: string;
    reference_id: string;
    notes: string | null;
    created_at: string;
    paid_at?: string | null;
  }>> {
    const cols = 'id, amount, reference_type, reference_id, notes, created_at';
    let data: any[] = [];
    const { data: withStatus, error } = await supabase
      .from('worker_ledger_entries')
      .select(`${cols}, status, paid_at`)
      .eq('company_id', companyId)
      .eq('worker_id', workerId)
      .order('created_at', { ascending: false });
    if (error && (error.code === '42703' || error.message?.includes('status') || error.message?.includes('paid_at'))) {
      const { data: fallback } = await supabase
        .from('worker_ledger_entries')
        .select(cols)
        .eq('company_id', companyId)
        .eq('worker_id', workerId)
        .order('created_at', { ascending: false });
      data = (fallback || []).map((r: any) => ({ ...r, status: 'unpaid', paid_at: null }));
    } else if (error) {
      if (error.code === 'PGRST116' || error.message?.includes('does not exist')) return [];
      throw error;
    } else {
      data = withStatus || [];
    }
    return data.map((r: any) => ({
      id: r.id,
      amount: Number(r.amount) || 0,
      status: (r.status || 'unpaid').toLowerCase(),
      reference_type: r.reference_type || '',
      reference_id: r.reference_id || '',
      notes: r.notes ?? null,
      created_at: r.created_at || '',
      paid_at: r.paid_at ?? null,
    }));
  },
};
