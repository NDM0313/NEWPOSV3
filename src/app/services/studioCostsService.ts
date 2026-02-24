/**
 * Studio Costs Service
 * Aggregates worker costs, production costs, and ledger entries for Accounting Studio Costs tab.
 * Standard method: Cost of Production (5000) / Worker Payable (2100) accounting.
 */

import { supabase } from '@/lib/supabase';

export interface WorkerCostSummary {
  workerId: string;
  workerName: string;
  workerCode?: string;
  totalCost: number;
  paidAmount: number;
  unpaidAmount: number;
  jobsCount: number;
  ledgerEntries: WorkerLedgerEntry[];
}

export interface WorkerLedgerEntry {
  id: string;
  amount: number;
  status: 'paid' | 'unpaid';
  referenceType: string;
  referenceId: string;
  documentNo: string | null;
  paidAt: string | null;
  paymentReference: string | null;
  stageType?: string;
  productionNo?: string;
  saleInvoice?: string;
  createdAt: string;
}

export interface ProductionCostSummary {
  productionId: string;
  productionNo: string;
  saleId: string | null;
  saleInvoice: string | null;
  customerName: string | null;
  productName: string | null;
  status: string;
  totalStageCost: number;
  actualCost: number;
  stages: StageCostDetail[];
}

export interface StageCostDetail {
  stageId: string;
  stageType: string;
  workerName: string | null;
  workerId: string | null;
  cost: number;
  status: string;
  completedAt: string | null;
  ledgerStatus?: 'paid' | 'unpaid';
  documentNo?: string | null;
}

export interface StudioCostsSummary {
  totalCost: number;
  totalPaid: number;
  totalUnpaid: number;
  workersCount: number;
  productionsCount: number;
  byStageType: { dyer: number; stitching: number; handwork: number };
}

