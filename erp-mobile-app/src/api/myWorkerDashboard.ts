/**
 * Home + Dashboard metrics scoped to the active worker (created_by).
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { applyCreatedByScope, applySalesBranchFilter, dateRangeEndIso } from '../lib/createdByScope';
import {
  enrichSalesWithPayments,
  enrichSalesWithStudioChargesBatch,
} from './sales';
import { enrichPurchasesPaidFromPayments } from './purchases';

export interface MyWorkerDashboardMetrics {
  revenue: number;
  ordersCount: number;
  receivables: number;
  payables: number;
  paymentsIn: number;
  paymentsOut: number;
  cost: number;
  profit: number;
  salesTrend: { date: string; value: number }[];
  profitTrend: { date: string; value: number }[];
}

export interface MyWorkerDashboardRange {
  fromDate: string;
  toDate: string;
}

const EXPENSE_REF_TYPES = ['expense', 'expense_payment'];

function sumGrandTotal(rows: Array<Record<string, unknown>>): number {
  return rows.reduce((sum, s) => {
    const saleTotal = Number(s.total ?? 0);
    const studio = Number(s.studio_charges ?? 0);
    const grand = Number(s.grand_total ?? saleTotal + studio);
    return sum + grand;
  }, 0);
}

function bucketSalesByDate(rows: Array<Record<string, unknown>>): { date: string; value: number }[] {
  const byDay = new Map<string, number>();
  for (const s of rows) {
    const raw = s.invoice_date;
    const day = raw != null ? String(raw).slice(0, 10) : '';
    if (!day) continue;
    const saleTotal = Number(s.total ?? 0);
    const studio = Number(s.studio_charges ?? 0);
    const grand = Number(s.grand_total ?? saleTotal + studio);
    byDay.set(day, (byDay.get(day) || 0) + grand);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value }));
}

async function fetchUserSalesInRange(
  companyId: string,
  branchId: string | null | undefined,
  authUserId: string,
  profileId: string | null | undefined,
  fromDate: string,
  toDate: string,
  statusFilter: 'final' | 'active',
): Promise<{ data: Array<Record<string, unknown>>; error: string | null }> {
  let query = supabase
    .from('sales')
    .select('id, total, studio_charges, invoice_date, status, created_by, branch_id')
    .eq('company_id', companyId)
    .gte('invoice_date', fromDate)
    .lte('invoice_date', dateRangeEndIso(toDate));

  query = applySalesBranchFilter(query, branchId);
  query = applyCreatedByScope(query, authUserId, profileId);

  if (statusFilter === 'final') {
    query = query.eq('status', 'final');
  } else {
    query = query.neq('status', 'cancelled');
  }

  const { data, error } = await query;
  if (error) return { data: [], error: error.message };
  const list = (data || []) as Array<Record<string, unknown>>;
  const withStudio = await enrichSalesWithStudioChargesBatch(list);
  const enriched = await enrichSalesWithPayments(companyId, withStudio);
  return { data: enriched, error: null };
}

async function fetchUserOrdersCount(
  companyId: string,
  branchId: string | null | undefined,
  authUserId: string,
  profileId: string | null | undefined,
  fromDate: string,
  toDate: string,
): Promise<{ count: number; error: string | null }> {
  let query = supabase
    .from('sales')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .gte('invoice_date', fromDate)
    .lte('invoice_date', dateRangeEndIso(toDate))
    .neq('status', 'cancelled');

  query = applySalesBranchFilter(query, branchId);
  query = applyCreatedByScope(query, authUserId, profileId);

  const { count, error } = await query;
  if (error) return { count: 0, error: error.message };
  return { count: count ?? 0, error: null };
}

async function fetchUserReceivables(
  companyId: string,
  branchId: string | null | undefined,
  authUserId: string,
  profileId: string | null | undefined,
): Promise<{ total: number; error: string | null }> {
  let query = supabase
    .from('sales')
    .select('id, total, studio_charges, status, created_by, branch_id')
    .eq('company_id', companyId)
    .eq('status', 'final');

  query = applySalesBranchFilter(query, branchId);
  query = applyCreatedByScope(query, authUserId, profileId);

  const { data, error } = await query.limit(500);
  if (error) return { total: 0, error: error.message };
  const list = (data || []) as Array<Record<string, unknown>>;
  if (!list.length) return { total: 0, error: null };
  const withStudio = await enrichSalesWithStudioChargesBatch(list);
  const enriched = await enrichSalesWithPayments(companyId, withStudio);
  const total = enriched.reduce((sum, s) => sum + (Number(s.balance_due) || 0), 0);
  return { total, error: null };
}

async function fetchUserPayables(
  companyId: string,
  branchId: string | null | undefined,
  authUserId: string,
  profileId: string | null | undefined,
): Promise<{ total: number; error: string | null }> {
  let query = supabase
    .from('purchases')
    .select('id, total, paid_amount, due_amount, status, created_by, branch_id')
    .eq('company_id', companyId)
    .in('status', ['final', 'received'])
    .is('cancelled_at', null);

  if (branchId && branchId !== 'all' && branchId !== 'default') {
    query = query.eq('branch_id', branchId);
  }
  query = applyCreatedByScope(query, authUserId, profileId);

  const { data, error } = await query.limit(500);
  if (error) return { total: 0, error: error.message };
  const rows = (data || []) as Array<Record<string, unknown>>;
  if (!rows.length) return { total: 0, error: null };
  await enrichPurchasesPaidFromPayments(companyId, rows);
  const total = rows.reduce((sum, r) => sum + (Number(r.due_amount) || 0), 0);
  return { total, error: null };
}

async function fetchUserPaymentsInRange(
  companyId: string,
  branchId: string | null | undefined,
  authUserId: string,
  profileId: string | null | undefined,
  fromDate: string,
  toDate: string,
): Promise<{ paymentsIn: number; paymentsOut: number; error: string | null }> {
  let query = supabase
    .from('payments')
    .select('payment_type, amount, payment_date, created_by, branch_id')
    .eq('company_id', companyId)
    .gte('payment_date', fromDate)
    .lte('payment_date', dateRangeEndIso(toDate))
    .is('voided_at', null);

  if (branchId && branchId !== 'all' && branchId !== 'default') {
    query = query.eq('branch_id', branchId);
  }
  query = applyCreatedByScope(query, authUserId, profileId);

  const { data, error } = await query;
  if (error) return { paymentsIn: 0, paymentsOut: 0, error: error.message };
  let paymentsIn = 0;
  let paymentsOut = 0;
  for (const r of data || []) {
    const amount = Number((r as Record<string, unknown>).amount ?? 0) || 0;
    if (String((r as Record<string, unknown>).payment_type || '').toLowerCase() === 'received') {
      paymentsIn += amount;
    } else {
      paymentsOut += amount;
    }
  }
  return { paymentsIn, paymentsOut, error: null };
}

async function fetchUserCostInRange(
  companyId: string,
  branchId: string | null | undefined,
  authUserId: string,
  profileId: string | null | undefined,
  fromDate: string,
  toDate: string,
): Promise<{ cost: number; error: string | null }> {
  let purchaseQuery = supabase
    .from('purchases')
    .select('total, status, po_date, created_by, branch_id')
    .eq('company_id', companyId)
    .gte('po_date', fromDate)
    .lte('po_date', toDate)
    .in('status', ['final', 'received'])
    .is('cancelled_at', null);

  if (branchId && branchId !== 'all' && branchId !== 'default') {
    purchaseQuery = purchaseQuery.eq('branch_id', branchId);
  }
  purchaseQuery = applyCreatedByScope(purchaseQuery, authUserId, profileId);

  const { data: purchases, error: purchErr } = await purchaseQuery;
  if (purchErr) return { cost: 0, error: purchErr.message };
  let cost = (purchases || []).reduce((sum, r) => sum + (Number((r as Record<string, unknown>).total) || 0), 0);

  let jeQuery = supabase
    .from('journal_entries')
    .select('total_debit, total_credit, entry_date, created_by, branch_id')
    .eq('company_id', companyId)
    .in('reference_type', EXPENSE_REF_TYPES)
    .gte('entry_date', fromDate)
    .lte('entry_date', toDate)
    .or('is_void.is.null,is_void.eq.false');

  if (branchId && branchId !== 'all' && branchId !== 'default') {
    jeQuery = jeQuery.eq('branch_id', branchId);
  }
  jeQuery = applyCreatedByScope(jeQuery, authUserId, profileId);

  const { data: jes, error: jeErr } = await jeQuery.limit(200);
  if (jeErr) return { cost, error: jeErr.message };
  for (const je of jes || []) {
    const row = je as Record<string, unknown>;
    cost += Number(row.total_debit || row.total_credit || 0);
  }
  return { cost, error: null };
}

export async function getMyWorkerDashboardMetrics(
  companyId: string,
  branchId: string | null | undefined,
  authUserId: string,
  profileId: string | null | undefined,
  range: MyWorkerDashboardRange,
): Promise<{ data: MyWorkerDashboardMetrics | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  if (!companyId || !authUserId?.trim()) {
    return { data: null, error: 'Missing company or user.' };
  }

  const { fromDate, toDate } = range;

  const [finalSales, ordersCountRes, receivablesRes, payablesRes, paymentsRes, costRes] = await Promise.all([
    fetchUserSalesInRange(companyId, branchId, authUserId, profileId, fromDate, toDate, 'final'),
    fetchUserOrdersCount(companyId, branchId, authUserId, profileId, fromDate, toDate),
    fetchUserReceivables(companyId, branchId, authUserId, profileId),
    fetchUserPayables(companyId, branchId, authUserId, profileId),
    fetchUserPaymentsInRange(companyId, branchId, authUserId, profileId, fromDate, toDate),
    fetchUserCostInRange(companyId, branchId, authUserId, profileId, fromDate, toDate),
  ]);

  const err =
    finalSales.error ||
    ordersCountRes.error ||
    receivablesRes.error ||
    payablesRes.error ||
    paymentsRes.error ||
    costRes.error;
  if (err) return { data: null, error: err };

  const revenue = sumGrandTotal(finalSales.data);
  const ordersCount = ordersCountRes.count;
  const cost = costRes.cost;
  const profit = revenue - cost;
  const salesTrend = bucketSalesByDate(finalSales.data);
  const profitTrend = salesTrend.map((p) => ({ date: p.date, value: p.value }));

  return {
    data: {
      revenue,
      ordersCount,
      receivables: receivablesRes.total,
      payables: payablesRes.total,
      paymentsIn: paymentsRes.paymentsIn,
      paymentsOut: paymentsRes.paymentsOut,
      cost,
      profit,
      salesTrend,
      profitTrend,
    },
    error: null,
  };
}
