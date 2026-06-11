/**
 * Staff/salesman operational statement (mobile) — mirrors web getUserLedgerData.
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export type StaffStatementRowKind = 'salary' | 'commission_earned' | 'commission_paid';

export interface StaffStatementRow {
  id: string;
  date: string;
  referenceNo: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
  kind: StaffStatementRowKind;
}

export interface StaffStatementResult {
  openingBalance: number;
  closingBalance: number;
  salaryPaid: number;
  commissionEarned: number;
  commissionPaid: number;
  netOwedToUser: number;
  rows: StaffStatementRow[];
}

function effectiveYmd(invoiceDate?: string | null, createdAt?: string | null): string {
  const d = String(invoiceDate || createdAt || '').slice(0, 10);
  return d.length >= 10 ? d : '';
}

export async function getStaffStatement(
  companyId: string,
  userId: string,
  fromDate: string,
  toDate: string,
): Promise<{ data: StaffStatementResult | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };

  type Ev = {
    ts: number;
    date: string;
    ord: number;
    debit: number;
    credit: number;
    ref: string;
    desc: string;
    id: string;
    kind: StaffStatementRowKind;
  };
  const events: Ev[] = [];

  const { data: expenseRows } = await supabase
    .from('expenses')
    .select('id, expense_date, expense_no, amount, status, description, vendor_name, notes')
    .eq('company_id', companyId)
    .eq('paid_to_user_id', userId);

  (expenseRows || []).forEach((row: Record<string, unknown>) => {
    if (String(row.status || '').toLowerCase() !== 'paid') return;
    const amt = Number(row.amount) || 0;
    if (amt <= 0) return;
    const d = String(row.expense_date || '').slice(0, 10);
    if (!d) return;
    events.push({
      ts: new Date(`${d}T12:00:00`).getTime(),
      date: d,
      ord: 0,
      debit: amt,
      credit: 0,
      ref: String(row.expense_no || `EXP-${String(row.id).slice(0, 8)}`),
      desc:
        String(row.description || row.vendor_name || row.notes || 'Salary / expense paid to user').trim() ||
        'Salary paid',
      id: String(row.id),
      kind: 'salary',
    });
  });

  const { data: commSales } = await supabase
    .from('sales')
    .select('id, invoice_no, invoice_date, commission_amount, created_at')
    .eq('company_id', companyId)
    .eq('salesman_id', userId)
    .eq('commission_status', 'posted');

  (commSales || []).forEach((s: Record<string, unknown>) => {
    const amt = Number(s.commission_amount) || 0;
    if (amt <= 0) return;
    const d = effectiveYmd(s.invoice_date as string, s.created_at as string);
    if (!d) return;
    const ref = String(s.invoice_no || `SL-${String(s.id).slice(0, 8)}`);
    events.push({
      ts: new Date(`${d}T12:00:00`).getTime(),
      date: d,
      ord: 1,
      debit: 0,
      credit: amt,
      ref,
      desc: `Commission earned — ${ref}`,
      id: String(s.id),
      kind: 'commission_earned',
    });
  });

  try {
    const { data: commRentals } = await supabase
      .from('rentals')
      .select('id, booking_no, booking_date, commission_amount, created_at')
      .eq('company_id', companyId)
      .eq('salesman_id', userId)
      .eq('commission_status', 'posted');
    (commRentals || []).forEach((r: Record<string, unknown>) => {
      const amt = Number(r.commission_amount) || 0;
      if (amt <= 0) return;
      const d = effectiveYmd(r.booking_date as string, r.created_at as string);
      if (!d) return;
      const ref = String(r.booking_no || `REN-${String(r.id).slice(0, 8)}`);
      events.push({
        ts: new Date(`${d}T12:00:00`).getTime(),
        date: d,
        ord: 1,
        debit: 0,
        credit: amt,
        ref,
        desc: `Commission earned — ${ref}`,
        id: String(r.id),
        kind: 'commission_earned',
      });
    });
  } catch {
    /* rental commission columns optional */
  }

  const { data: commPayPayments } = await supabase
    .from('payments')
    .select('id, reference_number, payment_date, amount, notes, created_at')
    .eq('company_id', companyId)
    .eq('reference_type', 'commission_payment')
    .eq('reference_id', userId);

  (commPayPayments || []).forEach((p: Record<string, unknown>) => {
    const amt = Number(p.amount) || 0;
    if (amt <= 0) return;
    const d = String(p.payment_date || p.created_at || '').slice(0, 10);
    if (!d) return;
    const id = String(p.id);
    events.push({
      ts: new Date(`${d}T12:00:00`).getTime(),
      date: d,
      ord: 2,
      debit: amt,
      credit: 0,
      ref: String(p.reference_number || `PAY-${id.slice(0, 8)}`),
      desc: String(p.notes || '').trim() || `Commission payment — ${id.slice(0, 8)}`,
      id,
      kind: 'commission_paid',
    });
  });

  events.sort((a, b) => a.ts - b.ts || a.ord - b.ord);

  const fromTs = new Date(`${fromDate}T00:00:00`).getTime();
  const toTs = new Date(`${toDate}T23:59:59`).getTime();

  let running = 0;
  for (const e of events) {
    if (e.ts < fromTs) running += e.debit - e.credit;
  }
  const openingBalance = running;

  const rows: StaffStatementRow[] = [];
  let salaryPaid = 0;
  let commissionEarned = 0;
  let commissionPaid = 0;
  running = openingBalance;

  for (const e of events) {
    if (e.ts < fromTs || e.ts > toTs) continue;
    running += e.debit - e.credit;
    if (e.kind === 'salary') salaryPaid += e.debit;
    else if (e.kind === 'commission_earned') commissionEarned += e.credit;
    else if (e.kind === 'commission_paid') commissionPaid += e.debit;
    rows.push({
      id: e.id,
      date: e.date,
      referenceNo: e.ref,
      description: e.desc,
      debit: e.debit,
      credit: e.credit,
      runningBalance: running,
      kind: e.kind,
    });
  }

  return {
    data: {
      openingBalance,
      closingBalance: running,
      salaryPaid,
      commissionEarned,
      commissionPaid,
      netOwedToUser: Math.round((commissionEarned - salaryPaid - commissionPaid) * 100) / 100,
      rows,
    },
    error: null,
  };
}
