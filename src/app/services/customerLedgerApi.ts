/**
 * Customer party views: operational open items (sales/rentals dues + contacts.opening_balance).
 * Not GL journal truth — use account ledger / AR GL slice for journal-based balances.
 * @see docs/accounting/BALANCE_SOURCE_POLICY.md
 */
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/app/utils/formatCurrency';
import type { Customer, Transaction, Invoice, Payment, LedgerData, DetailTransaction } from './customerLedgerTypes';

/** Live = effective customer position; audit = include voided/superseded payment rows (journal history stays full). */
export type CustomerLedgerPaymentScope = 'live' | 'audit';

export interface CustomerLedgerQueryOptions {
  paymentScope?: CustomerLedgerPaymentScope;
  /** Valid UUID branch or null/omitted for company-wide ledger sales (matches `get_customer_ledger_sales` p_branch_id). */
  branchId?: string | null;
}

/** Maps UI branch to RPC `p_branch_id` (all/default → null). */
export function ledgerSalesRpcBranchId(branchId?: string | null): string | null {
  if (branchId == null || branchId === '' || branchId === 'all' || branchId === 'default') return null;
  const t = String(branchId).trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t) ? t : null;
}

function isLiveScope(scope: CustomerLedgerPaymentScope | undefined): boolean {
  return !scope || scope === 'live';
}

function logEffectivePaymentsTrace(payload: Record<string, unknown>) {
  if (process.env.NODE_ENV !== 'production') {
    console.log('[LEDGER_EFFECTIVE_PAYMENTS_TRACE]', JSON.stringify(payload));
  }
}

/** PostgREST `.in()` + RPC arrays: chunk sale IDs when loading payments for a customer. */
const LEDGER_SALE_IDS_CHUNK = 200;

/**
 * Sale-linked payments are filtered by payment_date, but must include all of the customer's final
 * sale IDs — not only sales whose invoice_date falls in the statement range (otherwise payments
 * in-range against older invoices never appear in operational ledger).
 */
async function fetchSaleLinkedPaymentsInDateRange(
  companyId: string,
  saleIds: string[],
  fromDate?: string,
  toDate?: string,
  scope: CustomerLedgerPaymentScope = 'live'
): Promise<any[]> {
  const out: any[] = [];
  const seen = new Set<string>();
  if (saleIds.length === 0) return out;

  for (let i = 0; i < saleIds.length; i += LEDGER_SALE_IDS_CHUNK) {
    const chunk = saleIds.slice(i, i + LEDGER_SALE_IDS_CHUNK);
    let rows: any[] = [];
    const rpc = await supabase.rpc('get_customer_ledger_payments', {
      p_company_id: companyId,
      p_sale_ids: chunk,
      p_from_date: fromDate || null,
      p_to_date: toDate || null,
      p_include_voided: scope === 'audit',
    });
    if (!rpc.error) {
      rows = rpc.data ?? [];
    } else {
      let q = supabase
        .from('payments')
        .select(
          'id, reference_number, payment_date, amount, payment_method, notes, reference_id, payment_account_id, voided_at, reference_type'
        )
        .eq('company_id', companyId)
        .eq('reference_type', 'sale')
        .in('reference_id', chunk);
      if (isLiveScope(scope)) q = q.is('voided_at', null);
      if (fromDate) q = q.gte('payment_date', fromDate);
      if (toDate) q = q.lte('payment_date', toDate);
      const payResult = await q.order('payment_date', { ascending: false });
      if (payResult.error) {
        console.error('[CUSTOMER LEDGER API] fetchSaleLinkedPaymentsInDateRange fallback:', payResult.error);
      } else {
        rows = payResult.data ?? [];
      }
    }
    for (const p of rows) {
      const id = String((p as any).id ?? '');
      if (id && !seen.has(id)) {
        seen.add(id);
        out.push({ ...(p as any), reference_type: (p as any).reference_type || 'sale' });
      }
    }
  }
  return out;
}

async function sumSaleLinkedPaymentsInDateRange(
  companyId: string,
  saleIds: string[],
  fromDate?: string,
  toDate?: string,
  scope: CustomerLedgerPaymentScope = 'live'
): Promise<number> {
  let sum = 0;
  if (saleIds.length === 0) return 0;
  for (let i = 0; i < saleIds.length; i += LEDGER_SALE_IDS_CHUNK) {
    const chunk = saleIds.slice(i, i + LEDGER_SALE_IDS_CHUNK);
    const rpc = await supabase.rpc('get_customer_ledger_payments', {
      p_company_id: companyId,
      p_sale_ids: chunk,
      p_from_date: fromDate || null,
      p_to_date: toDate || null,
      p_include_voided: scope === 'audit',
    });
    if (!rpc.error) {
      sum += (rpc.data ?? []).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
      continue;
    }
    let q = supabase
      .from('payments')
      .select('amount')
      .eq('company_id', companyId)
      .eq('reference_type', 'sale')
      .in('reference_id', chunk);
    if (isLiveScope(scope)) q = q.is('voided_at', null);
    if (fromDate) q = q.gte('payment_date', fromDate);
    if (toDate) q = q.lte('payment_date', toDate);
    const { data, error } = await q;
    if (error) {
      console.error('[CUSTOMER LEDGER API] sumSaleLinkedPaymentsInDateRange fallback:', error);
      continue;
    }
    sum += (data || []).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
  }
  return sum;
}

/** On-account + manual_receipt credits for contact in date range (operational ledger). */
async function sumOnAccountAndManualReceiptPaymentsInDateRange(
  companyId: string,
  contactId: string,
  fromDate?: string,
  toDate?: string,
  scope: CustomerLedgerPaymentScope = 'live'
): Promise<number> {
  let q = supabase
    .from('payments')
    .select('amount')
    .eq('company_id', companyId)
    .eq('contact_id', contactId)
    .in('reference_type', ['on_account', 'manual_receipt']);
  if (isLiveScope(scope)) q = q.is('voided_at', null);
  if (fromDate) q = q.gte('payment_date', fromDate);
  if (toDate) q = q.lte('payment_date', toDate);
  const { data, error } = await q;
  if (error) {
    console.error('[CUSTOMER LEDGER API] sumOnAccountAndManualReceiptPaymentsInDateRange:', error);
    return 0;
  }
  return (data || []).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
}

async function enrichCustomerLedgerPaymentTransactions(
  _companyId: string,
  transactions: Transaction[],
  paymentsBundle: any[],
  invoiceNoBySaleId: Map<string, string>
): Promise<void> {
  logEffectivePaymentsTrace({ phase: 'enrich_start', paymentsCount: paymentsBundle.length, transactions: transactions.length });
  const byPayId = new Map<string, any>();
  for (const p of paymentsBundle) {
    if (p?.id) byPayId.set(String(p.id), p);
  }
  const accountIds = [...new Set(paymentsBundle.map((p) => p.payment_account_id).filter(Boolean))] as string[];
  const accountById = new Map<string, string>();
  if (accountIds.length > 0) {
    const { data: accs } = await supabase.from('accounts').select('id, name').in('id', accountIds);
    (accs || []).forEach((a: any) => accountById.set(String(a.id), String(a.name || '').trim() || 'Account'));
  }
  const manualIds = paymentsBundle.filter((p) => String(p.reference_type || '').toLowerCase() === 'manual_receipt').map((p) => String(p.id));
  const allocByPayment = new Map<string, { invoiceNo: string; amount: number }[]>();
  if (manualIds.length > 0) {
    const { data: allocs } = await supabase
      .from('payment_allocations')
      .select('payment_id, allocated_amount, sale_id')
      .in('payment_id', manualIds);
    const saleIds = [...new Set((allocs || []).map((a: any) => a.sale_id).filter(Boolean))] as string[];
    const invBySale = new Map(invoiceNoBySaleId);
    if (saleIds.length > 0) {
      const { data: sales } = await supabase.from('sales').select('id, invoice_no').in('id', saleIds);
      (sales || []).forEach((s: any) => invBySale.set(String(s.id), String(s.invoice_no || '').trim()));
    }
    for (const a of allocs || []) {
      const pid = String((a as any).payment_id);
      const list = allocByPayment.get(pid) || [];
      const inv = invBySale.get(String((a as any).sale_id)) || String((a as any).sale_id).slice(0, 8);
      list.push({ invoiceNo: inv, amount: Number((a as any).allocated_amount) || 0 });
      allocByPayment.set(pid, list);
    }
  }

  for (const t of transactions) {
    if (t.credit <= 0) continue;
    if (
      t.documentType !== 'Payment' &&
      t.documentType !== 'On-account Payment' &&
      t.documentType !== 'Return Payment'
    ) {
      continue;
    }
    const pr = byPayId.get(String(t.id));
    if (!pr) continue;
    const method = String(pr.payment_method || 'other').toLowerCase();
    const accName = pr.payment_account_id ? accountById.get(String(pr.payment_account_id)) : undefined;
    t.paymentMethodKind = method;
    t.paymentAccountDisplay = accName || method;
    t.paymentAccount = accName ? `${accName} (${method})` : method;
    const voided = pr.voided_at != null && String(pr.voided_at).length > 0;
    t.ledgerPaymentLifecycle = voided ? 'voided' : 'active';
    if (String(pr.reference_type || '').toLowerCase() !== 'manual_receipt') continue;
    const total = Number(pr.amount) || 0;
    const allocs = allocByPayment.get(String(pr.id)) || [];
    const allocSum = allocs.reduce((s, x) => s + x.amount, 0);
    const unapplied = Math.max(0, Math.round((total - allocSum) * 100) / 100);
    const expand: NonNullable<Transaction['ledgerExpandRows']> = [];
    for (const x of allocs) {
      expand.push({
        label: `Allocated — ${x.invoiceNo}`,
        sublabel: 'Manual receipt allocation',
        amount: x.amount,
      });
    }
    if (unapplied > 0.02) {
      expand.push({
        label: 'Unapplied customer credit',
        sublabel: 'Not yet matched to open invoices',
        amount: unapplied,
      });
    }
    if (expand.length > 0) t.ledgerExpandRows = expand;
    if (process.env.NODE_ENV !== 'production') {
      console.log(
        '[PAYMENT_ALLOCATION_LIVE_TRACE]',
        JSON.stringify({
          payment_id: pr.id,
          status: t.ledgerPaymentLifecycle || 'active',
          account: t.paymentAccountDisplay || t.paymentAccount,
          allocated_lines: allocs.length,
          allocated_total: allocSum,
          unapplied,
        })
      );
    }
  }
}

