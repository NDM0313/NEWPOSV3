import { supabase, isSupabaseConfigured } from '../lib/supabase';

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
  let query = supabase
    .from('sales')
    .select('total, invoice_date')
    .eq('company_id', companyId)
    .eq('status', 'final')
    .gte('invoice_date', fromStr)
    .in('payment_status', ['paid', 'partial']);
  if (branchId && branchId !== 'all') query = query.eq('branch_id', branchId);
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
    .is('cancelled_at', null);
  if (branchId && branchId !== 'all') query = query.eq('branch_id', branchId);
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
  if (branchId && branchId !== 'all') query = query.eq('branch_id', branchId);
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

/** Total receivables (due from customers) – matches web Dashboard "Total Due (Receivables)" */
export async function getReceivables(
  companyId: string,
  branchId: string | null | undefined
): Promise<{ data: number; error: string | null }> {
  if (!isSupabaseConfigured) return { data: 0, error: 'App not configured.' };
  let query = supabase
    .from('sales')
    .select('due_amount')
    .eq('company_id', companyId)
    .eq('type', 'invoice')
    .eq('status', 'final')
    .in('payment_status', ['partial', 'unpaid']);
  if (branchId && branchId !== 'all') query = query.eq('branch_id', branchId);
  const { data, error } = await query;
  if (error) return { data: 0, error: error.message };
  const total = (data || []).reduce((sum, r) => sum + Number(r.due_amount ?? 0), 0);
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

/** List of sales (invoices) with outstanding receivables – for Receivables report detail. */
export async function getReceivablesList(
  companyId: string,
  branchId: string | null | undefined
): Promise<{ data: ReceivableItem[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  let query = supabase
    .from('sales')
    .select('id, invoice_no, customer_name, invoice_date, total, due_amount, payment_status')
    .eq('company_id', companyId)
    .eq('type', 'invoice')
    .eq('status', 'final')
    .in('payment_status', ['partial', 'unpaid'])
    .gt('due_amount', 0)
    .order('invoice_date', { ascending: false })
    .limit(200);
  if (branchId && branchId !== 'all') query = query.eq('branch_id', branchId);
  const { data, error } = await query;
  if (error) return { data: [], error: error.message };
  return {
    data: (data || []).map((r: Record<string, unknown>) => ({
      id: String(r.id ?? ''),
      invoice_no: String(r.invoice_no ?? '—'),
      customer_name: String(r.customer_name ?? '—'),
      invoice_date: r.invoice_date ? new Date(r.invoice_date as string).toISOString().slice(0, 10) : '—',
      total: Number(r.total) ?? 0,
      due_amount: Number(r.due_amount) ?? 0,
      payment_status: String(r.payment_status ?? 'unpaid'),
    })),
    error: null,
  };
}
