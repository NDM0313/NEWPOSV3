/**
 * Commission report: period-based summary from sales (sale-level capture).
 * Supports branch, salesman, and status (pending/posted) filters.
 * No per-sale ledger clutter; batch posting only via Post Commission action.
 */
import { supabase } from '@/lib/supabase';
import { accountHelperService } from './accountHelperService';
import { accountingService } from './accountingService';
export interface CommissionSaleRow {
  id: string;
  invoice_no: string;
  invoice_date: string;
  salesman_id: string | null;
  commission_amount: number;
  commission_eligible_amount: number | null;
  commission_percent: number | null;
  commission_status: string | null;
  commission_batch_id: string | null;
  total: number;
  customer_name: string;
  branch_id: string | null;
  branch_name: string | null;
}

export interface CommissionSummaryRow {
  salesman_id: string;
  salesman_name: string;
  sale_count: number;
  total_commission: number;
  total_sales_amount: number;
  sales: CommissionSaleRow[];
}

export interface CommissionReportSummaryTotals {
  total_sales: number;
  total_eligible: number;
  total_commission: number;
  posted_commission: number;
  pending_commission: number;
}

export interface CommissionReportResult {
  summary: CommissionSummaryRow[];
  period_start: string;
  period_end: string;
  /** Company-wide totals for the filtered set */
  totals: CommissionReportSummaryTotals;
}

export type CommissionStatusFilter = 'pending' | 'posted' | 'all';

/** Fully Paid Only = only sales with due_amount = 0; Include Due = all sales with commission */
export type PaymentEligibilityFilter = 'fully_paid_only' | 'include_due';

