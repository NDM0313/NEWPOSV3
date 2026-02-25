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

  // Get all studio orders (studio_orders + job_cards when tables exist)
  async getAllStudioOrders(companyId: string, branchId?: string) {
    try {
      let query = supabase
        .from('studio_orders')
        .select(`
          *,
          customer:contacts(name, phone),
          items:studio_order_items(*),
          job_cards:job_cards(*, worker:workers(name, phone)),
          created_by:users(full_name)
        `)
        .eq('company_id', companyId)
        .order('order_date', { ascending: false });

      if (branchId && branchId !== 'all') query = query.eq('branch_id', branchId);

      let { data, error } = await query;
      if (error && (error.code === '42P01' || String(error.message || '').includes('job_cards'))) {
        query = supabase
          .from('studio_orders')
          .select(`*, customer:contacts(name, phone), items:studio_order_items(*), created_by:users(full_name)`)
          .eq('company_id', companyId)
          .order('order_date', { ascending: false });
        if (branchId && branchId !== 'all') query = query.eq('branch_id', branchId);
        const ret = await query;
        data = ret.data;
        error = ret.error;
      }
      if (error && (error.code === 'PGRST205' || error.message?.includes('Could not find the table'))) {
        console.warn('[STUDIO SERVICE] studio_orders table not found, returning empty array');
        return [];
      }
      if (error) throw error;
      return data || [];
    } catch (error: any) {
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

  /**
   * Get workers for studio. Uses contacts (type=worker) as primary source so IDs match
   * studio_production_stages.assigned_worker_id (Studio Sale Detail saves contact id).
   * Merges with workers table for rate/current_balance when sync exists.
   */
  async getAllWorkers(companyId: string): Promise<Worker[]> {
    const result: Worker[] = [];
    const seenIds = new Set<string>();

    try {
      // 1) Load workers table first (for merge: rate, current_balance)
      let workersRows: any[] = [];
      const { data: workersData, error: workersErr } = await supabase
        .from('workers')
        .select('*')
        .eq('company_id', companyId)
        .order('name');
      if (!workersErr && workersData?.length) workersRows = workersData;
      const workersById = new Map(workersRows.map((w: any) => [w.id, w]));

      // 2) Load from contacts (type=worker) – same source as Studio Sale Detail dropdown
      const { data: contactWorkers, error: contactErr } = await supabase
        .from('contacts')
        .select('id, company_id, name, phone, mobile, is_active')
        .eq('company_id', companyId)
        .eq('type', 'worker')
        .order('name');

      const contacts = (contactWorkers || []) as any[];
      if (!contactErr && contacts.length > 0) {
        for (const c of contacts) {
          const id = c.id;
          if (!id || seenIds.has(id)) continue;
          seenIds.add(id);
          const wr = workersById.get(id);
          result.push({
            id,
            company_id: c.company_id,
            name: c.name || '',
            phone: c.phone || c.mobile || undefined,
            worker_type: ((c as any).worker_role || wr?.worker_type || 'General') as Worker['worker_type'],
            rate: wr ? Number(wr.rate) || 0 : 0,
            current_balance: wr ? Number(wr.current_balance) || 0 : 0,
            is_active: c.is_active !== false,
          });
        }
      }

      // 3) Add any workers-table-only rows (legacy) so we don’t drop anyone
      for (const w of workersRows) {
        const id = w.id;
        if (!id || seenIds.has(id)) continue;
        seenIds.add(id);
        result.push({
          id,
          company_id: w.company_id,
          name: w.name || '',
          phone: w.phone || undefined,
          worker_type: (w.worker_type || 'General') as Worker['worker_type'],
          rate: Number(w.rate) || 0,
          current_balance: Number(w.current_balance) || 0,
          is_active: w.is_active !== false,
        });
      }

      result.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      return result;
    } catch (e: any) {
      if (e?.code === 'PGRST205' || e?.message?.includes('Could not find')) {
        console.warn('[STUDIO SERVICE] workers/contacts error, falling back to workers table only', e);
        try {
          const { data, error } = await supabase
            .from('workers')
            .select('*')
            .eq('company_id', companyId)
            .eq('is_active', true)
            .order('name');
          if (!error && data?.length) return data as Worker[];
        } catch (_) {}
      }
      return [];
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

    let stageCounts: Record<string, { assigned: number; in_progress: number; completed: number }> = {};
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
          if (!stageCounts[wid]) stageCounts[wid] = { assigned: 0, in_progress: 0, completed: 0 };
          const status = (row.status || '').toLowerCase();
          // assigned = worker assigned, waiting to start (pendingJobs in UI)
          // in_progress = worker actively working (activeJobs in UI)
          // completed = done
          if (status === 'assigned' || status === 'pending') stageCounts[wid].assigned++;
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

    // Include any worker ID that has stages/ledger but wasn’t in getAllWorkers (e.g. contact id when contacts type=worker empty)
    const listIds = new Set(list.map((w) => w.id).filter(Boolean) as string[]);
    const missingIds = [
      ...Object.keys(stageCounts),
      ...Object.keys(totalEarningsByWorker),
      ...Object.keys(dueBalanceByWorker),
    ].filter((id) => id && !listIds.has(id));
    const uniqueMissing = [...new Set(missingIds)];

    for (const wid of uniqueMissing) {
      const { data: fromWorkers } = await supabase.from('workers').select('*').eq('id', wid).eq('company_id', companyId).maybeSingle();
      if (fromWorkers) {
        list.push({
          id: fromWorkers.id,
          company_id: fromWorkers.company_id,
          name: fromWorkers.name || '',
          phone: fromWorkers.phone || undefined,
          worker_type: (fromWorkers.worker_type || 'General') as Worker['worker_type'],
          rate: Number(fromWorkers.rate) || 0,
          current_balance: Number(fromWorkers.current_balance) || 0,
          is_active: fromWorkers.is_active !== false,
        });
        continue;
      }
      const { data: fromContacts } = await supabase.from('contacts').select('id, company_id, name, phone, mobile, is_active').eq('id', wid).eq('company_id', companyId).maybeSingle();
      if (fromContacts)
        list.push({
          id: fromContacts.id,
          company_id: fromContacts.company_id,
          name: fromContacts.name || '',
          phone: fromContacts.phone || (fromContacts as any).mobile || undefined,
          worker_type: ((fromContacts as any).worker_role || 'General') as Worker['worker_type'],
          rate: 0,
          current_balance: 0,
          is_active: (fromContacts as any).is_active !== false,
        });
    }

    return list.map((w) => {
      const id = w.id!;
      const counts = stageCounts[id] || { assigned: 0, in_progress: 0, completed: 0 };
      const pendingAmount = dueBalanceByWorker[id] ?? 0;
      const totalEarnings = totalEarningsByWorker[id] || 0;
      return {
        ...w,
        activeJobs: counts.assigned + counts.in_progress,
        pendingJobs: counts.assigned,
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
      customer_name?: string;
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
      customer_name?: string;
    }> = [];

    try {
      const { data: prods } = await supabase
        .from('studio_productions')
        .select('id, production_no, sale_id, sale:sales(customer_name, customer:contacts(name))')
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
        const customerName = sale?.customer?.name || sale?.customer_name || undefined;
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
            customer_name: customerName,
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
