import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getAllSales } from './sales';
import { normalizeCompanyId } from './contactBalancesUtils';
import { fetchContactBalancesSummary } from './contactBalancesRpc';

export interface SalesSummary {
  totalSales: number;
  count: number;
  period: string;
}

export async function getSalesSummary(
  companyId: string,
  branchId: string | null | undefined,
  days: number = 30
): Promise<{ data: SalesSummary | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);
  const fromStr = fromDate.toISOString();
  // All final invoices in range (include unpaid/partial) — same basis as web dashboard total sales
  let query = supabase
    .from('sales')
    .select('total, invoice_date')
    .eq('company_id', companyId)
    .eq('status', 'final')
    .gte('invoice_date', fromStr);
  if (branchId && branchId !== 'all' && branchId !== 'default') query = query.eq('branch_id', branchId);
  const { data, error } = await query;
  if (error) return { data: null, error: error.message };
  const totalSales = (data || []).reduce((sum, r) => sum + Number(r.total || 0), 0);
  return {
    data: { totalSales, count: (data || []).length, period: `Last ${days} days` },
    error: null,
  };
}

/** Purchases summary for a period */
export async function getPurchasesSummary(
  companyId: string,
  branchId: string | null | undefined,
  days: number = 30
): Promise<{ data: { totalPurchases: number; count: number } | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);
  const fromStr = fromDate.toISOString();
  let query = supabase
    .from('purchases')
    .select('total')
    .eq('company_id', companyId)
    .gte('po_date', fromStr)
    .is('cancelled_at', null)
    .in('status', ['final', 'received']);
  if (branchId && branchId !== 'all' && branchId !== 'default') query = query.eq('branch_id', branchId);
  const { data, error } = await query;
  if (error) return { data: null, error: error.message };
  const totalPurchases = (data || []).reduce((sum, r) => sum + Number(r.total || 0), 0);
  return {
    data: { totalPurchases, count: (data || []).length },
    error: null,
  };
}

