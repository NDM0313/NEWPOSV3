/**
 * Mobile customer ledger (read-only): balance + last transactions.
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface CustomerWithBalance {
  id: string;
  name: string;
  phone: string | null;
  balance: number; // outstanding (due) – positive = customer owes
}

export interface LedgerTransaction {
  id: string;
  date: string;
  type: 'sale' | 'payment' | 'return';
  reference: string; // invoice no or "Payment"
  amount: number; // sale total (debit) or payment (credit)
  balanceAfter?: number;
}

/** List customers with outstanding balance (due_amount from sales + rentals). */
export async function getCustomersWithBalance(companyId: string): Promise<{ data: CustomerWithBalance[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };

  const { data: contacts, error: contactsErr } = await supabase
    .from('contacts')
    .select('id, name, phone')
    .eq('company_id', companyId)
    .in('type', ['customer', 'both'])
    .order('name');
  if (contactsErr) return { data: [], error: contactsErr.message };
  if (!contacts?.length) return { data: [], error: null };

  const { data: salesDue } = await supabase
    .from('sales')
    .select('customer_id, due_amount')
    .eq('company_id', companyId)
    .eq('status', 'final')
    .gt('due_amount', 0);
  const dueByCustomer: Record<string, number> = {};
  (salesDue || []).forEach((s: { customer_id: string; due_amount: number }) => {
    const id = s.customer_id;
    if (id) dueByCustomer[id] = (dueByCustomer[id] || 0) + Number(s.due_amount || 0);
  });

  const { data: rentalsDue } = await supabase
    .from('rentals')
    .select('customer_id, due_amount')
    .eq('company_id', companyId)
    .gt('due_amount', 0);
  (rentalsDue || []).forEach((r: { customer_id: string; due_amount: number }) => {
    const id = r.customer_id;
    if (id) dueByCustomer[id] = (dueByCustomer[id] || 0) + Number(r.due_amount || 0);
  });

  const list: CustomerWithBalance[] = (contacts || []).map((c: { id: string; name: string; phone: string | null }) => ({
    id: c.id,
    name: c.name || '',
    phone: c.phone ?? null,
    balance: dueByCustomer[c.id] ?? 0,
  }));

  return { data: list, error: null };
}

/** Last N transactions for a customer (sales + payments), read-only. */
export async function getCustomerLastTransactions(
  companyId: string,
  customerId: string,
  limit = 20
): Promise<{ data: LedgerTransaction[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };

  const { data: sales, error: salesErr } = await supabase
    .from('sales')
    .select('id, invoice_no, invoice_date, total, due_amount, paid_amount')
    .eq('company_id', companyId)
    .eq('customer_id', customerId)
    .eq('status', 'final')
    .order('invoice_date', { ascending: false })
    .limit(limit);
  if (salesErr) return { data: [], error: salesErr.message };

  const saleIds = (sales || []).map((s: { id: string }) => s.id);
  let payments: Array<{ id: string; reference_id: string; amount: number; payment_date?: string; created_at?: string }> = [];
  if (saleIds.length > 0) {
    const { data: payData } = await supabase
      .from('payments')
      .select('id, reference_id, amount, payment_date, created_at')
      .eq('reference_type', 'sale')
      .in('reference_id', saleIds)
      .order('payment_date', { ascending: false })
      .limit(limit);
    payments = (payData || []) as typeof payments;
  }

  const tx: LedgerTransaction[] = [];
  (sales || []).forEach((s: { id: string; invoice_no: string; invoice_date: string; total: number }) => {
    tx.push({
      id: `s-${s.id}`,
      date: s.invoice_date,
      type: 'sale',
      reference: (s.invoice_no as string) || 'Sale',
      amount: Number(s.total) || 0,
    });
  });
  payments.forEach((p) => {
    tx.push({
      id: `p-${p.id}`,
      date: p.payment_date || p.created_at || '',
      type: 'payment',
      reference: 'Payment',
      amount: -Number(p.amount || 0),
    });
  });
  tx.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const out = tx.slice(0, limit);
  return { data: out, error: null };
}