export const studioCostsService = {
  /**
   * Get full studio costs summary for the company.
   */
  async getStudioCostsSummary(companyId: string, branchId?: string | null): Promise<StudioCostsSummary> {
    const workers = await this.getWorkerCostSummaries(companyId, branchId);
    const productions = await this.getProductionCostSummaries(companyId, branchId);

    let totalCost = 0;
    let totalPaid = 0;
    let totalUnpaid = 0;
    const byStageType = { dyer: 0, stitching: 0, handwork: 0 };

    productions.forEach((p) => {
      totalCost += p.totalStageCost;
      p.stages.forEach((s) => {
        const t = (s.stageType || '').toLowerCase();
        if (t === 'dyer') byStageType.dyer += Number(s.cost) || 0;
        else if (t === 'stitching') byStageType.stitching += Number(s.cost) || 0;
        else if (t === 'handwork') byStageType.handwork += Number(s.cost) || 0;
      });
    });

    workers.forEach((w) => {
      totalPaid += w.paidAmount;
      totalUnpaid += w.unpaidAmount;
    });

    return {
      totalCost,
      totalPaid,
      totalUnpaid,
      workersCount: workers.length,
      productionsCount: productions.length,
      byStageType,
    };
  },

  /**
   * Get worker-wise cost breakdown with ledger entries.
   */
  async getWorkerCostSummaries(companyId: string, branchId?: string | null): Promise<WorkerCostSummary[]> {
    const { data: ledgerRows, error } = await supabase
      .from('worker_ledger_entries')
      .select(`
        id, worker_id, amount, status, reference_type, reference_id, document_no, paid_at, payment_reference, created_at
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === 'PGRST116' || error.message?.includes('does not exist')) return [];
      throw error;
    }

    const entries = (ledgerRows || []) as Array<{
      id: string;
      worker_id: string;
      amount: number;
      status?: string;
      reference_type?: string;
      reference_id?: string;
      document_no?: string | null;
      paid_at?: string | null;
      payment_reference?: string | null;
      created_at?: string;
    }>;

    // Enrich with stage/production/sale
    const stageIds = [...new Set(
      entries
        .filter((e) => (e.reference_type || '').toLowerCase() === 'studio_production_stage' && e.reference_id)
        .map((e) => e.reference_id!)
    )];

    const stageMap = new Map<string, { stage_type?: string; production_id?: string }>();
    const prodMap = new Map<string, { production_no?: string; sale_id?: string }>();
    const saleMap = new Map<string, string>();

    if (stageIds.length > 0) {
      const { data: stages } = await supabase
        .from('studio_production_stages')
        .select('id, stage_type, production_id')
        .in('id', stageIds);
      if (stages?.length) {
        (stages as any[]).forEach((s) => stageMap.set(s.id, { stage_type: s.stage_type, production_id: s.production_id }));
        const prodIds = [...new Set((stages as any[]).map((s) => s.production_id).filter(Boolean))];
        const { data: prods } = await supabase
          .from('studio_productions')
          .select('id, production_no, sale_id')
          .in('id', prodIds)
          .eq('company_id', companyId);
        (prods || []).forEach((p: any) => prodMap.set(p.id, { production_no: p.production_no, sale_id: p.sale_id }));
        const saleIds = [...new Set((prods || []).map((p: any) => p.sale_id).filter(Boolean))];
        if (saleIds.length > 0) {
          const { data: sales } = await supabase.from('sales').select('id, invoice_no').in('id', saleIds);
          (sales || []).forEach((s: any) => saleMap.set(s.id, s.invoice_no || ''));
        }
      }
    }

    const workerIds = [...new Set(entries.map((e) => e.worker_id).filter(Boolean))];
    const { data: workers } = await supabase
      .from('workers')
      .select('id, name, code')
      .in('id', workerIds);
    const workerNameMap = new Map<string, { name: string; code?: string }>();
    (workers || []).forEach((w: any) => workerNameMap.set(w.id, { name: w.name || 'Unknown', code: w.code }));

    // Resolve names for worker_ids not in workers table (e.g. contact id when workers sync exists but id = contact id)
    const missingWorkerIds = workerIds.filter((id) => !workerNameMap.has(id));
    if (missingWorkerIds.length > 0) {
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, name')
        .in('id', missingWorkerIds);
      (contacts || []).forEach((c: any) => {
        workerNameMap.set(c.id, { name: c.name || 'Unknown', code: undefined });
      });
    }

    const byWorker = new Map<string, WorkerCostSummary>();
    entries.forEach((e) => {
      const wid = e.worker_id;
      if (!wid) return;
      const amt = Number(e.amount) || 0;
      const status = ((e.status || 'unpaid') as string).toLowerCase() === 'paid' ? 'paid' : 'unpaid';
      const stage = stageMap.get(e.reference_id || '');
      const prod = stage?.production_id ? prodMap.get(stage.production_id) : undefined;
      const saleInvoice = prod?.sale_id ? saleMap.get(prod.sale_id) : undefined;

      const ledgerEntry: WorkerLedgerEntry = {
        id: e.id,
        amount: amt,
        status: status as 'paid' | 'unpaid',
        referenceType: e.reference_type || '',
        referenceId: e.reference_id || '',
        documentNo: e.document_no || null,
        paidAt: e.paid_at || null,
        paymentReference: e.payment_reference || null,
        stageType: stage?.stage_type,
        productionNo: prod?.production_no,
        saleInvoice,
        createdAt: e.created_at || '',
      };

      if (!byWorker.has(wid)) {
        const info = workerNameMap.get(wid) || { name: 'Unknown', code: undefined };
        byWorker.set(wid, {
          workerId: wid,
          workerName: info.name,
          workerCode: info.code,
          totalCost: 0,
          paidAmount: 0,
          unpaidAmount: 0,
          jobsCount: 0,
          ledgerEntries: [],
        });
      }
      const sum = byWorker.get(wid)!;
      sum.totalCost += amt;
      if (status === 'paid') sum.paidAmount += amt;
      else sum.unpaidAmount += amt;
      sum.jobsCount += 1;
      sum.ledgerEntries.push(ledgerEntry);
    });

    let result = Array.from(byWorker.values());

    // Branch filter: productions have branch_id; ledger entries link to stages → productions
    if (branchId && branchId !== 'all') {
      const { data: prodsForBranch } = await supabase
        .from('studio_productions')
        .select('id')
        .eq('company_id', companyId)
        .eq('branch_id', branchId);
      const branchProdIds = new Set((prodsForBranch || []).map((p: any) => p.id));
      const branchStageIds = new Set<string>();
      const { data: allStages } = await supabase
        .from('studio_production_stages')
        .select('id, production_id')
        .in('production_id', Array.from(branchProdIds));
      (allStages || []).forEach((s: any) => branchStageIds.add(s.id));

      result = result.map((w) => {
        const filteredEntries = w.ledgerEntries.filter((e) =>
          e.referenceType === 'studio_production_stage' && e.referenceId && branchStageIds.has(e.referenceId)
        );
        if (filteredEntries.length === 0) return null;
        const paid = filteredEntries.filter((e) => e.status === 'paid').reduce((s, e) => s + e.amount, 0);
        const unpaid = filteredEntries.filter((e) => e.status === 'unpaid').reduce((s, e) => s + e.amount, 0);
        return {
          ...w,
          ledgerEntries: filteredEntries,
          totalCost: paid + unpaid,
          paidAmount: paid,
          unpaidAmount: unpaid,
          jobsCount: filteredEntries.length,
        };
      }).filter(Boolean) as WorkerCostSummary[];
    }

    return result.sort((a, b) => (b.unpaidAmount || 0) - (a.unpaidAmount || 0));
  },

  /**
   * Get production-wise cost breakdown with stages.
   */
  async getProductionCostSummaries(companyId: string, branchId?: string | null): Promise<ProductionCostSummary[]> {
    let query = supabase
      .from('studio_productions')
      .select(`
        id, production_no, sale_id, actual_cost, status,
        product:products(id, name),
        sale:sales(invoice_no, customer:contacts(name))
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (branchId && branchId !== 'all') {
      query = query.eq('branch_id', branchId);
    }

    const { data: prods, error } = await query;
    if (error) {
      if (error.code === 'PGRST116' || error.message?.includes('does not exist')) return [];
      throw error;
    }

    const prodList = (prods || []) as any[];
    if (prodList.length === 0) return [];

    const prodIds = prodList.map((p) => p.id);
    const { data: stages } = await supabase
      .from('studio_production_stages')
      .select(`
        id, production_id, stage_type, assigned_worker_id, cost, status, completed_at,
        worker:workers(id, name)
      `)
      .in('production_id', prodIds);

    const stageList = (stages || []) as any[];
    const stageIds = stageList.map((s) => s.id);

    const missingStageWorkerIds = [...new Set(
      stageList.filter((s) => s.assigned_worker_id && !s.worker?.name).map((s) => s.assigned_worker_id)
    )] as string[];
    const stageWorkerNameById = new Map<string, string>();
    if (missingStageWorkerIds.length > 0) {
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, name')
        .in('id', missingStageWorkerIds);
      (contacts || []).forEach((c: any) => stageWorkerNameById.set(c.id, c.name || 'Unknown'));
    }

    let ledgerMap = new Map<string, { status: string; document_no?: string | null }>();
    if (stageIds.length > 0) {
      const { data: ledgerRows } = await supabase
        .from('worker_ledger_entries')
        .select('reference_id, status, document_no')
        .eq('company_id', companyId)
        .eq('reference_type', 'studio_production_stage')
        .in('reference_id', stageIds);
      (ledgerRows || []).forEach((r: any) => {
        ledgerMap.set(r.reference_id, { status: r.status || 'unpaid', document_no: r.document_no });
      });
    }

    return prodList.map((p) => {
      const prodStages = stageList.filter((s) => s.production_id === p.id);
      const stagesDetail: StageCostDetail[] = prodStages.map((s) => {
        const ledger = ledgerMap.get(s.id);
        const workerName = s.worker?.name || (s.assigned_worker_id ? stageWorkerNameById.get(s.assigned_worker_id) ?? null : null);
        return {
          stageId: s.id,
          stageType: s.stage_type || '',
          workerName: workerName || null,
          workerId: s.assigned_worker_id || null,
          cost: Number(s.cost) || 0,
          status: s.status || 'pending',
          completedAt: s.completed_at || null,
          ledgerStatus: (ledger?.status || 'unpaid').toLowerCase() === 'paid' ? 'paid' : 'unpaid',
          documentNo: ledger?.document_no,
        };
      });
      const totalStageCost = stagesDetail.reduce((sum, s) => sum + s.cost, 0);
      const sale = p.sale;
      return {
        productionId: p.id,
        productionNo: p.production_no || '',
        saleId: p.sale_id || null,
        saleInvoice: sale?.invoice_no || null,
        customerName: sale?.customer?.name || null,
        productName: p.product?.name || null,
        status: p.status || 'draft',
        totalStageCost,
        actualCost: Number(p.actual_cost) || 0,
        stages: stagesDetail,
      };
    });
  },
};