/** Aligns with get_contact_balances_summary: customer receivable seed (non-negative). */
async function getContactReceivableOpeningSeed(companyId: string, contactId: string): Promise<number> {
  const { data } = await supabase
    .from('contacts')
    .select('opening_balance')
    .eq('id', contactId)
    .eq('company_id', companyId)
    .maybeSingle();
  return Math.max(0, Number((data as { opening_balance?: number })?.opening_balance) || 0);
}

/** YMD for range checks when invoice_date is null (use created_at). */
function effectiveSaleDateYmd(s: { invoice_date?: unknown; created_at?: unknown }): string {
  const inv = s.invoice_date;
  if (inv != null && String(inv).trim() !== '') {
    return String(inv).slice(0, 10);
  }
  const c = s.created_at;
  if (!c) return '';
  if (typeof c === 'string' && c.length >= 10) return c.slice(0, 10);
  const t = new Date(c as string).getTime();
  if (Number.isNaN(t)) return '';
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * Direct-query merge: picks up final sales with NULL invoice_date when created_at falls in range.
 * Prefer fetchCustomerLedgerSalesForRange (RPC + wide fallback) for the main set.
 */
async function mergeSalesWithNullInvoiceDateInRange(
  companyId: string,
  cId: string,
  sales: any[],
  fromDate?: string,
  toDate?: string
): Promise<any[]> {
  if (!fromDate && !toDate) return [...(sales || [])];
  const byId = new Map((sales || []).map((s: any) => [s.id, { ...s }]));
  let data: any[] | null = null;
  let error: { message?: string } | null = null;
  const fullSelect =
    'id, invoice_no, invoice_date, total, paid_amount, due_amount, payment_status, status, created_at, shipment_charges, discount_amount, tax_amount, expenses';
  const minimalSelect =
    'id, invoice_no, invoice_date, total, paid_amount, due_amount, payment_status, status, created_at';
  let res = await supabase
    .from('sales')
    .select(fullSelect)
    .eq('company_id', companyId)
    .eq('customer_id', cId)
    .is('invoice_date', null);
  if (res.error && (res.error.code === '42703' || String(res.error.message || '').includes('column'))) {
    res = await supabase
      .from('sales')
      .select(minimalSelect)
      .eq('company_id', companyId)
      .eq('customer_id', cId)
      .is('invoice_date', null);
  }
  data = res.data;
  error = res.error;
  if (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[LEDGER] mergeSalesWithNullInvoiceDateInRange:', error.message);
    }
    return Array.from(byId.values());
  }
  for (const s of (data || []).filter(
    (row: any) => String(row.status || '').toLowerCase().trim() === 'final'
  )) {
    if (byId.has(s.id)) continue;
    const d = effectiveSaleDateYmd(s);
    if (!d) continue;
    if (fromDate && d < fromDate) continue;
    if (toDate && d > toDate) continue;
    byId.set(s.id, { ...s, invoice_date: d });
  }
  return Array.from(byId.values());
}

/**
 * Final sales for customer operational ledger — aligned with get_contact_balances_summary (case-insensitive final).
 * Prefer SECURITY DEFINER RPC; if a dated RPC returns zero rows but a range was requested, wide-fetch all finals and filter by effective date in JS (stale DB predicates on raw invoice_date only).
 */
/** Exported for accountingService / GL merge paths — same operational sales set as customer statements. */
export async function fetchCustomerLedgerSalesForRange(
  companyId: string,
  cId: string,
  fromDate?: string,
  toDate?: string,
  branchId?: string | null
): Promise<any[]> {
  const pBranch = ledgerSalesRpcBranchId(branchId);
  const rpcDated = await supabase.rpc('get_customer_ledger_sales', {
    p_company_id: companyId,
    p_customer_id: cId,
    p_from_date: fromDate ?? null,
    p_to_date: toDate ?? null,
    p_branch_id: pBranch,
  });

  let sales: any[] = [];

  if (!rpcDated.error) {
    sales = rpcDated.data ?? [];
    const hasRange = Boolean(fromDate || toDate);
    if (sales.length === 0 && hasRange) {
      const wide = await supabase.rpc('get_customer_ledger_sales', {
        p_company_id: companyId,
        p_customer_id: cId,
        p_from_date: null,
        p_to_date: null,
        p_branch_id: pBranch,
      });
      if (!wide.error && (wide.data?.length ?? 0) > 0) {
        const filtered = (wide.data as any[]).filter((row) => {
          const ymd = effectiveSaleDateYmd(row);
          if (!ymd) return false;
          if (fromDate && ymd < fromDate) return false;
          if (toDate && ymd > toDate) return false;
          return true;
        });
        if (filtered.length > 0) {
          sales = filtered;
          if (process.env.NODE_ENV !== 'production') {
            console.warn(
              '[LEDGER] Dated get_customer_ledger_sales returned 0 rows; recovered via wide RPC + client date filter.',
              { companyId, customerId: cId, fromDate, toDate, recovered: filtered.length }
            );
          }
        }
      }
    }
  } else {
    let salesQuery = supabase
      .from('sales')
      .select(
        'id, invoice_no, invoice_date, total, paid_amount, due_amount, payment_status, shipment_charges, created_at, discount_amount, tax_amount, expenses, status'
      )
      .eq('company_id', companyId)
      .eq('customer_id', cId);
    if (pBranch) salesQuery = salesQuery.eq('branch_id', pBranch);
    if (fromDate) salesQuery = salesQuery.gte('invoice_date', fromDate);
    if (toDate) salesQuery = salesQuery.lte('invoice_date', toDate);
    const result = await salesQuery.order('invoice_date', { ascending: false });
    if (result.error) {
      console.error('[CUSTOMER LEDGER API] fetchCustomerLedgerSalesForRange fallback:', result.error, rpcDated.error);
    }
    sales = (result.data || []).filter(
      (s: any) => String(s.status || '').toLowerCase().trim() === 'final'
    );
    if (result.error && sales.length === 0) {
      let retryQuery = supabase
        .from('sales')
        .select(
          'id, invoice_no, invoice_date, total, paid_amount, due_amount, shipment_charges, created_at, discount_amount, tax_amount, expenses, status'
        )
        .eq('company_id', companyId)
        .eq('customer_id', cId);
      if (pBranch) retryQuery = retryQuery.eq('branch_id', pBranch);
      if (fromDate) retryQuery = retryQuery.gte('invoice_date', fromDate);
      if (toDate) retryQuery = retryQuery.lte('invoice_date', toDate);
      const retry = await retryQuery.order('invoice_date', { ascending: false });
      if (!retry.error) {
        sales = (retry.data || []).filter(
          (s: any) => String(s.status || '').toLowerCase().trim() === 'final'
        );
      }
    }
  }

  return mergeSalesWithNullInvoiceDateInRange(companyId, cId, sales, fromDate, toDate);
}