/** Return next calendar day as YYYY-MM-DD so that invoice_date < nextDay includes the full end day (handles timestamp) */
function getNextDay(dateYmd: string): string {
  const d = new Date(dateYmd.slice(0, 10) + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export interface GetCommissionReportOptions {
  branchId?: string | null;
  salesmanId?: string | null;
  status?: CommissionStatusFilter;
  /** When 'fully_paid_only', only sales with due_amount = 0 (or null) are included. Default: include_due so report shows all commission sales. */
  paymentEligibility?: PaymentEligibilityFilter;
}

/**
 * Fetch commission report for a company and date range.
 * Uses sales.salesman_id, commission_amount, commission_status, commission_batch_id.
 */
export async function getCommissionReport(
  companyId: string,
  startDate: string,
  endDate: string,
  options?: GetCommissionReportOptions
): Promise<CommissionReportResult> {
  const start = startDate.slice(0, 10);
  const end = endDate.slice(0, 10);
  const endExclusive = getNextDay(end); // invoice_date < endExclusive so full end day included (timestamp-safe)
  const statusFilter = options?.status ?? 'all';
  const branchId = options?.branchId && options.branchId !== 'all' ? options.branchId : undefined;
  const salesmanIdFilter = options?.salesmanId && options.salesmanId !== 'all' ? options.salesmanId : undefined;
  const paymentEligibility = options?.paymentEligibility ?? 'include_due';

  let query = supabase
    .from('sales')
    .select(`
      id,
      invoice_no,
      invoice_date,
      salesman_id,
      commission_amount,
      commission_eligible_amount,
      commission_percent,
      commission_status,
      commission_batch_id,
      total,
      customer_name,
      branch_id,
      branch:branches(id, name)
    `)
    .eq('company_id', companyId)
    .eq('status', 'final')
    .gte('invoice_date', start)
    .lt('invoice_date', endExclusive)
    .order('invoice_date', { ascending: true });

  if (branchId) query = query.eq('branch_id', branchId);
  if (salesmanIdFilter) query = query.eq('salesman_id', salesmanIdFilter);
  if (statusFilter === 'pending') query = query.or('commission_status.is.null,commission_status.eq.pending');
  if (statusFilter === 'posted') query = query.eq('commission_status', 'posted');
  if (paymentEligibility === 'fully_paid_only') query = query.or('due_amount.lte.0,due_amount.is.null');

  const { data: sales, error } = await query;

  if (error) throw error;

  if (import.meta.env?.DEV && (sales?.length ?? 0) === 0) {
    console.debug('[CommissionReport] No rows from DB', {
      companyId,
      start: startDate.slice(0, 10),
      end: endDate.slice(0, 10),
      branchId: options?.branchId ?? null,
      salesmanId: options?.salesmanId ?? null,
      statusFilter,
      paymentEligibility,
      hint: paymentEligibility === 'fully_paid_only' ? 'Try "Include due sales" if sales have balance due.' : undefined,
    });
  }

  const allRows = (sales || []).map((s: any) => ({
    id: s.id,
    invoice_no: s.invoice_no,
    invoice_date: s.invoice_date ?? '',
    salesman_id: s.salesman_id,
    commission_amount: Number(s.commission_amount) || 0,
    commission_eligible_amount: s.commission_eligible_amount != null ? Number(s.commission_eligible_amount) : null,
    commission_percent: s.commission_percent != null ? Number(s.commission_percent) : null,
    commission_status: s.commission_status ?? 'pending',
    commission_batch_id: s.commission_batch_id ?? null,
    total: Number(s.total) || 0,
    customer_name: s.customer_name || '',
    branch_id: s.branch_id ?? null,
    branch_name: s.branch?.name ?? null,
  })) as CommissionSaleRow[];

  const rows = allRows.filter((r) => (Number(r.commission_amount) || 0) > 0 || r.salesman_id != null);
  const salesmanIds = [...new Set(rows.map((r) => r.salesman_id).filter(Boolean))] as string[];

  let nameByUserId: Record<string, string> = {};
  if (salesmanIds.length > 0) {
    const { data: users } = await supabase
      .from('users')
      .select('id, full_name, email')
      .in('id', salesmanIds);
    (users || []).forEach((u: any) => {
      nameByUserId[u.id] = u.full_name || u.email || 'Unknown';
    });
  }

  let total_sales = 0;
  let total_eligible = 0;
  let total_commission = 0;
  let posted_commission = 0;
  let pending_commission = 0;

  const bySalesman = new Map<string, CommissionSummaryRow>();
  for (const row of rows) {
    total_sales += Number(row.total) || 0;
    total_eligible += Number(row.commission_eligible_amount) || 0;
    const amt = Number(row.commission_amount) || 0;
    total_commission += amt;
    if (row.commission_status === 'posted') posted_commission += amt;
    else pending_commission += amt;

    const sid = row.salesman_id ?? 'unassigned';
    const name = sid === 'unassigned' ? 'Unassigned' : nameByUserId[sid] ?? 'Unknown';
    if (!bySalesman.has(sid)) {
      bySalesman.set(sid, {
        salesman_id: sid,
        salesman_name: name,
        sale_count: 0,
        total_commission: 0,
        total_sales_amount: 0,
        sales: [],
      });
    }
    const rec = bySalesman.get(sid)!;
    rec.sale_count += 1;
    rec.total_commission += amt;
    rec.total_sales_amount += Number(row.total) || 0;
    rec.sales.push(row);
  }

  const summary = Array.from(bySalesman.values()).sort((a, b) => b.total_commission - a.total_commission);

  return {
    summary,
    period_start: start,
    period_end: end,
    totals: {
      total_sales,
      total_eligible,
      total_commission,
      posted_commission,
      pending_commission,
    },
  };
}

/** Ensure Sales Commission Expense (5110 preferred, else 5100) and Salesman Payable (2040) exist; create 2040 if missing. Phase 2: 5100 = Shipping Expense; 5110 = Sales Commission when present. */
async function ensureCommissionAccounts(companyId: string): Promise<{ expenseAccountId: string; payableAccountId: string }> {
  let expense = await accountHelperService.getAccountByCode('5110', companyId);
  if (!expense?.id) expense = await accountHelperService.getAccountByCode('5100', companyId);
  if (!expense?.id) {
    // Auto-create 5110 if missing
    const { accountService } = await import('./accountService');
    const created = await accountService.createAccount({
      company_id: companyId,
      code: '5110',
      name: 'Sales Commission Expense',
      type: 'expense',
      is_active: true,
    });
    expense = created ?? (await accountHelperService.getAccountByCode('5110', companyId));
  }
  if (!expense?.id) throw new Error('Sales Commission Expense account (5110 or 5100) not found and could not be created.');
  let payable = await accountHelperService.getAccountByCode('2040', companyId);
  if (!payable?.id) {
    const { accountService } = await import('./accountService');
    const created = await accountService.createAccount({
      company_id: companyId,
      code: '2040',
      name: 'Salesman Payable',
      type: 'Liability',
      is_active: true,
    });
    payable = created ?? (await accountHelperService.getAccountByCode('2040', companyId));
  }
  if (!payable?.id) throw new Error('Salesman Payable account (2040) not found and could not be created.');
  return { expenseAccountId: expense.id, payableAccountId: payable.id };
}

export interface PostCommissionBatchParams {
  companyId: string;
  branchId?: string | null;
  salesmanId?: string | null;
  startDate: string;
  endDate: string;
  createdBy?: string | null;
  /** Same as report: only post sales that are fully paid when 'fully_paid_only'. Default: fully_paid_only */
  paymentEligibility?: PaymentEligibilityFilter;
}

export interface PostCommissionBatchResult {
  batchId: string;
  batchNo: string;
  journalEntryId: string;
  saleCount: number;
  totalCommission: number;
}

/**
 * Post pending commission for the given filters as one summarized batch.
 * Creates commission_batches row, one JE (Dr 5100 Cr 2040), marks sales as posted.
 */
export async function postCommissionBatch(params: PostCommissionBatchParams): Promise<PostCommissionBatchResult> {
  const { companyId, branchId, salesmanId, startDate, endDate, createdBy, paymentEligibility = 'fully_paid_only' } = params;
  const start = startDate.slice(0, 10);
  const end = endDate.slice(0, 10);
  const endExclusive = getNextDay(end); // full end day included (timestamp-safe)

  let query = supabase
    .from('sales')
    .select('id, commission_amount, branch_id, salesman_id, commission_status')
    .eq('company_id', companyId)
    .eq('status', 'final')
    .gte('invoice_date', start)
    .lt('invoice_date', endExclusive)
    .or('commission_status.is.null,commission_status.eq.pending')
    .gt('commission_amount', 0);

  if (branchId && branchId !== 'all') query = query.eq('branch_id', branchId);
  if (salesmanId && salesmanId !== 'all') query = query.eq('salesman_id', salesmanId);
  if (paymentEligibility === 'fully_paid_only') query = query.or('due_amount.lte.0,due_amount.is.null');

  const { data: pendingSales, error: fetchError } = await query;

  if (fetchError) throw fetchError;
  if (!pendingSales || pendingSales.length === 0) {
    throw new Error('No pending commission found for the selected filters. Only sales with commission_status = pending are posted.');
  }

  const saleIds = pendingSales.map((s: any) => s.id);
  const totalCommission = pendingSales.reduce((sum: number, s: any) => sum + (Number(s.commission_amount) || 0), 0);
  if (totalCommission <= 0) throw new Error('Total commission is zero. Nothing to post.');

  const { expenseAccountId, payableAccountId } = await ensureCommissionAccounts(companyId);

  const { data: existing } = await supabase
    .from('commission_batches')
    .select('batch_no')
    .eq('company_id', companyId)
    .like('batch_no', `COMM-${start}-%`)
    .order('batch_no', { ascending: false })
    .limit(1);
  const nextSeq = existing?.length
    ? (parseInt((existing[0] as any).batch_no?.replace(/^COMM-\d{4}-\d{2}-\d{2}-/, '') || '0', 10) + 1)
    : 1;
  const batchNo = `COMM-${start}-${String(nextSeq).padStart(3, '0')}`;
  const effectiveBranchId = branchId && branchId !== 'all' ? branchId : pendingSales[0]?.branch_id ?? null;
  const firstSalesmanId = pendingSales[0]?.salesman_id ?? null;

  const { data: batch, error: batchError } = await supabase
    .from('commission_batches')
    .insert({
      company_id: companyId,
      branch_id: effectiveBranchId,
      batch_no: batchNo,
      entry_date: end,
      salesman_id: firstSalesmanId,
      total_commission: totalCommission,
      sale_count: pendingSales.length,
      created_by: createdBy ?? null,
    })
    .select('id')
    .single();

  if (batchError) throw batchError;
  if (!batch?.id) throw new Error('Failed to create commission batch');

  const entryNo = `JE-COMM-${batch.id.slice(0, 8)}`;
  const entryDate = end;

  const journalEntry = {
    company_id: companyId,
    branch_id: effectiveBranchId || undefined,
    entry_no: entryNo,
    entry_date: entryDate,
    description: `Commission batch ${batchNo} (${pendingSales.length} sale(s))`,
    reference_type: 'commission_batch',
    reference_id: batch.id,
    created_by: createdBy ?? undefined,
  };

  const lines = [
    { account_id: expenseAccountId, debit: totalCommission, credit: 0, description: `Sales commission batch ${batchNo}` },
    { account_id: payableAccountId, debit: 0, credit: totalCommission, description: `Salesman payable batch ${batchNo}` },
  ];

  const created = await accountingService.createEntry(journalEntry as any, lines as any);
  if (!created?.id) throw new Error('Failed to create commission journal entry');

  await supabase.from('commission_batches').update({ journal_entry_id: created.id }).eq('id', batch.id);

  const { error: updateError } = await supabase
    .from('sales')
    .update({ commission_status: 'posted', commission_batch_id: batch.id })
    .in('id', saleIds)
    .or('commission_status.is.null,commission_status.eq.pending');

  if (updateError) throw updateError;

  // Create worker_ledger_entries per salesman so commission appears in their worker ledger / balance.
  // Group sales by salesman_id and sum commission per person.
  const commissionBySalesman = new Map<string, number>();
  for (const s of pendingSales as { salesman_id: string | null; commission_amount: number }[]) {
    if (!s.salesman_id) continue;
    commissionBySalesman.set(s.salesman_id, (commissionBySalesman.get(s.salesman_id) ?? 0) + (Number(s.commission_amount) || 0));
  }
  // Look up contact_id for each salesman (workers are linked to contacts)
  for (const [salesmanUserId, amount] of commissionBySalesman.entries()) {
    if (amount <= 0) continue;
    try {
      // Find worker contact_id from users table (salesman_id is a users.id)
      const { data: userRow } = await supabase.from('users').select('id, contact_id').eq('id', salesmanUserId).maybeSingle();
      const workerId = (userRow as any)?.contact_id ?? salesmanUserId;
      const { error: ledgerErr } = await supabase.from('worker_ledger_entries').insert({
        company_id: companyId,
        worker_id: workerId,
        amount,
        reference_type: 'commission_batch',
        reference_id: batch.id,
        notes: `Sales commission batch ${batchNo}`,
        document_no: batchNo,
        status: 'unpaid',
      });
      if (ledgerErr) console.warn('[commissionReportService] Worker ledger entry failed:', workerId, ledgerErr.message);
    } catch (e: any) {
      console.warn('[commissionReportService] Worker ledger entry failed for salesman:', salesmanUserId, e?.message);
    }
  }

  if (typeof window !== 'undefined') {
    const uids = new Set<string>();
    for (const s of pendingSales as { salesman_id: string | null }[]) {
      if (s.salesman_id) uids.add(s.salesman_id);
    }
    if (uids.size === 0 && firstSalesmanId) uids.add(firstSalesmanId);
    uids.forEach((entityId) =>
      window.dispatchEvent(new CustomEvent('ledgerUpdated', { detail: { ledgerType: 'user', entityId } }))
    );
  }

  return {
    batchId: batch.id,
    batchNo,
    journalEntryId: created.id,
    saleCount: pendingSales.length,
    totalCommission,
  };
}

export interface RecalculatePendingCommissionsParams {
  companyId: string;
  startDate: string;
  endDate: string;
  branchId?: string | null;
  salesmanId?: string | null;
}

export interface RecalculatePendingCommissionsResult {
  updatedCount: number;
}

/**
 * Recalculate commission_percent and commission_amount for PENDING sales only (commission_batch_id IS NULL).
 * Uses each salesman's current default_commission_percent from users. Posted sales are never changed.
 */
export async function recalculatePendingCommissions(
  params: RecalculatePendingCommissionsParams
): Promise<RecalculatePendingCommissionsResult> {
  const { companyId, startDate, endDate, branchId, salesmanId } = params;
  const start = startDate.slice(0, 10);
  const end = endDate.slice(0, 10);
  const endExclusive = getNextDay(end);

  let query = supabase
    .from('sales')
    .select('id, salesman_id, total, commission_eligible_amount, commission_percent, commission_amount, commission_status, commission_batch_id')
    .eq('company_id', companyId)
    .eq('status', 'final')
    .gte('invoice_date', start)
    .lt('invoice_date', endExclusive)
    .or('commission_status.is.null,commission_status.eq.pending')
    .is('commission_batch_id', null);

  if (branchId && branchId !== 'all') query = query.eq('branch_id', branchId);
  if (salesmanId && salesmanId !== 'all') query = query.eq('salesman_id', salesmanId);

  const { data: sales, error: fetchError } = await query;
  if (fetchError) throw fetchError;
  if (!sales || sales.length === 0) {
    return { updatedCount: 0 };
  }

  const salesmanIds = [...new Set((sales as any[]).map((s) => s.salesman_id).filter(Boolean))] as string[];
  const { data: users } = await supabase
    .from('users')
    .select('id, default_commission_percent')
    .in('id', salesmanIds);
  const pctByUserId: Record<string, number> = {};
  (users || []).forEach((u: any) => {
    const pct = u.default_commission_percent != null ? Number(u.default_commission_percent) : null;
    if (pct != null && pct >= 0) pctByUserId[u.id] = pct;
  });

  let updatedCount = 0;
  for (const sale of sales as any[]) {
    const sid = sale.salesman_id;
    const pct = sid ? pctByUserId[sid] : null;
    if (pct == null) continue;
    const base = Number(sale.commission_eligible_amount) || Number(sale.total) || 0;
    const newAmount = (base * pct) / 100;
    const { error: updateErr } = await supabase
      .from('sales')
      .update({
        commission_percent: pct,
        commission_amount: newAmount,
      })
      .eq('id', sale.id)
      .is('commission_batch_id', null)
      .or('commission_status.is.null,commission_status.eq.pending');
    if (!updateErr) updatedCount += 1;
  }

  return { updatedCount };
}
