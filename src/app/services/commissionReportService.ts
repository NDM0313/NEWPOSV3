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
  source: 'sale' | 'rental';
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
export type CommissionSourceFilter = 'all' | 'sale' | 'rental';

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
  /** Filter by source: 'all' (default), 'sale', or 'rental' */
  sourceFilter?: CommissionSourceFilter;
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
  const sourceFilter = options?.sourceFilter ?? 'all';

  let allRows: CommissionSaleRow[] = [];

  // ── Sales rows ──
  if (sourceFilter === 'all' || sourceFilter === 'sale') {
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

    const saleRows = (sales || []).map((s: any) => ({
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
      source: 'sale' as const,
    }));
    allRows.push(...saleRows);
  }

  // ── Rental rows ──
  if (sourceFilter === 'all' || sourceFilter === 'rental') {
    // Try full query with commission columns first; fallback to basic if columns don't exist
    let rentals: any[] | null = null;
    let rErr: any = null;

    // Attempt 1: full query with all commission columns
    {
      let rQuery = supabase
        .from('rentals')
        .select(`
          id, booking_no, booking_date, salesman_id,
          commission_amount, commission_eligible_amount, commission_percent,
          commission_status, commission_batch_id,
          rental_charges, customer_name, branch_id, status,
          branch:branches(id, name)
        `)
        .eq('company_id', companyId)
        .neq('status', 'cancelled')
        .gte('booking_date', start)
        .lt('booking_date', endExclusive)
        .not('salesman_id', 'is', null)
        .order('booking_date', { ascending: true });

      if (branchId) rQuery = rQuery.eq('branch_id', branchId);
      if (salesmanIdFilter) rQuery = rQuery.eq('salesman_id', salesmanIdFilter);
      if (statusFilter === 'pending') rQuery = rQuery.or('commission_status.is.null,commission_status.eq.pending');
      if (statusFilter === 'posted') rQuery = rQuery.eq('commission_status', 'posted');

      const result = await rQuery;
      rentals = result.data;
      rErr = result.error;
    }

    // Attempt 2: fallback without commission columns (migration not applied yet)
    if (rErr) {
      console.warn('[CommissionReport] Rental full query failed:', rErr.message, '— trying basic query...');
      let fbQuery = supabase
        .from('rentals')
        .select('id, booking_no, booking_date, customer_name, branch_id, status, rental_charges, salesman_id, branch:branches(id, name)')
        .eq('company_id', companyId)
        .neq('status', 'cancelled')
        .gte('booking_date', start)
        .lt('booking_date', endExclusive)
        .not('salesman_id', 'is', null)
        .order('booking_date', { ascending: true });

      if (branchId) fbQuery = fbQuery.eq('branch_id', branchId);
      if (salesmanIdFilter) fbQuery = fbQuery.eq('salesman_id', salesmanIdFilter);

      const { data: fbData, error: fbErr } = await fbQuery;
      if (fbErr) {
        console.warn('[CommissionReport] Rental basic query also failed:', fbErr.message);
      } else {
        rentals = fbData;
        rErr = null;
      }
    }

    console.log('[CommissionReport] Rental query result:', { rErr: rErr?.message, rentalCount: rentals?.length, firstRental: rentals?.[0] ? { id: rentals[0].id, salesman_id: rentals[0].salesman_id, commission_amount: rentals[0].commission_amount } : null });
    if (!rErr && rentals) {
      const rentalRows = rentals.map((r: any) => ({
        id: r.id,
        invoice_no: r.booking_no || r.id?.slice(0, 8),
        invoice_date: r.booking_date ?? '',
        salesman_id: r.salesman_id,
        commission_amount: Number(r.commission_amount) || 0,
        commission_eligible_amount: r.commission_eligible_amount != null ? Number(r.commission_eligible_amount) : null,
        commission_percent: r.commission_percent != null ? Number(r.commission_percent) : null,
        commission_status: r.commission_status ?? 'pending',
        commission_batch_id: r.commission_batch_id ?? null,
        total: Number(r.rental_charges) || 0,
        customer_name: r.customer_name || '',
        branch_id: r.branch_id ?? null,
        branch_name: (r as any).branch?.name ?? null,
        source: 'rental' as const,
      }));
      allRows.push(...rentalRows);
    }
  }

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
  /** Filter by source: 'all' (default), 'sale', or 'rental' */
  sourceFilter?: CommissionSourceFilter;
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
  const { companyId, branchId, salesmanId, startDate, endDate, createdBy, paymentEligibility = 'fully_paid_only', sourceFilter = 'all' } = params;
  const start = startDate.slice(0, 10);
  const end = endDate.slice(0, 10);
  const endExclusive = getNextDay(end);

  let saleIds: string[] = [];
  let rentalIds: string[] = [];
  const allPending: { salesman_id: string | null; commission_amount: number; branch_id: string | null }[] = [];

  // ── Pending sales ──
  if (sourceFilter === 'all' || sourceFilter === 'sale') {
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
    if (pendingSales?.length) {
      saleIds = pendingSales.map((s: any) => s.id);
      allPending.push(...pendingSales.map((s: any) => ({ salesman_id: s.salesman_id, commission_amount: Number(s.commission_amount) || 0, branch_id: s.branch_id })));
    }
  }

  // ── Pending rentals ──
  if (sourceFilter === 'all' || sourceFilter === 'rental') {
    let rQuery = supabase
      .from('rentals')
      .select('id, commission_amount, branch_id, salesman_id, commission_status')
      .eq('company_id', companyId)
      .neq('status', 'cancelled')
      .gte('booking_date', start)
      .lt('booking_date', endExclusive)
      .or('commission_status.is.null,commission_status.eq.pending')
      .gt('commission_amount', 0);

    if (branchId && branchId !== 'all') rQuery = rQuery.eq('branch_id', branchId);
    if (salesmanId && salesmanId !== 'all') rQuery = rQuery.eq('salesman_id', salesmanId);

    const { data: pendingRentals, error: rErr } = await rQuery;
    if (!rErr && pendingRentals?.length) {
      rentalIds = pendingRentals.map((r: any) => r.id);
      allPending.push(...pendingRentals.map((r: any) => ({ salesman_id: r.salesman_id, commission_amount: Number(r.commission_amount) || 0, branch_id: r.branch_id })));
    }
  }

  if (allPending.length === 0) {
    throw new Error('No pending commission found for the selected filters.');
  }

  const totalCommission = allPending.reduce((sum, s) => sum + s.commission_amount, 0);
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
  const effectiveBranchId = branchId && branchId !== 'all' ? branchId : allPending[0]?.branch_id ?? null;
  const firstSalesmanId = allPending[0]?.salesman_id ?? null;

  const txLabel = saleIds.length > 0 && rentalIds.length > 0
    ? `${saleIds.length} sale(s), ${rentalIds.length} rental(s)`
    : saleIds.length > 0 ? `${saleIds.length} sale(s)` : `${rentalIds.length} rental(s)`;

  const { data: batch, error: batchError } = await supabase
    .from('commission_batches')
    .insert({
      company_id: companyId,
      branch_id: effectiveBranchId,
      batch_no: batchNo,
      entry_date: end,
      salesman_id: firstSalesmanId,
      total_commission: totalCommission,
      sale_count: allPending.length,
      created_by: createdBy ?? null,
    })
    .select('id')
    .single();

  if (batchError) throw batchError;
  if (!batch?.id) throw new Error('Failed to create commission batch');

  const entryNo = `JE-COMM-${batch.id.slice(0, 8)}`;
  const journalEntry = {
    company_id: companyId,
    branch_id: effectiveBranchId || undefined,
    entry_no: entryNo,
    entry_date: end,
    description: `Commission batch ${batchNo} (${txLabel})`,
    reference_type: 'commission_batch',
    reference_id: batch.id,
    created_by: createdBy ?? undefined,
  };

  const lines = [
    { account_id: expenseAccountId, debit: totalCommission, credit: 0, description: `Commission batch ${batchNo}` },
    { account_id: payableAccountId, debit: 0, credit: totalCommission, description: `Salesman payable batch ${batchNo}` },
  ];

  const created = await accountingService.createEntry(journalEntry as any, lines as any);
  if (!created?.id) throw new Error('Failed to create commission journal entry');

  await supabase.from('commission_batches').update({ journal_entry_id: created.id }).eq('id', batch.id);

  // Mark sales as posted
  if (saleIds.length > 0) {
    await supabase
      .from('sales')
      .update({ commission_status: 'posted', commission_batch_id: batch.id })
      .in('id', saleIds)
      .or('commission_status.is.null,commission_status.eq.pending');
  }

  // Mark rentals as posted
  if (rentalIds.length > 0) {
    await supabase
      .from('rentals')
      .update({ commission_status: 'posted', commission_batch_id: batch.id })
      .in('id', rentalIds)
      .or('commission_status.is.null,commission_status.eq.pending');
  }

  // Create worker_ledger_entries per salesman
  const commissionBySalesman = new Map<string, number>();
  for (const s of allPending) {
    if (!s.salesman_id) continue;
    commissionBySalesman.set(s.salesman_id, (commissionBySalesman.get(s.salesman_id) ?? 0) + s.commission_amount);
  }
  for (const [salesmanUserId, amount] of commissionBySalesman.entries()) {
    if (amount <= 0) continue;
    try {
      const { data: userRow } = await supabase.from('users').select('id, contact_id').eq('id', salesmanUserId).maybeSingle();
      const workerId = (userRow as any)?.contact_id ?? salesmanUserId;
      const { error: ledgerErr } = await supabase.from('worker_ledger_entries').insert({
        company_id: companyId,
        worker_id: workerId,
        amount,
        reference_type: 'commission_batch',
        reference_id: batch.id,
        notes: `Commission batch ${batchNo}`,
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
    for (const s of allPending) {
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
    saleCount: allPending.length,
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

  let updatedCount = 0;

  // ── Sales recalculation ──
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

  // Collect all salesman IDs across both sales and rentals
  const allSalesmanIds = new Set<string>();
  (sales || []).forEach((s: any) => { if (s.salesman_id) allSalesmanIds.add(s.salesman_id); });

  // ── Rental recalculation ──
  let rentalRows: any[] = [];
  try {
    let rQuery = supabase
      .from('rentals')
      .select('id, salesman_id, rental_charges, commission_eligible_amount, commission_percent, commission_amount, commission_status, commission_batch_id')
      .eq('company_id', companyId)
      .neq('status', 'cancelled')
      .gte('booking_date', start)
      .lt('booking_date', endExclusive)
      .or('commission_status.is.null,commission_status.eq.pending')
      .is('commission_batch_id', null)
      .not('salesman_id', 'is', null);

    if (branchId && branchId !== 'all') rQuery = rQuery.eq('branch_id', branchId);
    if (salesmanId && salesmanId !== 'all') rQuery = rQuery.eq('salesman_id', salesmanId);

    const { data: rentals, error: rErr } = await rQuery;
    if (!rErr && rentals) {
      rentalRows = rentals;
      rentalRows.forEach((r: any) => { if (r.salesman_id) allSalesmanIds.add(r.salesman_id); });
    }
  } catch { /* columns may not exist yet */ }

  if ((sales?.length || 0) === 0 && rentalRows.length === 0) {
    return { updatedCount: 0 };
  }

  // Fetch commission rates for all salesmen
  const salesmanIdArr = [...allSalesmanIds];
  const { data: users } = await supabase
    .from('users')
    .select('id, default_commission_percent, rental_commission_percent')
    .in('id', salesmanIdArr);
  const salePctByUser: Record<string, number> = {};
  const rentalPctByUser: Record<string, number> = {};
  (users || []).forEach((u: any) => {
    const salePct = u.default_commission_percent != null ? Number(u.default_commission_percent) : null;
    if (salePct != null && salePct >= 0) salePctByUser[u.id] = salePct;
    const rentalPct = u.rental_commission_percent != null ? Number(u.rental_commission_percent) : (salePct != null ? salePct : null);
    if (rentalPct != null && rentalPct >= 0) rentalPctByUser[u.id] = rentalPct;
  });

  // Recalculate sales
  for (const sale of (sales || []) as any[]) {
    const sid = sale.salesman_id;
    const pct = sid ? salePctByUser[sid] : null;
    if (pct == null) continue;
    const base = Number(sale.commission_eligible_amount) || Number(sale.total) || 0;
    const newAmount = (base * pct) / 100;
    const { error: updateErr } = await supabase
      .from('sales')
      .update({ commission_percent: pct, commission_amount: newAmount })
      .eq('id', sale.id)
      .is('commission_batch_id', null)
      .or('commission_status.is.null,commission_status.eq.pending');
    if (!updateErr) updatedCount += 1;
  }

  // Recalculate rentals
  for (const rental of rentalRows) {
    const sid = rental.salesman_id;
    const pct = sid ? rentalPctByUser[sid] : null;
    if (pct == null) continue;
    const base = Number(rental.commission_eligible_amount) || Number(rental.rental_charges) || 0;
    const newAmount = (base * pct) / 100;
    const { error: updateErr } = await supabase
      .from('rentals')
      .update({ commission_percent: pct, commission_amount: newAmount })
      .eq('id', rental.id)
      .is('commission_batch_id', null)
      .or('commission_status.is.null,commission_status.eq.pending');
    if (!updateErr) updatedCount += 1;
  }

  return { updatedCount };
}
