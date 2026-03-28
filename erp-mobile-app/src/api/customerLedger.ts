/**
 * Mobile customer ledger (read-only).
 *
 * **Balances (list + detail card)** — `get_contact_balances_summary` with **`p_branch_id: null` always**
 * (company-wide). Reason: the RPC filters sales/payments by branch when a UUID is passed; invoices with
 * `branch_id` NULL or another branch are excluded, so a branch-scoped total can be ~Rs. 13k while
 * `get_customer_ledger_sales` (no branch filter) still lists full activity — same mismatch users saw vs web
 * Contacts when the web tab uses “All branches”. Web Contacts with a specific branch selected can differ;
 * ledger prioritizes one AR number that matches the full invoice/payment picture.
 *
 * **Activity lines** — `get_customer_ledger_sales` + `payments` (sale / on_account / manual_receipt), voided excluded.
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { normalizeCompanyId } from './contactBalancesUtils';
import { fetchContactBalancesSummary, receivableFromBalanceMap } from './contactBalancesRpc';

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
  reference: string;
  amount: number;
  balanceAfter?: number;
}

const PAYMENT_SALE_CHUNK = 200;

type LedgerSaleRow = {
  id: string;
  invoice_no: string | null;
  invoice_date: string | null;
  total: number;
  shipment_charges?: number;
};

function saleGrossAmount(s: LedgerSaleRow): number {
  const base = Number(s.total) || 0;
  const inv = (s.invoice_no || '').toString().trim().toUpperCase();
  const isStudio = inv.startsWith('STD-') || inv.startsWith('ST-');
  const ship = Number(s.shipment_charges) || 0;
  return isStudio ? base : base + ship;
}

async function fetchLedgerSales(companyId: string, customerId: string): Promise<LedgerSaleRow[]> {
  const rpc = await supabase.rpc('get_customer_ledger_sales', {
    p_company_id: companyId,
    p_customer_id: customerId,
    p_from_date: null,
    p_to_date: null,
  });
  if (!rpc.error && Array.isArray(rpc.data) && rpc.data.length > 0) {
    return (rpc.data as Record<string, unknown>[]).map((row) => ({
      id: String(row.id ?? ''),
      invoice_no: (row.invoice_no as string) || null,
      invoice_date: row.invoice_date != null ? String(row.invoice_date).slice(0, 10) : null,
      total: Number(row.total) || 0,
      shipment_charges: Number(row.shipment_charges) || 0,
    }));
  }

  const { data, error } = await supabase
    .from('sales')
    .select('id, invoice_no, invoice_date, total, shipment_charges, created_at, status')
    .eq('company_id', companyId)
    .eq('customer_id', customerId)
    .order('invoice_date', { ascending: true });
  if (error) {
    if (import.meta.env.DEV) {
      console.warn('[customerLedger] fetchLedgerSales fallback:', error.message);
    }
    return [];
  }
  return (data || [])
    .filter((s: { status?: string }) => String(s.status || '').toLowerCase().trim() === 'final')
    .map((s: Record<string, unknown>) => {
      const inv =
        s.invoice_date != null && String(s.invoice_date).trim() !== ''
          ? String(s.invoice_date).slice(0, 10)
          : s.created_at
            ? new Date(String(s.created_at)).toISOString().slice(0, 10)
            : '';
      return {
        id: String(s.id ?? ''),
        invoice_no: (s.invoice_no as string) || null,
        invoice_date: inv || null,
        total: Number(s.total) || 0,
        shipment_charges: Number(s.shipment_charges) || 0,
      };
    });
}

export async function getCustomerReceivableBalance(
  companyId: string,
  customerId: string
): Promise<{ data: number; error: string | null }> {
  const { map, error } = await fetchContactBalancesSummary(companyId, null);
  if (error) {
    return { data: 0, error };
  }
  return { data: receivableFromBalanceMap(map, customerId), error: null };
}

export async function getCustomersWithBalance(companyId: string): Promise<{ data: CustomerWithBalance[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  const company = normalizeCompanyId(companyId);
  if (!company) return { data: [], error: 'Missing company.' };

  const { data: contacts, error: contactsErr } = await supabase
    .from('contacts')
    .select('id, name, phone')
    .eq('company_id', company)
    .in('type', ['customer', 'both'])
    .order('name');
  if (contactsErr) return { data: [], error: contactsErr.message };
  if (!contacts?.length) return { data: [], error: null };

  const { map, error: rpcErr } = await fetchContactBalancesSummary(company, null);
  if (rpcErr) {
    return {
      data: [],
      error:
        `${rpcErr} If this mentions permission or PGRST301, run SQL: migrations/20260366_grant_execute_get_contact_balances_summary.sql on your database.`,
    };
  }

  const list: CustomerWithBalance[] = (contacts || [])
    .map((c: { id: string; name: string; phone: string | null }) => ({
      id: c.id,
      name: c.name || '',
      phone: c.phone ?? null,
      balance: receivableFromBalanceMap(map, c.id),
    }))
    .filter((c) => c.balance > 0.01);

  return { data: list, error: null };
}

export async function getCustomerLastTransactions(
  companyId: string,
  customerId: string,
  limit = 50
): Promise<{ data: LedgerTransaction[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  const company = normalizeCompanyId(companyId);
  if (!company) return { data: [], error: 'Missing company.' };

  const sales = await fetchLedgerSales(company, customerId);
  const saleIds = sales.map((s) => s.id).filter(Boolean);

  type PayRow = {
    id: string;
    reference_number?: string | null;
    payment_date?: string | null;
    created_at?: string | null;
    amount?: number | null;
    reference_type?: string | null;
  };

  const salePayments: PayRow[] = [];
  for (let i = 0; i < saleIds.length; i += PAYMENT_SALE_CHUNK) {
    const chunk = saleIds.slice(i, i + PAYMENT_SALE_CHUNK);
    const { data: payData } = await supabase
      .from('payments')
      .select('id, reference_number, payment_date, created_at, amount, reference_type')
      .eq('company_id', company)
      .eq('reference_type', 'sale')
      .in('reference_id', chunk)
      .is('voided_at', null);
    salePayments.push(...((payData || []) as PayRow[]));
  }

  const { data: onAccount } = await supabase
    .from('payments')
    .select('id, reference_number, payment_date, created_at, amount, reference_type')
    .eq('company_id', company)
    .eq('contact_id', customerId)
    .eq('reference_type', 'on_account')
    .is('voided_at', null);

  const { data: manualRec } = await supabase
    .from('payments')
    .select('id, reference_number, payment_date, created_at, amount, reference_type')
    .eq('company_id', company)
    .eq('contact_id', customerId)
    .eq('reference_type', 'manual_receipt')
    .is('voided_at', null);

  const tx: LedgerTransaction[] = [];

  const { data: contactOb } = await supabase
    .from('contacts')
    .select('opening_balance')
    .eq('id', customerId)
    .eq('company_id', company)
    .maybeSingle();
  const opening = Math.max(0, Number((contactOb as { opening_balance?: number })?.opening_balance) || 0);
  if (opening > 0.005) {
    let obDate = '1970-01-01';
    if (sales.length > 0 && sales[0].invoice_date) {
      const d = new Date(`${sales[0].invoice_date}T12:00:00`);
      d.setDate(d.getDate() - 1);
      obDate = d.toISOString().slice(0, 10);
    }
    tx.push({
      id: 'opening-balance',
      date: obDate,
      type: 'sale',
      reference: 'Opening Balance',
      amount: opening,
    });
  }

  sales.forEach((s) => {
    tx.push({
      id: `s-${s.id}`,
      date: s.invoice_date || '',
      type: 'sale',
      reference: (s.invoice_no as string) || 'Sale',
      amount: saleGrossAmount(s),
    });
  });

  const payLabel = (p: PayRow) => {
    const num = (p.reference_number || '').toString().trim();
    if (num) return `Payment ${num}`;
    return 'Payment';
  };

  [...salePayments, ...((onAccount || []) as PayRow[]), ...((manualRec || []) as PayRow[])].forEach((p) => {
    tx.push({
      id: `p-${p.id}`,
      date: p.payment_date || p.created_at || '',
      type: 'payment',
      reference: payLabel(p),
      amount: -Number(p.amount || 0),
    });
  });

  tx.sort((a, b) => {
    const db = (b.date || '').slice(0, 10);
    const da = (a.date || '').slice(0, 10);
    const c = db.localeCompare(da);
    if (c !== 0) return c;
    return b.id.localeCompare(a.id);
  });

  return { data: tx.slice(0, limit), error: null };
}