/** One-line description: invoice + discount / tax / extra / shipping (amounts are informational; total is authoritative). */
function describeCustomerSaleLedgerLine(sale: any, isStudioSale: boolean): string {
  const inv = sale.invoice_no || '';
  const head = isStudioSale ? `Studio Sale ${inv}` : `Sale Invoice ${inv}`;
  const bits: string[] = [];
  const disc = Number(sale.discount_amount);
  if (disc > 0) bits.push(`discount ${disc}`);
  const tax = Number(sale.tax_amount);
  if (tax > 0) bits.push(`tax ${tax}`);
  const extra = Number(sale.expenses);
  if (extra > 0) bits.push(`extra ${extra}`);
  const ship = Number(sale.shipment_charges);
  if (!isStudioSale && ship > 0) bits.push(`shipping ${ship}`);
  if (bits.length === 0) return head;
  return `${head} — ${bits.join(', ')}`;
}

function saleLedgerBreakdownChildren(sale: any, isStudioSale: boolean): DetailTransaction['children'] | undefined {
  const rows: NonNullable<DetailTransaction['children']> = [];
  const disc = Number(sale.discount_amount);
  if (disc > 0) rows.push({ type: 'Discount', description: 'Invoice discount', amount: disc });
  const tax = Number(sale.tax_amount);
  if (tax > 0) rows.push({ type: 'Extra Charge', description: 'Tax', amount: tax });
  const ex = Number(sale.expenses);
  if (ex > 0) rows.push({ type: 'Extra Charge', description: 'Extra / other charges', amount: ex });
  const ship = Number(sale.shipment_charges);
  if (!isStudioSale && ship > 0) {
    rows.push({ type: 'Extra Charge', description: 'Shipping (in receivable)', amount: ship });
  }
  return rows.length ? rows : undefined;
}

/** Gross receivable for one sale row (studio extra charges + shipment on regular sales). */
function saleGrossForLedger(s: any, studioChargesBySaleId: Map<string, number>): number {
  const base = Number(s.total) || 0;
  const inv = (s.invoice_no || '').toString().trim().toUpperCase();
  const isStudio = inv.startsWith('STD-') || inv.startsWith('ST-');
  const studioCharges = isStudio ? studioChargesBySaleId.get(s.id) || 0 : 0;
  const ship = Number(s.shipment_charges) || 0;
  return isStudio ? base + studioCharges : base + ship;
}

export interface CustomerLedgerSummary {
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  totalInvoices: number;
  totalInvoiceAmount: number;
  totalPaymentReceived: number;
  pendingAmount: number;
  fullyPaid: number;
  partiallyPaid: number;
  unpaid: number;
}

export interface AgingReport {
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  days90plus: number;
  total: number;
}