/** List purchases for report (date range) */
export async function getPurchasesForReport(
  companyId: string,
  branchId: string | null | undefined,
  dateFrom: string,
  dateTo: string
): Promise<{ data: { id: string; poNo: string; supplier: string; total: number; date: string; paymentStatus: string }[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  let query = supabase
    .from('purchases')
    .select('id, po_no, supplier_name, total, po_date, payment_status')
    .eq('company_id', companyId)
    .gte('po_date', dateFrom)
    .lte('po_date', dateTo)
    .is('cancelled_at', null)
    .order('po_date', { ascending: false })
    .limit(100);
  if (branchId && branchId !== 'all' && branchId !== 'default') query = query.eq('branch_id', branchId);
  const { data, error } = await query;
  if (error) return { data: [], error: error.message };
  return {
    data: (data || []).map((r: Record<string, unknown>) => ({
      id: String(r.id ?? ''),
      poNo: String(r.po_no ?? `PUR-${String(r.id ?? '').slice(0, 8)}`),
      supplier: String(r.supplier_name ?? '—'),
      total: Number(r.total) || 0,
      date: r.po_date ? new Date(r.po_date as string).toISOString().slice(0, 10) : '—',
      paymentStatus: String(r.payment_status ?? 'unpaid'),
    })),
    error: null,
  };
}

/** Day Book (Roznamcha) – flattened journal entries for date range, chronological order */
export interface DayBookEntry {
  id: string;
  date: string;
  time: string;
  voucher: string;
  account: string;
  description: string;
  debit: number;
  credit: number;
  type: 'Sale' | 'Purchase' | 'Expense' | 'Transfer' | 'Payment' | 'Journal' | 'Rental';
}

function refTypeToDisplayType(ref: string): DayBookEntry['type'] {
  const m: Record<string, DayBookEntry['type']> = {
    sale: 'Sale',
    purchase: 'Purchase',
    payment: 'Payment',
    expense: 'Expense',
    journal: 'Journal',
    rental: 'Rental',
    transfer: 'Transfer',
  };
  return m[ref?.toLowerCase() ?? ''] ?? 'Journal';
}

/** Day Book shows ALL company entries (no branch filter) so web and mobile show same data */
export async function getDayBookEntries(
  companyId: string,
  _branchId: string | null | undefined,
  dateFrom: string,
  dateTo: string
): Promise<{ data: DayBookEntry[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  const { data, error } = await supabase
    .from('journal_entries')
    .select(`
      id, entry_no, entry_date, description, reference_type, created_at,
      lines:journal_entry_lines(id, debit, credit, description, account:accounts(name))
    `)
    .eq('company_id', companyId)
    .gte('entry_date', dateFrom)
    .lte('entry_date', dateTo)
    .order('entry_date', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(500);
  if (error) return { data: [], error: error.message };

  const entries: DayBookEntry[] = [];
  for (const je of data || []) {
    const lines = (je.lines as Array<{ id?: string; debit?: number; credit?: number; description?: string; account?: { name?: string } | null }>) ?? [];
    const createdAt = je.created_at ? new Date(je.created_at as string) : new Date();
    const entryDate = je.entry_date ? new Date(je.entry_date as string) : createdAt;
    const dateStr = entryDate.toISOString().slice(0, 10);
    const timeStr = createdAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    const voucher = String(je.entry_no ?? `JE-${String(je.id ?? '').slice(0, 8)}`);
    const desc = String(je.description ?? '');
    const type = refTypeToDisplayType(String(je.reference_type ?? ''));

    for (const line of lines) {
      const debit = Number(line.debit ?? 0);
      const credit = Number(line.credit ?? 0);
      if (debit === 0 && credit === 0) continue;
      const acc = line.account;
      const accountName = Array.isArray(acc) ? (acc[0] as { name?: string })?.name : (acc as { name?: string } | null)?.name;
      const accountNameStr = accountName ?? 'Unknown Account';
      entries.push({
        id: `${je.id}-${line.id ?? Math.random()}`,
        date: dateStr,
        time: timeStr,
        voucher,
        account: accountNameStr,
        description: line.description ?? desc,
        debit,
        credit,
        type,
      });
    }
  }
  return { data: entries, error: null };
}

function rpcBranchId(branchId: string | null | undefined): string | null {
  if (!branchId || branchId === 'all' || branchId === 'default') return null;
  return branchId;
}

/** Total receivables — same operational basis as web Contacts (`get_contact_balances_summary`). */
export async function getReceivables(
  companyId: string,
  branchId: string | null | undefined
): Promise<{ data: number; error: string | null }> {
  if (!isSupabaseConfigured) return { data: 0, error: 'App not configured.' };
  const company = normalizeCompanyId(companyId);
  if (!company) return { data: 0, error: 'Missing company.' };
  const { map, error } = await fetchContactBalancesSummary(company, rpcBranchId(branchId));
  if (error) return { data: 0, error };
  let total = 0;
  for (const v of map.values()) total += v.receivables;
  return { data: total, error: null };
}

/** Single receivable (sale invoice with due amount) for receivables report list */
export interface ReceivableItem {
  id: string;
  invoice_no: string;
  customer_name: string;
  invoice_date: string;
  total: number;
  due_amount: number;
  payment_status: string;
}

/**
 * Outstanding invoices — uses same payment/studio enrichment as mobile Sales list (not stale sales.due_amount).
 */
export async function getReceivablesList(
  companyId: string,
  branchId: string | null | undefined
): Promise<{ data: ReceivableItem[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  const { data: rows, error } = await getAllSales(companyId, branchId ?? undefined);
  if (error) return { data: [], error };
  const out = (rows || [])
    .filter((r: Record<string, unknown>) => {
      const due = Number(r.balance_due ?? 0);
      const st = String(r.status ?? '').toLowerCase();
      return st === 'final' && due > 0.005;
    })
    .slice(0, 200)
    .map((r: Record<string, unknown>) => {
      const cust = r.customer as { name?: string } | null;
      return {
        id: String(r.id ?? ''),
        invoice_no: String(r.invoice_no ?? '—'),
        customer_name: String(cust?.name ?? r.customer_name ?? '—'),
        invoice_date: r.invoice_date ? new Date(String(r.invoice_date)).toISOString().slice(0, 10) : '—',
        total: Number(r.grand_total ?? r.total ?? 0) || 0,
        due_amount: Number(r.balance_due ?? 0) || 0,
        payment_status:
          Number(r.balance_due ?? 0) <= 0.005
            ? 'paid'
            : Number(r.total_received ?? 0) > 0.005
              ? 'partial'
              : 'unpaid',
      };
    });
  return { data: out, error: null };
}
