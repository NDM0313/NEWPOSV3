/**
 * Commission report: period-based summary from sales (sale-level capture).
 * No dependency on per-sale ledger clutter; scalable and reporting-friendly.
 */
import { supabase } from '@/lib/supabase';

export interface CommissionSaleRow {
  id: string;
  invoice_no: string;
  invoice_date: string;
  salesman_id: string | null;
  commission_amount: number;
  commission_eligible_amount: number | null;
  total: number;
  customer_name: string;
}

export interface CommissionSummaryRow {
  salesman_id: string;
  salesman_name: string;
  sale_count: number;
  total_commission: number;
  total_sales_amount: number;
  sales: CommissionSaleRow[];
}

export interface CommissionReportResult {
  summary: CommissionSummaryRow[];
  period_start: string;
  period_end: string;
}

/**
 * Fetch commission report for a company and date range.
 * Uses sales.salesman_id and sales.commission_amount (sale-level capture).
 */
export async function getCommissionReport(
  companyId: string,
  startDate: string,
  endDate: string
): Promise<CommissionReportResult> {
  const start = startDate.slice(0, 10);
  const end = endDate.slice(0, 10);

  const { data: sales, error } = await supabase
    .from('sales')
    .select('id, invoice_no, invoice_date, salesman_id, commission_amount, commission_eligible_amount, total, customer_name')
    .eq('company_id', companyId)
    .eq('status', 'final')
    .gte('invoice_date', start)
    .lte('invoice_date', end)
    .order('invoice_date', { ascending: true });

  if (error) throw error;

  const allRows = (sales || []) as CommissionSaleRow[];
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

  const bySalesman = new Map<string, CommissionSummaryRow>();
  for (const row of rows) {
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
    rec.total_commission += Number(row.commission_amount) || 0;
    rec.total_sales_amount += Number(row.total) || 0;
    rec.sales.push(row);
  }

  const summary = Array.from(bySalesman.values()).sort((a, b) => b.total_commission - a.total_commission);

  return {
    summary,
    period_start: start,
    period_end: end,
  };
}