export const customerLedgerAPI = {
  /**
   * Get all customers for ledger (company_id only).
   * No is_system_generated or created_by filter — walk-in must be included so ledger shows all walk-in sales.
   */
  async getCustomers(companyId: string): Promise<Customer[]> {
    const { data, error } = await supabase
      .from('contacts')
      .select('id, name, code, phone, city, email, address, credit_limit, opening_balance')
      .eq('company_id', companyId)
      .in('type', ['customer', 'both'])
      .order('name');

    if (error) throw error;

    // Calculate outstanding balance from sales + rentals (includes walk-in)
    const { data: sales } = await supabase
      .from('sales')
      .select('customer_id, due_amount')
      .eq('company_id', companyId)
      .eq('status', 'final')
      .gt('due_amount', 0);

    const { data: rentals } = await supabase
      .from('rentals')
      .select('customer_id, due_amount')
      .eq('company_id', companyId)
      .gt('due_amount', 0);

    const customerDueMap = new Map<string, number>();
    (sales || []).forEach((sale: any) => {
      const current = customerDueMap.get(sale.customer_id) || 0;
      customerDueMap.set(sale.customer_id, current + (sale.due_amount || 0));
    });
    (rentals || []).forEach((r: any) => {
      if (r.customer_id) {
        const current = customerDueMap.get(r.customer_id) || 0;
        customerDueMap.set(r.customer_id, current + (r.due_amount || 0));
      }
    });

    return (data || []).map((c: any) => ({
      id: c.id,
      code: c.code != null && String(c.code).trim() !== '' ? String(c.code).trim() : '—',
      name: c.name || '',
      phone: c.phone || '',
      city: c.city || '',
      email: c.email || '',
      address: c.address || '',
      creditLimit: c.credit_limit || 0,
      outstandingBalance: customerDueMap.get(c.id) || c.opening_balance || 0,
    }));
  },

  /**
   * Get customer details by ID
   */
  async getCustomerById(customerId: string): Promise<Customer | null> {
    const { data, error } = await supabase
      .from('contacts')
      .select('id, name, code, phone, city, email, address, credit_limit, opening_balance')
      .eq('id', customerId)
      .in('type', ['customer', 'both'])
      .single();

    if (error) throw error;
    if (!data) return null;

    const salesDue = (await supabase.from('sales').select('due_amount').eq('customer_id', customerId).eq('status', 'final').gt('due_amount', 0)).data || [];
    const rentalsDue = (await supabase.from('rentals').select('due_amount').eq('customer_id', customerId).gt('due_amount', 0)).data || [];
    const outstandingBalance =
      (salesDue as any[]).reduce((sum, s: any) => sum + (s.due_amount || 0), 0) +
      (rentalsDue as any[]).reduce((sum, r: any) => sum + (r.due_amount || 0), 0) ||
      (data as any).opening_balance ||
      0;

    return {
      id: (data as any).id,
      code: (data as any).code != null && String((data as any).code).trim() !== '' ? String((data as any).code).trim() : '—',
      name: (data as any).name || '',
      phone: (data as any).phone || '',
      city: (data as any).city || '',
      email: (data as any).email || '',
      address: (data as any).address || '',
      creditLimit: (data as any).credit_limit || 0,
      outstandingBalance,
    };
  },

  /**
   * Get ledger summary for a customer
   */
  async getLedgerSummary(
    customerId: string,
    companyId: string,
    fromDate?: string,
    toDate?: string,
    options?: CustomerLedgerQueryOptions
  ): Promise<CustomerLedgerSummary> {
    const scope: CustomerLedgerPaymentScope = options?.paymentScope ?? 'live';
    const ledgerBranch = ledgerSalesRpcBranchId(options?.branchId ?? null);
    const cId = String(customerId ?? '').trim();
    if (!cId) {
      return {
        openingBalance: 0,
        totalDebit: 0,
        totalCredit: 0,
        closingBalance: 0,
        totalInvoices: 0,
        totalInvoiceAmount: 0,
        totalPaymentReceived: 0,
        pendingAmount: 0,
        fullyPaid: 0,
        partiallyPaid: 0,
        unpaid: 0,
      };
    }
    const allFinalForPayments = await fetchCustomerLedgerSalesForRange(companyId, cId, undefined, undefined, ledgerBranch);
    const allSaleIdsForPayments = (allFinalForPayments || [])
      .map((r: any) => r.id)
      .filter(Boolean) as string[];

    let invoices = await fetchCustomerLedgerSalesForRange(companyId, cId, fromDate, toDate, ledgerBranch);
    const totalInvoices = invoices.length;

    // Ensure invoice_no for studio detection (RPC may not return it)
    const missingInvoiceNo = invoices.some((s: any) => !s.invoice_no);
    if (missingInvoiceNo && invoices.length > 0) {
      const { data: invData } = await supabase
        .from('sales')
        .select('id, invoice_no')
        .in('id', invoices.map((s: any) => s.id));
      const invMap = new Map(((invData || []) as any[]).map((r: any) => [r.id, r.invoice_no]));
      invoices.forEach((s: any) => { if (!s.invoice_no && invMap.has(s.id)) s.invoice_no = invMap.get(s.id); });
    }

    // Studio sales: add production stage costs (same as getTransactions/getInvoices)
    const studioSaleIds = invoices
      .filter((s: any) => {
        const inv = (s.invoice_no || '').toString().trim().toUpperCase();
        return inv.startsWith('STD-') || inv.startsWith('ST-');
      })
      .map((s: any) => s.id);
    const studioChargesBySaleId = new Map<string, number>();
    if (studioSaleIds.length > 0) {
      try {
        const { data: productions } = await supabase
          .from('studio_productions')
          .select('id, sale_id')
          .in('sale_id', studioSaleIds);
        const prodIds = (productions || []).map((p: any) => p.id).filter(Boolean);
        if (prodIds.length > 0) {
          const { data: stages } = await supabase
            .from('studio_production_stages')
            .select('production_id, cost')
            .in('production_id', prodIds);
          const prodBySale = new Map<string, string>();
          (productions || []).forEach((p: any) => { if (p.sale_id) prodBySale.set(p.sale_id, p.id); });
          const chargesByProd = new Map<string, number>();
          (stages || []).forEach((s: any) => {
            const prev = chargesByProd.get(s.production_id) || 0;
            chargesByProd.set(s.production_id, prev + (Number(s.cost) || 0));
          });
          prodBySale.forEach((prodId, saleId) => {
            const ch = chargesByProd.get(prodId) || 0;
            if (ch > 0) studioChargesBySaleId.set(saleId, ch);
          });
        }
      } catch (e) {
        if (process.env.NODE_ENV !== 'production') console.warn('[LEDGER] getLedgerSummary studio charges failed:', e);
      }
    }

    const totalInvoiceAmount = invoices.reduce(
      (sum, s) => sum + saleGrossForLedger(s, studioChargesBySaleId),
      0
    );
    /** Sale-linked + on-account + manual_receipt in range (voided excluded in live scope). */
    const totalPaymentReceived =
      (await sumSaleLinkedPaymentsInDateRange(companyId, allSaleIdsForPayments, fromDate, toDate, scope)) +
      (await sumOnAccountAndManualReceiptPaymentsInDateRange(companyId, cId, fromDate, toDate, scope));
    // Sale returns (final) in date range – CREDIT, reduce customer balance
    let returnsInRange = 0;
    let returnsQuery = supabase.from('sale_returns').select('id, total').eq('company_id', companyId).eq('customer_id', cId).eq('status', 'final');
    if (fromDate) returnsQuery = returnsQuery.gte('return_date', fromDate);
    if (toDate) returnsQuery = returnsQuery.lte('return_date', toDate);
    const { data: rangeReturns } = await returnsQuery;
    const saleReturnIdsInRange = (rangeReturns || []).map((r: any) => r.id);
    returnsInRange = (rangeReturns || []).reduce((sum: number, r: any) => sum + (Number(r.total) || 0), 0);
    const pendingAmount = Math.max(0, invoices.reduce((sum, s) => {
      const paid = Number(s.paid_amount) || 0;
      const gross = saleGrossForLedger(s, studioChargesBySaleId);
      return sum + Math.max(0, gross - paid);
    }, 0) - returnsInRange);
    const fullyPaid = invoices.filter((s) => {
      const paid = Number(s.paid_amount) || 0;
      return paid >= saleGrossForLedger(s, studioChargesBySaleId);
    }).length;
    const partiallyPaid = invoices.filter((s) => {
      const paid = Number(s.paid_amount) || 0;
      const gross = saleGrossForLedger(s, studioChargesBySaleId);
      return paid > 0 && paid < gross;
    }).length;
    const unpaid = totalInvoices - fullyPaid - partiallyPaid;

    // Calculate opening balance: contact opening seed (operational policy) + net activity before fromDate
    const contactOpening = await getContactReceivableOpeningSeed(companyId, cId);
    let openingBalance = contactOpening;
    if (fromDate) {
      const dayBeforeFrom = (() => {
        const d = new Date(fromDate + 'T12:00:00Z');
        d.setUTCDate(d.getUTCDate() - 1);
        return d.toISOString().split('T')[0];
      })();
      const previousSales: any[] = await fetchCustomerLedgerSalesForRange(companyId, cId, null, dayBeforeFrom, ledgerBranch);
      const previousTotal = previousSales.reduce(
        (sum, s: any) => sum + (Number(s.total) || 0) + (Number(s.shipment_charges) || 0),
        0
      );
      const previousPaid = previousSales.reduce((sum, s) => sum + (s.paid_amount || 0), 0);
      const { data: previousReturns } = await supabase
        .from('sale_returns')
        .select('total')
        .eq('company_id', companyId)
        .eq('customer_id', cId)
        .eq('status', 'final')
        .lt('return_date', fromDate);
      const previousReturnsTotal = (previousReturns || []).reduce((sum, r: any) => sum + (Number(r.total) || 0), 0);
      const { data: prevRetIds } = await supabase
        .from('sale_returns')
        .select('id')
        .eq('company_id', companyId)
        .eq('customer_id', cId)
        .eq('status', 'final')
        .lt('return_date', fromDate);
      const prevRetIdList = (prevRetIds || []).map((r: any) => r.id);
      let prevReturnPaymentsTotal = 0;
      if (prevRetIdList.length > 0) {
        const { data: prevRetPays } = await supabase
          .from('payments')
          .select('amount')
          .eq('company_id', companyId)
          .eq('reference_type', 'sale_return')
          .in('reference_id', prevRetIdList)
          .lt('payment_date', fromDate);
        prevReturnPaymentsTotal = (prevRetPays || []).reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
      }
      // Studio: legacy studio_orders table dropped; studio amounts are in sales.studio_charges (already in sales above)
      const prevStudioOrderNet = 0;
      // Rentals before fromDate
      let prevRentalTotal = 0;
      let prevRentalPaid = 0;
      try {
        const rpcPrevRentals = await supabase.rpc('get_customer_ledger_rentals', {
          p_company_id: companyId,
          p_customer_id: cId,
          p_from_date: null,
          p_to_date: dayBeforeFrom,
        });
        const prevRentals = !rpcPrevRentals.error ? (rpcPrevRentals.data ?? []) : [];
        prevRentalTotal = prevRentals.reduce((s: number, r: any) => s + (Number(r.total_amount) || 0), 0);
        const prevRentalIds = prevRentals.map((r: any) => r.id);
        if (prevRentalIds.length > 0) {
          const { data: prevRp } = await supabase
            .from('rental_payments')
            .select('amount')
            .in('rental_id', prevRentalIds)
            .lt('payment_date', fromDate);
          prevRentalPaid = (prevRp || []).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
        }
      } catch (_) {}
      // On-account payments before fromDate (credit to customer, reduce opening balance)
      let prevOnAccQ = supabase
        .from('payments')
        .select('amount')
        .eq('company_id', companyId)
        .eq('contact_id', cId)
        .eq('reference_type', 'on_account')
        .lt('payment_date', fromDate);
      if (isLiveScope(scope)) prevOnAccQ = prevOnAccQ.is('voided_at', null);
      const { data: prevOnAccount } = await prevOnAccQ;
      const prevOnAccountTotal = (prevOnAccount || []).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
      // Manual receipt (Add Entry V2) before fromDate – credit to customer
      let prevManQ = supabase
        .from('payments')
        .select('amount')
        .eq('company_id', companyId)
        .eq('contact_id', cId)
        .eq('reference_type', 'manual_receipt')
        .lt('payment_date', fromDate);
      if (isLiveScope(scope)) prevManQ = prevManQ.is('voided_at', null);
      const { data: prevManualReceipt } = await prevManQ;
      const prevManualReceiptTotal = (prevManualReceipt || []).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
      openingBalance =
        contactOpening +
        previousTotal -
        previousPaid -
        previousReturnsTotal -
        prevReturnPaymentsTotal +
        prevStudioOrderNet +
        prevRentalTotal -
        prevRentalPaid -
        prevOnAccountTotal -
        prevManualReceiptTotal;
    }

    // Studio: legacy studio_orders dropped; studio charges are in sales.studio_charges (included in sales above)
    const studioOrderDebit = 0;
    const studioOrderCredit = 0;

    // On-account payments in range (credit)
    let onAccountCreditInRange = 0;
    let onAccountQuery = supabase
      .from('payments')
      .select('amount')
      .eq('company_id', companyId)
      .eq('contact_id', cId)
      .eq('reference_type', 'on_account');
    if (isLiveScope(scope)) onAccountQuery = onAccountQuery.is('voided_at', null);
    if (fromDate) onAccountQuery = onAccountQuery.gte('payment_date', fromDate);
    if (toDate) onAccountQuery = onAccountQuery.lte('payment_date', toDate);
    const { data: onAccountInRange } = await onAccountQuery;
    onAccountCreditInRange = (onAccountInRange || []).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);

    // Manual receipt (Add Entry V2) in range – credit
    let manualReceiptCreditInRange = 0;
    let manualReceiptQuery = supabase
      .from('payments')
      .select('amount')
      .eq('company_id', companyId)
      .eq('contact_id', cId)
      .eq('reference_type', 'manual_receipt');
    if (isLiveScope(scope)) manualReceiptQuery = manualReceiptQuery.is('voided_at', null);
    if (fromDate) manualReceiptQuery = manualReceiptQuery.gte('payment_date', fromDate);
    if (toDate) manualReceiptQuery = manualReceiptQuery.lte('payment_date', toDate);
    const { data: manualReceiptInRange } = await manualReceiptQuery;
    manualReceiptCreditInRange = (manualReceiptInRange || []).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);

    // Return payments in range (credit)
    let returnPaymentsInRange = 0;
    if (saleReturnIdsInRange.length > 0) {
      let rpQuery = supabase
        .from('payments')
        .select('amount, payment_date')
        .eq('company_id', companyId)
        .eq('reference_type', 'sale_return')
        .in('reference_id', saleReturnIdsInRange);
      if (fromDate) rpQuery = rpQuery.gte('payment_date', fromDate);
      if (toDate) rpQuery = rpQuery.lte('payment_date', toDate);
      const { data: rpInRange } = await rpQuery;
      returnPaymentsInRange = (rpInRange || []).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
    }
    // Rentals: charges by rental date (in range), payments by payment_date (in range)
    let rentalDebit = 0;
    let rentalCredit = 0;
    try {
      const rpcRentals = await supabase.rpc('get_customer_ledger_rentals', {
        p_company_id: companyId,
        p_customer_id: cId,
        p_from_date: null,
        p_to_date: null,
      });
      const allRentals = !rpcRentals.error ? (rpcRentals.data ?? []) : [];
      allRentals.forEach((r: any) => {
        const rawDate = r.pickup_date || r.booking_date || r.created_at;
        const d = rawDate ? (typeof rawDate === 'string' && rawDate.length >= 10 ? rawDate.slice(0, 10) : new Date(rawDate).toISOString().slice(0, 10)) : '';
        if (!d) return;
        if (fromDate && d < fromDate) return;
        if (toDate && d > toDate) return;
        rentalDebit += Number(r.total_amount) || 0;
      });
      const allRentalIds = allRentals.map((r: any) => r.id);
      if (allRentalIds.length > 0) {
        let rpQuery = supabase.from('rental_payments').select('amount').in('rental_id', allRentalIds);
        if (fromDate) rpQuery = rpQuery.gte('payment_date', fromDate);
        if (toDate) rpQuery = rpQuery.lte('payment_date', toDate);
        const { data: rpData } = await rpQuery;
        rentalCredit = (rpData || []).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
      }
    } catch (_) {}

    const totalDebit = totalInvoiceAmount + studioOrderDebit + rentalDebit;
    const totalCredit = totalPaymentReceived + returnsInRange + returnPaymentsInRange + studioOrderCredit + rentalCredit + onAccountCreditInRange + manualReceiptCreditInRange;
    const closingBalance = openingBalance + totalDebit - totalCredit;

    return {
      openingBalance,
      totalDebit,
      totalCredit,
      closingBalance,
      totalInvoices,
      totalInvoiceAmount,
      totalPaymentReceived,
      pendingAmount,
      fullyPaid,
      partiallyPaid,
      unpaid,
    };
  },

  /**
   * Get all transactions for a customer
   */
  async getTransactions(
    customerId: string,
    companyId: string,
    fromDate?: string,
    toDate?: string,
    options?: CustomerLedgerQueryOptions
  ): Promise<Transaction[]> {
    const scope: CustomerLedgerPaymentScope = options?.paymentScope ?? 'live';
    const ledgerBranch = ledgerSalesRpcBranchId(options?.branchId ?? null);
    const cId = String(customerId ?? '').trim();
    if (!cId) return [];

    const sales: any[] = await fetchCustomerLedgerSalesForRange(companyId, cId, fromDate, toDate, ledgerBranch);
    if (process.env.NODE_ENV !== 'production') {
      console.log('[LEDGER] fetchCustomerLedgerSalesForRange', {
        companyId,
        customerId: cId,
        fromDate: fromDate || null,
        toDate: toDate || null,
        salesCount: sales.length,
      });
    }

    const saleIds = (sales || []).map((s: any) => s.id);

    const allFinalLedger = await fetchCustomerLedgerSalesForRange(companyId, cId, undefined, undefined, ledgerBranch);
    const allSaleIdsForPayments = (allFinalLedger || [])
      .map((r: any) => r.id)
      .filter(Boolean) as string[];
    const invoiceNoBySaleId = new Map<string, string>(
      (allFinalLedger || []).map((r: any) => [String(r.id), String(r.invoice_no || '').trim()])
    );

    let payments: any[] = await fetchSaleLinkedPaymentsInDateRange(
      companyId,
      allSaleIdsForPayments,
      fromDate,
      toDate,
      scope
    );
    // On-account payments for this contact (can exist with or without sales)
    let onAccFetch = supabase
      .from('payments')
      .select(
        'id, reference_number, payment_date, amount, payment_method, notes, reference_id, payment_account_id, voided_at, reference_type'
      )
      .eq('company_id', companyId)
      .eq('contact_id', cId)
      .eq('reference_type', 'on_account');
    if (isLiveScope(scope)) onAccFetch = onAccFetch.is('voided_at', null);
    const { data: onAccountPayments } = await onAccFetch;
    const onAccountList = (onAccountPayments || []).filter((p: any) => {
      const d = (p.payment_date || '').toString().slice(0, 10);
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      return true;
    });
    const paymentIdsSet = new Set(payments.map((p: any) => p.id));
    onAccountList.forEach((p: any) => {
      if (!paymentIdsSet.has(p.id)) {
        payments.push({ ...p, reference_type: 'on_account' });
        paymentIdsSet.add(p.id);
      }
    });
    // Add Entry V2: manual_receipt (customer receipt) – must appear in customer ledger
    let manFetch = supabase
      .from('payments')
      .select(
        'id, reference_number, payment_date, amount, payment_method, notes, reference_id, payment_account_id, voided_at, reference_type'
      )
      .eq('company_id', companyId)
      .eq('contact_id', cId)
      .eq('reference_type', 'manual_receipt');
    if (isLiveScope(scope)) manFetch = manFetch.is('voided_at', null);
    const { data: manualReceiptPayments } = await manFetch;
    const manualReceiptList = (manualReceiptPayments || []).filter((p: any) => {
      const d = (p.payment_date || '').toString().slice(0, 10);
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      return true;
    });
    manualReceiptList.forEach((p: any) => {
      if (!paymentIdsSet.has(p.id)) {
        payments.push({ ...p, reference_type: 'manual_receipt' });
        paymentIdsSet.add(p.id);
      }
    });

    // Get sale returns for this customer (CREDIT - reduces balance)
    let returnsQuery = supabase
      .from('sale_returns')
      .select('id, return_no, return_date, total, status, notes')
      .eq('company_id', companyId)
      .eq('customer_id', cId)
      .eq('status', 'final');

    if (fromDate) returnsQuery = returnsQuery.gte('return_date', fromDate);
    if (toDate) returnsQuery = returnsQuery.lte('return_date', toDate);

    const { data: saleReturns, error: returnsError } = await returnsQuery.order('return_date', { ascending: false });
    if (returnsError) {
      console.error('[CUSTOMER LEDGER API] Error fetching sale returns:', returnsError);
    }

    // Get return payments (payments against sale returns – credit to customer)
    const saleReturnIds = (saleReturns || []).map((r: any) => r.id);
    let returnPaymentsQuery = supabase
      .from('payments')
      .select('id, reference_number, payment_date, amount, payment_method, notes, reference_id')
      .eq('company_id', companyId)
      .eq('reference_type', 'sale_return');
    if (saleReturnIds.length > 0) {
      returnPaymentsQuery = returnPaymentsQuery.in('reference_id', saleReturnIds);
    } else {
      returnPaymentsQuery = returnPaymentsQuery.eq('reference_id', '00000000-0000-0000-0000-000000000000');
    }
    if (fromDate) returnPaymentsQuery = returnPaymentsQuery.gte('payment_date', fromDate);
    if (toDate) returnPaymentsQuery = returnPaymentsQuery.lte('payment_date', toDate);
    const { data: returnPayments, error: returnPaymentsError } = await returnPaymentsQuery.order('payment_date', { ascending: false });
    if (returnPaymentsError) {
      console.error('[CUSTOMER LEDGER API] Error fetching return payments:', returnPaymentsError);
    }

    // Fetch notes for sales (RPC doesn't return notes)
    const saleNotesMap = new Map<string, string>();
    if (saleIds.length > 0) {
      const { data: saleNotes } = await supabase.from('sales').select('id, notes').in('id', saleIds);
      (saleNotes || []).forEach((s: any) => { if (s.notes) saleNotesMap.set(s.id, s.notes); });
    }

    // Combine and format transactions
    const transactions: Transaction[] = [];

    // Studio sales: fetch production stage costs to add to sale total (sale.total + worker costs)
    const studioSaleIds = (sales || [])
      .filter((s: any) => {
        const inv = (s.invoice_no || '').toString().trim().toUpperCase();
        return inv.startsWith('STD-') || inv.startsWith('ST-');
      })
      .map((s: any) => s.id);
    const studioChargesBySaleId = new Map<string, number>();
    if (studioSaleIds.length > 0) {
      try {
        const { data: productions } = await supabase
          .from('studio_productions')
          .select('id, sale_id')
          .in('sale_id', studioSaleIds);
        const prodIds = (productions || []).map((p: any) => p.id).filter(Boolean);
        if (prodIds.length > 0) {
          const { data: stages } = await supabase
            .from('studio_production_stages')
            .select('production_id, cost')
            .in('production_id', prodIds);
          const prodBySale = new Map<string, string>();
          (productions || []).forEach((p: any) => {
            if (p.sale_id) prodBySale.set(p.sale_id, p.id);
          });
          const chargesByProd = new Map<string, number>();
          (stages || []).forEach((s: any) => {
            const prev = chargesByProd.get(s.production_id) || 0;
            chargesByProd.set(s.production_id, prev + (Number(s.cost) || 0));
          });
          prodBySale.forEach((prodId, saleId) => {
            const ch = chargesByProd.get(prodId) || 0;
            if (ch > 0) studioChargesBySaleId.set(saleId, ch);
          });
        }
      } catch (e) {
        if (process.env.NODE_ENV !== 'production') console.warn('[LEDGER] Studio charges fetch failed:', e);
      }
    }

    // Add sales as debit transactions (regular + studio sales from sales table)
    (sales || []).forEach((sale: any) => {
      const inv = (sale.invoice_no || '').toString().trim().toUpperCase();
      const isStudioSale = inv.startsWith('STD-') || inv.startsWith('ST-');
      const baseTotal = Number(sale.total) || 0;
      const studioCharges = studioChargesBySaleId.get(sale.id) || 0;
      const ship = Number(sale.shipment_charges) || 0;
      const debitAmount = isStudioSale ? baseTotal + studioCharges : baseTotal + ship;
      const rowDate = sale.invoice_date || effectiveSaleDateYmd(sale);
      const breakdown = saleLedgerBreakdownChildren(sale, isStudioSale);
      transactions.push({
        id: sale.id,
        date: rowDate,
        referenceNo: sale.invoice_no || '',
        documentType: isStudioSale ? ('Studio Sale' as const) : ('Sale' as const),
        description: describeCustomerSaleLedgerLine(sale, isStudioSale),
        paymentAccount: '',
        notes: saleNotesMap.get(sale.id) || '',
        debit: debitAmount,
        credit: 0,
        runningBalance: 0, // Will be calculated
        linkedInvoices: [sale.invoice_no],
        ...(breakdown ? { children: breakdown } : {}),
      } as Transaction);
    });

    // Studio: legacy studio_orders table dropped; studio sales appear above as Sales with documentType 'Studio Sale' (sales.studio_charges included in total)

    // Rentals: fetch via RPC or direct query (pass null dates to get all; filter in merge)
    let customerRentals: any[] = [];
    try {
      const rpcRentals = await supabase.rpc('get_customer_ledger_rentals', {
        p_company_id: companyId,
        p_customer_id: cId,
        p_from_date: null,
        p_to_date: null,
      });
      if (!rpcRentals.error) {
        customerRentals = rpcRentals.data ?? [];
      } else {
        const { data: directRentals } = await supabase
          .from('rentals')
          .select('id, booking_no, booking_date, pickup_date, return_date, total_amount, paid_amount, due_amount, created_at')
          .eq('company_id', companyId)
          .eq('customer_id', cId);
        customerRentals = directRentals ?? [];
      }
    } catch (e) {
      if (process.env.NODE_ENV !== 'production') console.warn('[LEDGER] Rental fetch failed:', e);
    }
    const rentalIds = customerRentals.map((r: any) => r.id);
    const rentalNotesMap = new Map<string, string>();
    if (rentalIds.length > 0) {
      const { data: rentalNotes } = await supabase.from('rentals').select('id, notes').in('id', rentalIds);
      (rentalNotes || []).forEach((r: any) => { if (r.notes) rentalNotesMap.set(r.id, r.notes); });
    }
    let customerRentalPayments: any[] = [];
    if (rentalIds.length > 0) {
      let rpQuery = supabase
        .from('rental_payments')
        .select('id, rental_id, amount, method, reference, payment_date, created_at')
        .in('rental_id', rentalIds);
      if (fromDate) rpQuery = rpQuery.gte('payment_date', fromDate);
      if (toDate) rpQuery = rpQuery.lte('payment_date', toDate);
      const { data: rpData } = await rpQuery.order('payment_date', { ascending: false });
      customerRentalPayments = rpData ?? [];
    }
    const rentalsMap = new Map(customerRentals.map((r: any) => [r.id, r]));

    // Add rental charges as debit transactions
    customerRentals.forEach((r: any) => {
      const rawDate = r.pickup_date || r.booking_date || r.created_at;
      const d = rawDate ? (typeof rawDate === 'string' && rawDate.length >= 10 ? rawDate.slice(0, 10) : new Date(rawDate).toISOString().slice(0, 10)) : '';
      if (!d) return;
      if (fromDate && d < fromDate) return;
      if (toDate && d > toDate) return;
      const total = Number(r.total_amount) || 0;
      if (total <= 0) return;
      transactions.push({
        id: r.id,
        date: d,
        referenceNo: r.booking_no || `RN-${(r.id || '').slice(0, 8)}`,
        documentType: 'Rental' as const,
        description: `Rental ${r.booking_no || r.id?.slice(0, 8)}`,
        paymentAccount: '',
        notes: rentalNotesMap.get(r.id) || '',
        debit: total,
        credit: 0,
        runningBalance: 0,
        linkedInvoices: [r.booking_no || ''],
      });
    });

    // Add rental payments as credit transactions
    customerRentalPayments.forEach((p: any) => {
      const rawDate = p.payment_date || p.created_at;
      const d = rawDate ? (typeof rawDate === 'string' && rawDate.length >= 10 ? rawDate.slice(0, 10) : new Date(rawDate).toISOString().slice(0, 10)) : '';
      if (!d) return;
      if (fromDate && d < fromDate) return;
      if (toDate && d > toDate) return;
      const rental = rentalsMap.get(p.rental_id);
      const ref = rental?.booking_no || `RN-${(p.rental_id || '').slice(0, 8)}`;
      transactions.push({
        id: p.id,
        date: d,
        referenceNo: `${ref}-PAY`,
        documentType: 'Rental Payment' as const,
        description: `Rental Payment via ${p.method || 'other'}`,
        paymentAccount: p.method || '',
        notes: p.reference || '',
        debit: 0,
        credit: Number(p.amount) || 0,
        runningBalance: 0,
        linkedPayments: [`${ref}-PAY`],
      });
    });

    // Add payments as credit transactions (sale-linked, on-account, manual_receipt)
    (payments || []).forEach((payment: any) => {
      const refType = (payment.reference_type || '').toString().toLowerCase();
      const isOnAccount = refType === 'on_account';
      const isManualReceipt = refType === 'manual_receipt';
      let documentType: Transaction['documentType'] = 'Payment';
      let description = `Payment via ${payment.payment_method || 'other'}`;
      if (isOnAccount) {
        documentType = 'On-account Payment';
        description = `On-account payment via ${payment.payment_method || 'other'}`;
      } else if (isManualReceipt) {
        documentType = 'Payment';
        description = payment.notes ? `Receipt – ${payment.notes}` : `Manual receipt via ${payment.payment_method || 'other'}`;
      } else if (payment.reference_id) {
        const invNo = invoiceNoBySaleId.get(String(payment.reference_id));
        if (invNo) {
          description = `Payment for ${invNo} via ${payment.payment_method || 'other'}`;
        }
      }
      transactions.push({
        id: payment.id,
        date: payment.payment_date,
        referenceNo: payment.reference_number || '',
        documentType,
        description,
        paymentAccount: payment.payment_method || '',
        notes: payment.notes || '',
        debit: 0,
        credit: payment.amount || 0,
        runningBalance: 0, // Will be calculated
        linkedPayments: [payment.reference_number],
      });
    });

    // Add sale returns as credit transactions (reduces customer balance)
    (saleReturns || []).forEach((ret: any) => {
      transactions.push({
        id: ret.id,
        date: ret.return_date,
        referenceNo: ret.return_no || `RET-${ret.id?.slice(0, 8)}`,
        documentType: 'Sale Return' as const,
        description: `Sale Return ${ret.return_no || ret.id?.slice(0, 8)}`,
        paymentAccount: '',
        notes: ret.notes || '',
        debit: 0,
        credit: ret.total || 0,
        runningBalance: 0,
        linkedInvoices: [],
      });
    });

    // Add return payments as credit (refund to customer against return)
    (returnPayments || []).forEach((payment: any) => {
      transactions.push({
        id: payment.id,
        date: payment.payment_date,
        referenceNo: payment.reference_number || '',
        documentType: 'Return Payment' as const,
        description: `Return Payment via ${payment.payment_method}`,
        paymentAccount: payment.payment_method || '',
        notes: payment.notes || '',
        debit: 0,
        credit: payment.amount || 0,
        runningBalance: 0,
        linkedPayments: [payment.reference_number],
      });
    });

    await enrichCustomerLedgerPaymentTransactions(companyId, transactions, payments, invoiceNoBySaleId);

    // Sort by date
    transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Running balance: contact opening seed + net activity before fromDate (matches getLedgerSummary)
    const contactOpeningForRun = await getContactReceivableOpeningSeed(companyId, cId);
    let runningBalance = contactOpeningForRun;
    if (fromDate) {
      const dayBeforeFrom = (() => {
        const d = new Date(fromDate + 'T12:00:00Z');
        d.setUTCDate(d.getUTCDate() - 1);
        return d.toISOString().split('T')[0];
      })();
      const prevSales: any[] = await fetchCustomerLedgerSalesForRange(companyId, cId, null, dayBeforeFrom, ledgerBranch);
      const prevTotal = prevSales.reduce(
        (sum, s: any) => sum + (Number(s.total) || 0) + (Number(s.shipment_charges) || 0),
        0
      );
      const prevPaid = prevSales.reduce((sum, s) => sum + (s.paid_amount || 0), 0);
      const { data: prevReturns } = await supabase
        .from('sale_returns')
        .select('id, total')
        .eq('company_id', companyId)
        .eq('customer_id', cId)
        .eq('status', 'final')
        .lt('return_date', fromDate);
      const prevReturnsTotal = (prevReturns || []).reduce((sum, r: any) => sum + (Number(r.total) || 0), 0);
      const prevRetIdsForBal = (prevReturns || []).map((r: any) => r.id);
      let prevReturnPmts = 0;
      if (prevRetIdsForBal.length > 0) {
        const { data: prevRp } = await supabase
          .from('payments')
          .select('amount')
          .eq('company_id', companyId)
          .eq('reference_type', 'sale_return')
          .in('reference_id', prevRetIdsForBal)
          .lt('payment_date', fromDate);
        prevReturnPmts = (prevRp || []).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
      }
      // Studio: legacy studio_orders dropped; studio amounts are in sales.studio_charges
      const prevStudioOrderNet = 0;

      // On-account payments before fromDate (credit to customer)
      let prevOnAccBal = supabase
        .from('payments')
        .select('amount')
        .eq('company_id', companyId)
        .eq('contact_id', cId)
        .eq('reference_type', 'on_account')
        .lt('payment_date', fromDate);
      if (isLiveScope(scope)) prevOnAccBal = prevOnAccBal.is('voided_at', null);
      const { data: prevOnAcc } = await prevOnAccBal;
      const prevOnAccountPmts = (prevOnAcc || []).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
      // Manual receipt (Add Entry V2) before fromDate – credit to customer
      let prevManBal = supabase
        .from('payments')
        .select('amount')
        .eq('company_id', companyId)
        .eq('contact_id', cId)
        .eq('reference_type', 'manual_receipt')
        .lt('payment_date', fromDate);
      if (isLiveScope(scope)) prevManBal = prevManBal.is('voided_at', null);
      const { data: prevManualRec } = await prevManBal;
      const prevManualReceiptPmts = (prevManualRec || []).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);

      // Rentals before fromDate: total charges - rental payments
      let prevRentalTotal = 0;
      let prevRentalPaid = 0;
      try {
        const rpcPrevRentals = await supabase.rpc('get_customer_ledger_rentals', {
          p_company_id: companyId,
          p_customer_id: cId,
          p_from_date: null,
          p_to_date: dayBeforeFrom,
        });
        const prevRentals = !rpcPrevRentals.error ? (rpcPrevRentals.data ?? []) : [];
        prevRentalTotal = prevRentals.reduce((s: number, r: any) => s + (Number(r.total_amount) || 0), 0);
        const prevRentalIds = prevRentals.map((r: any) => r.id);
        if (prevRentalIds.length > 0) {
          const { data: prevRp } = await supabase
            .from('rental_payments')
            .select('amount')
            .in('rental_id', prevRentalIds)
            .lt('payment_date', fromDate);
          prevRentalPaid = (prevRp || []).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
        }
      } catch (_) {}

      runningBalance =
        contactOpeningForRun +
        prevTotal -
        prevPaid -
        prevReturnsTotal -
        prevReturnPmts +
        prevStudioOrderNet +
        prevRentalTotal -
        prevRentalPaid -
        prevOnAccountPmts -
        prevManualReceiptPmts;
    }
    transactions.forEach(t => {
      runningBalance += t.debit - t.credit;
      t.runningBalance = runningBalance;
    });

    return transactions;
  },

  /**
   * Get invoices for a customer
   */
  async getInvoices(
    customerId: string,
    companyId: string,
    fromDate?: string,
    toDate?: string
  ): Promise<Invoice[]> {
    // Full sale_items columns – single source of truth (packing_type, packing_quantity, packing_unit, quantity, unit, variation_id)
    let query = supabase
      .from('sales')
      .select(`
        id,
        invoice_no,
        invoice_date,
        total,
        paid_amount,
        due_amount,
        payment_status,
        shipment_charges,
        created_at,
        items:sales_items(
          product_name,
          quantity,
          unit,
          unit_price,
          discount_amount,
          tax_amount,
          total,
          packing_type,
          packing_quantity,
          packing_unit,
          variation_id
        )
      `)
      .eq('company_id', companyId)
      .eq('customer_id', customerId)
      .eq('status', 'final');

    if (fromDate) {
      query = query.gte('invoice_date', fromDate);
    }
    if (toDate) {
      query = query.lte('invoice_date', toDate);
    }

    const { data: salesData, error } = await query.order('invoice_date', { ascending: false });

    if (error) throw error;
    let sales: any[] = salesData || [];

    const invoiceSalesSelect = `
        id,
        invoice_no,
        invoice_date,
        total,
        paid_amount,
        due_amount,
        payment_status,
        shipment_charges,
        created_at,
        items:sales_items(
          product_name,
          quantity,
          unit,
          unit_price,
          discount_amount,
          tax_amount,
          total,
          packing_type,
          packing_quantity,
          packing_unit,
          variation_id
        )
      `;
    const { data: nullInvoiceRows, error: nullInvErr } = await supabase
      .from('sales')
      .select(invoiceSalesSelect)
      .eq('company_id', companyId)
      .eq('customer_id', customerId)
      .eq('status', 'final')
      .is('invoice_date', null);
    if (!nullInvErr && nullInvoiceRows?.length) {
      const seen = new Set(sales.map((s: any) => s.id));
      for (const r of nullInvoiceRows) {
        if (seen.has(r.id)) continue;
        const d = effectiveSaleDateYmd(r);
        if (!d) continue;
        if (fromDate && d < fromDate) continue;
        if (toDate && d > toDate) continue;
        sales.push({ ...r, invoice_date: d });
        seen.add(r.id);
      }
      sales.sort((a: any, b: any) => {
        const da = String(a.invoice_date || '').slice(0, 10);
        const db = String(b.invoice_date || '').slice(0, 10);
        return db.localeCompare(da);
      });
    }

    // Studio sales: add production stage costs to invoice total (same as getTransactions)
    const studioSaleIds = sales
      .filter((s: any) => {
        const inv = (s.invoice_no || '').toString().trim().toUpperCase();
        return inv.startsWith('STD-') || inv.startsWith('ST-');
      })
      .map((s: any) => s.id);
    const studioChargesBySaleId = new Map<string, number>();
    if (studioSaleIds.length > 0) {
      try {
        const { data: productions } = await supabase
          .from('studio_productions')
          .select('id, sale_id')
          .in('sale_id', studioSaleIds);
        const prodIds = (productions || []).map((p: any) => p.id).filter(Boolean);
        if (prodIds.length > 0) {
          const { data: stages } = await supabase
            .from('studio_production_stages')
            .select('production_id, cost')
            .in('production_id', prodIds);
          const prodBySale = new Map<string, string>();
          (productions || []).forEach((p: any) => {
            if (p.sale_id) prodBySale.set(p.sale_id, p.id);
          });
          const chargesByProd = new Map<string, number>();
          (stages || []).forEach((s: any) => {
            const prev = chargesByProd.get(s.production_id) || 0;
            chargesByProd.set(s.production_id, prev + (Number(s.cost) || 0));
          });
          prodBySale.forEach((prodId, saleId) => {
            const ch = chargesByProd.get(prodId) || 0;
            if (ch > 0) studioChargesBySaleId.set(saleId, ch);
          });
        }
      } catch (e) {
        if (process.env.NODE_ENV !== 'production') console.warn('[LEDGER] getInvoices studio charges failed:', e);
      }
    }

    return sales.map((sale: any) => {
      const inv = (sale.invoice_no || '').toString().trim().toUpperCase();
      const isStudioSale = inv.startsWith('STD-') || inv.startsWith('ST-');
      const baseTotal = Number(sale.total) || 0;
      const studioCharges = studioChargesBySaleId.get(sale.id) || 0;
      const ship = Number(sale.shipment_charges) || 0;
      const invoiceTotal = isStudioSale ? baseTotal + studioCharges : baseTotal + ship;
      const paidAmount = Number(sale.paid_amount) || 0;
      const pendingAmount = Math.max(0, invoiceTotal - paidAmount);
      const status = pendingAmount <= 0 ? 'Fully Paid' as const : paidAmount > 0 ? 'Partially Paid' as const : 'Unpaid' as const;
      return {
        invoiceNo: sale.invoice_no || '',
        date: sale.invoice_date,
        invoiceTotal,
        items: (sale.items || []).map((item: any) => ({
          itemName: item.product_name || '',
          qty: item.quantity || 0,
          rate: item.unit_price || 0,
          lineTotal: item.total || 0,
        })),
        status,
        paidAmount,
        pendingAmount,
      };
    });
  },

  /**
   * Get payments for a customer (sale-linked + on-account)
   */
  async getPayments(
    customerId: string,
    companyId: string,
    fromDate?: string,
    toDate?: string,
    options?: CustomerLedgerQueryOptions
  ): Promise<Payment[]> {
    const scope: CustomerLedgerPaymentScope = options?.paymentScope ?? 'live';
    const ledgerBranch = ledgerSalesRpcBranchId(options?.branchId ?? null);
    const result: Payment[] = [];
    const finalRows = await fetchCustomerLedgerSalesForRange(companyId, String(customerId ?? '').trim(), undefined, undefined, ledgerBranch);
    const saleIds: string[] = (finalRows || []).map((s: any) => s.id).filter(Boolean);

    if (saleIds.length > 0) {
      let query = supabase
        .from('payments')
        .select('id, reference_number, payment_date, amount, payment_method, notes, reference_id, payment_account_id, voided_at')
        .eq('company_id', companyId)
        .eq('reference_type', 'sale')
        .in('reference_id', saleIds);
      if (isLiveScope(scope)) query = query.is('voided_at', null);
      if (fromDate) query = query.gte('payment_date', fromDate);
      if (toDate) query = query.lte('payment_date', toDate);
      const { data: salePayments, error } = await query.order('payment_date', { ascending: false });
      if (error) throw error;
      const { data: relatedSales } = await supabase
        .from('sales')
        .select('id, invoice_no')
        .in('id', (salePayments || []).map((p: any) => p.reference_id).filter(Boolean));
      const invoiceMap = new Map((relatedSales || []).map((s: any) => [s.id, s.invoice_no]));
      const accIds = [...new Set((salePayments || []).map((p: any) => p.payment_account_id).filter(Boolean))] as string[];
      const accNameById = new Map<string, string>();
      if (accIds.length > 0) {
        const { data: accs } = await supabase.from('accounts').select('id, name').in('id', accIds);
        (accs || []).forEach((a: any) => accNameById.set(String(a.id), String(a.name || '').trim()));
      }
      (salePayments || []).forEach((payment: any) => {
        const acc = payment.payment_account_id ? accNameById.get(String(payment.payment_account_id)) : undefined;
        const pm = String(payment.payment_method || 'other');
        result.push({
          id: payment.id,
          paymentNo: payment.reference_number || '',
          date: payment.payment_date,
          amount: payment.amount || 0,
          method: acc ? `${acc} (${pm})` : pm,
          referenceNo: payment.reference_number || '',
          appliedInvoices: invoiceMap.get(payment.reference_id) ? [invoiceMap.get(payment.reference_id)!] : [],
          status: 'Completed' as const,
          ledgerLifecycle: payment.voided_at ? ('voided' as const) : ('active' as const),
        });
      });
    }

    let onAccountQuery = supabase
      .from('payments')
      .select('id, reference_number, payment_date, amount, payment_method, notes, payment_account_id, voided_at')
      .eq('company_id', companyId)
      .eq('contact_id', customerId)
      .eq('reference_type', 'on_account');
    if (isLiveScope(scope)) onAccountQuery = onAccountQuery.is('voided_at', null);
    if (fromDate) onAccountQuery = onAccountQuery.gte('payment_date', fromDate);
    if (toDate) onAccountQuery = onAccountQuery.lte('payment_date', toDate);
    const { data: onAccountPayments, error: onAccErr } = await onAccountQuery.order('payment_date', { ascending: false });
    if (!onAccErr && onAccountPayments?.length) {
      const oaAccIds = [...new Set(onAccountPayments.map((p: any) => p.payment_account_id).filter(Boolean))] as string[];
      const oaAccName = new Map<string, string>();
      if (oaAccIds.length > 0) {
        const { data: accs } = await supabase.from('accounts').select('id, name').in('id', oaAccIds);
        (accs || []).forEach((a: any) => oaAccName.set(String(a.id), String(a.name || '').trim()));
      }
      onAccountPayments.forEach((payment: any) => {
        const acc = payment.payment_account_id ? oaAccName.get(String(payment.payment_account_id)) : undefined;
        const pm = String(payment.payment_method || 'other');
        result.push({
          id: payment.id,
          paymentNo: payment.reference_number || '',
          date: payment.payment_date,
          amount: payment.amount || 0,
          method: acc ? `${acc} (${pm})` : pm,
          referenceNo: payment.reference_number || '',
          appliedInvoices: [],
          status: 'Completed' as const,
          ledgerLifecycle: payment.voided_at ? ('voided' as const) : ('active' as const),
        });
      });
    }
    // Add Entry V2: manual_receipt (customer receipt)
    let manualReceiptQuery = supabase
      .from('payments')
      .select('id, reference_number, payment_date, amount, payment_method, notes, payment_account_id, voided_at')
      .eq('company_id', companyId)
      .eq('contact_id', customerId)
      .eq('reference_type', 'manual_receipt');
    if (isLiveScope(scope)) manualReceiptQuery = manualReceiptQuery.is('voided_at', null);
    if (fromDate) manualReceiptQuery = manualReceiptQuery.gte('payment_date', fromDate);
    if (toDate) manualReceiptQuery = manualReceiptQuery.lte('payment_date', toDate);
    const { data: manualReceiptPayments, error: manualRecErr } = await manualReceiptQuery.order('payment_date', { ascending: false });
    if (!manualRecErr && manualReceiptPayments?.length) {
      const mrAccIds = [...new Set(manualReceiptPayments.map((p: any) => p.payment_account_id).filter(Boolean))] as string[];
      const mrAccName = new Map<string, string>();
      if (mrAccIds.length > 0) {
        const { data: accs } = await supabase.from('accounts').select('id, name').in('id', mrAccIds);
        (accs || []).forEach((a: any) => mrAccName.set(String(a.id), String(a.name || '').trim()));
      }
      manualReceiptPayments.forEach((payment: any) => {
        const acc = payment.payment_account_id ? mrAccName.get(String(payment.payment_account_id)) : undefined;
        const pm = String(payment.payment_method || 'other');
        result.push({
          id: payment.id,
          paymentNo: payment.reference_number || '',
          date: payment.payment_date,
          amount: payment.amount || 0,
          method: acc ? `${acc} (${pm})` : pm,
          referenceNo: payment.reference_number || '',
          appliedInvoices: [],
          status: 'Completed' as const,
          ledgerLifecycle: payment.voided_at ? ('voided' as const) : ('active' as const),
        });
      });
    }
    result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return result;
  },

  /**
   * Get aging report for a customer
   */
  async getAgingReport(
    customerId: string,
    companyId: string
  ): Promise<AgingReport> {
    const { data: sales } = await supabase
      .from('sales')
      .select('invoice_date, due_amount, invoice_no')
      .eq('company_id', companyId)
      .eq('customer_id', customerId)
      .eq('status', 'final')
      .gt('due_amount', 0);

    if (!sales) {
      return {
        current: 0,
        days1to30: 0,
        days31to60: 0,
        days61to90: 0,
        days90plus: 0,
        total: 0,
      };
    }

    const today = new Date();
    let current = 0;
    let days1to30 = 0;
    let days31to60 = 0;
    let days61to90 = 0;
    let days90plus = 0;

    sales.forEach((sale: any) => {
      const invoiceDate = new Date(sale.invoice_date);
      const daysDiff = Math.floor((today.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24));
      const amount = sale.due_amount || 0;

      if (daysDiff <= 0) {
        current += amount;
      } else if (daysDiff <= 30) {
        days1to30 += amount;
      } else if (daysDiff <= 60) {
        days31to60 += amount;
      } else if (daysDiff <= 90) {
        days61to90 += amount;
      } else {
        days90plus += amount;
      }
    });

    return {
      current,
      days1to30,
      days31to60,
      days61to90,
      days90plus,
      total: current + days1to30 + days31to60 + days61to90 + days90plus,
    };
  },
};
