/**
 * Studio Costs Service
 *
 * Data source priority:
 *   PRIMARY   → journal_entry_lines (accounting-driven)
 *   FALLBACK  → worker_ledger_entries (legacy)
 *
 * Accounting mapping:
 *   Total Cost   = SUM(debit - credit) for account code '5000' (Cost of Production)
 *   Outstanding  = SUM(credit - debit) for account code '2010' (Worker Payable)
 *   Paid         = Total Cost − Outstanding
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
  /** Indicates whether data came from journal entries (true) or legacy ledger (false) */
  fromJournal?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL: resolve worker names (workers table → contacts fallback)
// ─────────────────────────────────────────────────────────────────────────────
async function resolveWorkerNames(workerIds: string[]): Promise<Map<string, { name: string; code?: string }>> {
  const map = new Map<string, { name: string; code?: string }>();
  if (workerIds.length === 0) return map;

  // workers table has id, name (no code column in schema)
  const { data: workers } = await supabase
    .from('workers')
    .select('id, name')
    .in('id', workerIds);
  (workers || []).forEach((w: any) => map.set(w.id, { name: w.name || 'Unknown', code: undefined }));

  const missing = workerIds.filter((id) => !map.has(id));
  if (missing.length > 0) {
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, name')
      .in('id', missing);
    (contacts || []).forEach((c: any) => map.set(c.id, { name: c.name || 'Unknown' }));
  }
  return map;
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL: fetch account IDs for codes '5000' and '2010'
// ─────────────────────────────────────────────────────────────────────────────
async function getStudioAccountIds(companyId: string): Promise<{ costId: string | null; payableId: string | null }> {
  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, code')
    .eq('company_id', companyId)
    .in('code', ['5000', '2010']);

  const costAccount = (accounts || []).find((a: any) => a.code === '5000');
  const payableAccount = (accounts || []).find((a: any) => a.code === '2010');
  return {
    costId: costAccount?.id ?? null,
    payableId: payableAccount?.id ?? null,
  };
}

export const studioCostsService = {
  // ═══════════════════════════════════════════════════════════════════════════
  // PRIMARY: Journal-driven summary + worker breakdown
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get studio accounting summary directly from journal_entry_lines.
   * Returns null if no journal data exists (caller falls back to legacy).
   */
  async getStudioCostsFromJournal(
    companyId: string,
    branchId?: string | null
  ): Promise<{
    summary: Omit<StudioCostsSummary, 'productionsCount'>;
    workerCosts: WorkerCostSummary[];
    hasData: boolean;
  }> {
    const { costId, payableId } = await getStudioAccountIds(companyId);
    if (!costId && !payableId) {
      return { summary: { totalCost: 0, totalPaid: 0, totalUnpaid: 0, workersCount: 0, byStageType: { dyer: 0, stitching: 0, handwork: 0 }, fromJournal: true }, workerCosts: [], hasData: false };
    }

    // Step 1: Get all journal entry IDs for studio-related entries for this company
    let jeQuery = supabase
      .from('journal_entries')
      .select('id, reference_type, reference_id')
      .eq('company_id', companyId)
      .in('reference_type', [
        'studio_production_stage',
        'studio_production_stage_reversal',
        'payment',
        'manual',
      ]);

    if (branchId && branchId !== 'all') {
      jeQuery = jeQuery.eq('branch_id', branchId);
    }

    const { data: journalEntries, error: jeErr } = await jeQuery;
    if (jeErr || !journalEntries?.length) {
      return { summary: { totalCost: 0, totalPaid: 0, totalUnpaid: 0, workersCount: 0, byStageType: { dyer: 0, stitching: 0, handwork: 0 }, fromJournal: true }, workerCosts: [], hasData: false };
    }

    const allJeIds = journalEntries.map((j: any) => j.id);
    // Stage journal entries only (for worker breakdown)
    const stageJeMap = new Map<string, { referenceId: string; referenceType: string }>();
    journalEntries.forEach((j: any) => {
      if (j.reference_type === 'studio_production_stage' || j.reference_type === 'studio_production_stage_reversal') {
        stageJeMap.set(j.id, { referenceId: j.reference_id, referenceType: j.reference_type });
      }
    });

    // Step 2: Get journal_entry_lines for accounts 5000 + 2010
    const accountFilter: string[] = [];
    if (costId) accountFilter.push(costId);
    if (payableId) accountFilter.push(payableId);

    const { data: lines, error: linesErr } = await supabase
      .from('journal_entry_lines')
      .select('id, journal_entry_id, account_id, debit, credit')
      .in('journal_entry_id', allJeIds)
      .in('account_id', accountFilter);

    if (linesErr || !lines?.length) {
      return { summary: { totalCost: 0, totalPaid: 0, totalUnpaid: 0, workersCount: 0, byStageType: { dyer: 0, stitching: 0, handwork: 0 }, fromJournal: true }, workerCosts: [], hasData: false };
    }

    // Step 3: Aggregate totals
    let costDebit = 0; let costCredit = 0;
    let payableDebit = 0; let payableCredit = 0;

    lines.forEach((l: any) => {
      const d = Number(l.debit) || 0;
      const c = Number(l.credit) || 0;
      if (l.account_id === costId) { costDebit += d; costCredit += c; }
      if (l.account_id === payableId) { payableDebit += d; payableCredit += c; }
    });

    // Net Total Cost (after reversals)
    const totalCost = Math.max(0, costDebit - costCredit);
    // Net Worker Payable (Outstanding) = credit − debit on 2010
    const totalUnpaid = Math.max(0, payableCredit - payableDebit);
    // Paid = Total Cost − Outstanding
    const totalPaid = Math.max(0, totalCost - totalUnpaid);

    // Step 4: Worker breakdown from stage journal entries
    const stageJeIds = Array.from(stageJeMap.keys());
    let workerCosts: WorkerCostSummary[] = [];

    if (stageJeIds.length > 0 && costId) {
      // Get stage lines (Cost of Production debits only — one per completed stage)
      const { data: stageLines } = await supabase
        .from('journal_entry_lines')
        .select('journal_entry_id, debit, credit')
        .in('journal_entry_id', stageJeIds)
        .eq('account_id', costId);

      // Map stageId → { totalDebit, totalCredit }
      const stageCostMap = new Map<string, { debit: number; credit: number }>();
      (stageLines || []).forEach((l: any) => {
        const jeInfo = stageJeMap.get(l.journal_entry_id);
        if (!jeInfo?.referenceId) return;
        const stageId = jeInfo.referenceId;
        const existing = stageCostMap.get(stageId) || { debit: 0, credit: 0 };
        existing.debit += Number(l.debit) || 0;
        existing.credit += Number(l.credit) || 0;
        stageCostMap.set(stageId, existing);
      });

      // Get stage records to find assigned_worker_id + stage_type + production_id
      const stageIds = Array.from(stageCostMap.keys());
      if (stageIds.length > 0) {
        const { data: stages } = await supabase
          .from('studio_production_stages')
          .select('id, assigned_worker_id, stage_type, production_id')
          .in('id', stageIds);

        const stageInfoMap = new Map<string, { workerId: string | null; stageType: string; productionId: string }>();
        (stages || []).forEach((s: any) => {
          stageInfoMap.set(s.id, {
            workerId: s.assigned_worker_id || null,
            stageType: s.stage_type || '',
            productionId: s.production_id || '',
          });
        });

        // Get production → sale invoice map
        const prodIds = [...new Set((stages || []).map((s: any) => s.production_id).filter(Boolean))];
        const prodSaleMap = new Map<string, string | null>();
        const saleInvoiceMap = new Map<string, string>();
        if (prodIds.length > 0) {
          const { data: prods } = await supabase
            .from('studio_productions')
            .select('id, production_no, sale_id')
            .in('id', prodIds);
          (prods || []).forEach((p: any) => {
            prodSaleMap.set(p.id, p.sale_id || null);
          });
          const saleIds = [...new Set((prods || []).map((p: any) => p.sale_id).filter(Boolean))];
          if (saleIds.length > 0) {
            const { data: sales } = await supabase
              .from('sales')
              .select('id, invoice_no')
              .in('id', saleIds);
            (sales || []).forEach((s: any) => saleInvoiceMap.set(s.id, s.invoice_no || ''));
          }
        }

        // Aggregate by worker
        const workerIds = [...new Set(
          Array.from(stageInfoMap.values())
            .map((s) => s.workerId)
            .filter(Boolean) as string[]
        )];
        const workerNameMap = await resolveWorkerNames(workerIds);

        const byWorker = new Map<string, WorkerCostSummary>();

        stageIds.forEach((stageId) => {
          const info = stageInfoMap.get(stageId);
          const costs = stageCostMap.get(stageId);
          if (!info || !costs) return;

          const wid = info.workerId || '__unknown__';
          const netCost = Math.max(0, costs.debit - costs.credit);
          if (netCost <= 0) return; // reversed — skip

          // Look up worker payable lines for THIS stage journal entry to determine paid status
          // We use a simplified heuristic: if net cost > 0 and we have payment debits on 2010 for this company,
          // we distribute the paid status proportionally.
          // For per-stage accuracy, stage ledger entries give us status.

          const prodId = info.productionId;
          const saleId = prodSaleMap.get(prodId) || null;
          const saleInvoice = saleId ? (saleInvoiceMap.get(saleId) || null) : null;

          const ledgerEntry: WorkerLedgerEntry = {
            id: stageId,
            amount: netCost,
            status: 'unpaid', // will be refined below if worker_ledger_entries available
            referenceType: 'studio_production_stage',
            referenceId: stageId,
            documentNo: null,
            paidAt: null,
            paymentReference: null,
            stageType: info.stageType,
            productionNo: undefined,
            saleInvoice: saleInvoice || undefined,
            createdAt: '',
          };

          if (!byWorker.has(wid)) {
            const nameInfo = workerNameMap.get(wid) || { name: 'Unknown' };
            byWorker.set(wid, {
              workerId: wid,
              workerName: nameInfo.name,
              workerCode: nameInfo.code,
              totalCost: 0,
              paidAmount: 0,
              unpaidAmount: 0,
              jobsCount: 0,
              ledgerEntries: [],
            });
          }
          const sum = byWorker.get(wid)!;
          sum.totalCost += netCost;
          sum.unpaidAmount += netCost; // default unpaid; refine below from ledger
          sum.jobsCount += 1;
          sum.ledgerEntries.push(ledgerEntry);
        });

        // Refine paid/unpaid from worker_ledger_entries (if they exist)
        if (stageIds.length > 0) {
          const { data: ledgerRows } = await supabase
            .from('worker_ledger_entries')
            .select('reference_id, status, worker_id, document_no, paid_at, payment_reference')
            .eq('reference_type', 'studio_production_stage')
            .in('reference_id', stageIds);

          const ledgerStatusMap = new Map<string, { status: string; documentNo: string | null; paidAt: string | null; paymentRef: string | null }>();
          (ledgerRows || []).forEach((r: any) => {
            ledgerStatusMap.set(r.reference_id, {
              status: (r.status || 'unpaid').toLowerCase(),
              documentNo: r.document_no || null,
              paidAt: r.paid_at || null,
              paymentRef: r.payment_reference || null,
            });
          });

          byWorker.forEach((workerSum) => {
            let paidTotal = 0;
            let unpaidTotal = 0;
            workerSum.ledgerEntries.forEach((entry) => {
              const ledger = ledgerStatusMap.get(entry.referenceId);
              if (ledger) {
                entry.status = ledger.status === 'paid' ? 'paid' : 'unpaid';
                entry.documentNo = ledger.documentNo;
                entry.paidAt = ledger.paidAt;
                entry.paymentReference = ledger.paymentRef;
              }
              if (entry.status === 'paid') paidTotal += entry.amount;
              else unpaidTotal += entry.amount;
            });
            workerSum.paidAmount = paidTotal;
            workerSum.unpaidAmount = unpaidTotal;
          });
        }

        workerCosts = Array.from(byWorker.values())
          .filter((w) => w.workerId !== '__unknown__')
          .sort((a, b) => b.unpaidAmount - a.unpaidAmount);
      }
    }

    // Stage-type breakdown from journal entries
    const byStageType = { dyer: 0, stitching: 0, handwork: 0 };
    workerCosts.forEach((w) => {
      w.ledgerEntries.forEach((e) => {
        const t = (e.stageType || '').toLowerCase();
        if (t === 'dyer') byStageType.dyer += e.amount;
        else if (t === 'stitching') byStageType.stitching += e.amount;
        else if (t === 'handwork') byStageType.handwork += e.amount;
      });
    });

    return {
      summary: {
        totalCost,
        totalPaid,
        totalUnpaid,
        workersCount: workerCosts.length,
        byStageType,
        fromJournal: true,
      },
      workerCosts,
      hasData: totalCost > 0 || workerCosts.length > 0,
    };
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API (journal-first with legacy fallback)
  // ═══════════════════════════════════════════════════════════════════════════

  async getStudioCostsSummary(companyId: string, branchId?: string | null): Promise<StudioCostsSummary> {
    // Try journal-driven path first
    try {
      const journalResult = await this.getStudioCostsFromJournal(companyId, branchId);
      if (journalResult.hasData) {
        const productions = await this.getProductionCostSummaries(companyId, branchId);
        return {
          ...journalResult.summary,
          productionsCount: productions.length,
          fromJournal: true,
        };
      }
    } catch (e) {
      console.warn('[studioCostsService] Journal path failed, falling back to ledger:', e);
    }

    // Fallback: legacy worker_ledger_entries + stage tables
    return this._getStudioCostsSummaryLegacy(companyId, branchId);
  },

  async getWorkerCostSummaries(companyId: string, branchId?: string | null): Promise<WorkerCostSummary[]> {
    // Try journal-driven path first
    try {
      const journalResult = await this.getStudioCostsFromJournal(companyId, branchId);
      if (journalResult.hasData) {
        return journalResult.workerCosts;
      }
    } catch (e) {
      console.warn('[studioCostsService] Journal worker path failed, falling back to ledger:', e);
    }

    // Fallback
    return this._getWorkerCostSummariesLegacy(companyId, branchId);
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // Production-wise breakdown (always reads from stage tables — accurate)
  // ═══════════════════════════════════════════════════════════════════════════

  async getProductionCostSummaries(companyId: string, branchId?: string | null): Promise<ProductionCostSummary[]> {
    // Avoid PGRST201: do not embed products (two FKs). Select product_id and fetch product names in a second query.
    let query = supabase
      .from('studio_productions')
      .select(`
        id, production_no, sale_id, actual_cost, status, product_id,
        sale:sales(invoice_no)
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

    // Batch fetch product names by product_id (avoids ambiguous product embed).
    const productIds = [...new Set((prodList as any[]).map((p) => p.product_id).filter(Boolean))] as string[];
    const productNameById = new Map<string, string>();
    if (productIds.length > 0) {
      const { data: products } = await supabase.from('products').select('id, name').in('id', productIds);
      (products || []).forEach((p: any) => productNameById.set(p.id, p.name || ''));
    }

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

    const missingWorkerIds = [...new Set(
      stageList.filter((s) => s.assigned_worker_id && !s.worker?.name).map((s) => s.assigned_worker_id)
    )] as string[];
    const stageWorkerNameById = new Map<string, string>();
    if (missingWorkerIds.length > 0) {
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, name')
        .in('id', missingWorkerIds);
      (contacts || []).forEach((c: any) => stageWorkerNameById.set(c.id, c.name || 'Unknown'));
    }

    let ledgerMap = new Map<string, { status: string; document_no?: string | null }>();
    if (stageIds.length > 0) {
      const { data: ledgerRows } = await supabase
        .from('worker_ledger_entries')
        .select('reference_id, status, document_no')
        .eq('reference_type', 'studio_production_stage')
        .in('reference_id', stageIds);
      (ledgerRows || []).forEach((r: any) => {
        ledgerMap.set(r.reference_id, { status: r.status || 'unpaid', document_no: r.document_no });
      });

      // If no ledger entries, try to infer paid status from journal_entry_lines
      // A stage with journal_entry_id + Worker Payable debit (payment) = paid
      if (ledgerMap.size === 0) {
        const { data: stageWithJe } = await supabase
          .from('studio_production_stages')
          .select('id, journal_entry_id')
          .in('id', stageIds)
          .not('journal_entry_id', 'is', null);

        const jeIds = (stageWithJe || []).map((s: any) => s.journal_entry_id).filter(Boolean);
        if (jeIds.length > 0) {
          // Stages with a journal entry are "unpaid" until payment is found
          // We just mark them as unpaid here — accurate payment status requires ledger
        }
      }
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
      const sale = p.sale as { invoice_no?: string } | null;
      return {
        productionId: p.id,
        productionNo: p.production_no || '',
        saleId: p.sale_id || null,
        saleInvoice: sale?.invoice_no || null,
        customerName: null,
        productName: (p.product_id ? productNameById.get(p.product_id) : null) || null,
        status: p.status || 'draft',
        totalStageCost,
        actualCost: Number(p.actual_cost) || 0,
        stages: stagesDetail,
      };
    });
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // LEGACY fallbacks (worker_ledger_entries based)
  // ═══════════════════════════════════════════════════════════════════════════

  async _getStudioCostsSummaryLegacy(companyId: string, branchId?: string | null): Promise<StudioCostsSummary> {
    const workers = await this._getWorkerCostSummariesLegacy(companyId, branchId);
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
      fromJournal: false,
    };
  },

  async _getWorkerCostSummariesLegacy(companyId: string, branchId?: string | null): Promise<WorkerCostSummary[]> {
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

    const stageIds = [...new Set(
      entries
        .filter((e) => (e.reference_type || '').toLowerCase() === 'studio_production_stage' && e.reference_id)
        .map((e) => e.reference_id!)
    )];

    const stageMap = new Map<string, { stage_type?: string; production_id?: string }>();
    const prodMap = new Map<string, { production_no?: string; sale_id?: string }>();
    const saleMap = new Map<string, string>();

    if (stageIds.length > 0) {
      const { data: stagesData } = await supabase
        .from('studio_production_stages')
        .select('id, stage_type, production_id')
        .in('id', stageIds);
      if (stagesData?.length) {
        (stagesData as any[]).forEach((s) => stageMap.set(s.id, { stage_type: s.stage_type, production_id: s.production_id }));
        const prodIds = [...new Set((stagesData as any[]).map((s) => s.production_id).filter(Boolean))];
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
    const workerNameMap = await resolveWorkerNames(workerIds);

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
};
