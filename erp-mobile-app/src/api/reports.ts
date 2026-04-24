import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getAllSales } from './sales';
import { normalizeCompanyId } from './contactBalancesUtils';
import { fetchContactBalancesSummary } from './contactBalancesRpc';

export async function getCompanyName(companyId: string | null): Promise<string> {
  if (!isSupabaseConfigured || !companyId) return 'Company';
  const { data } = await supabase.from('companies').select('name').eq('id', companyId).maybeSingle();
  return (data?.name as string | undefined) || 'Company';
}

/** Company identity for branded PDF/print headers (logo, address, phone, email, tax no). */
export interface CompanyBrand {
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  taxNumber: string | null;
  logoUrl: string | null;
  city: string | null;
  country: string | null;
}

export async function getCompanyBrand(companyId: string | null): Promise<CompanyBrand> {
  const fallback: CompanyBrand = {
    name: 'Company',
    address: null,
    phone: null,
    email: null,
    website: null,
    taxNumber: null,
    logoUrl: null,
    city: null,
    country: null,
  };
  if (!isSupabaseConfigured || !companyId) return fallback;
  const { data } = await supabase
    .from('companies')
    .select('name, address, phone, email, website, tax_number, logo_url, city, country')
    .eq('id', companyId)
    .maybeSingle();
  if (!data) return fallback;
  const row = data as Record<string, unknown>;
  return {
    name: (row.name as string) || 'Company',
    address: (row.address as string) ?? null,
    phone: (row.phone as string) ?? null,
    email: (row.email as string) ?? null,
    website: (row.website as string) ?? null,
    taxNumber: (row.tax_number as string) ?? null,
    logoUrl: (row.logo_url as string) ?? null,
    city: (row.city as string) ?? null,
    country: (row.country as string) ?? null,
  };
}

/** One line in a ledger report (date, voucher, description, Dr, Cr, running balance). */
export interface LedgerLine {
  id: string;
  /** journal_entries.id ? source journal entry for this line (used for drill-down). */
  journalEntryId: string;
  /** journal_entries.reference_id ? source record (sale, purchase, payment, ...). */
  sourceReferenceId: string | null;
  date: string;
  createdAt: string;
  entryNo: string;
  description: string;
  reference: string;
  referenceType: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

/** Fetch ledger lines for any account with optional date range. */
export async function getAccountLedgerLines(
  companyId: string,
  accountId: string,
  from?: string,
  to?: string,
): Promise<{ openingBalance: number; lines: LedgerLine[]; error: string | null }> {
  if (!isSupabaseConfigured) return { openingBalance: 0, lines: [], error: 'App not configured.' };

  const fromIso = from ? new Date(from).toISOString() : undefined;
  const toIso = to ? new Date(to + 'T23:59:59.999Z').toISOString() : undefined;

  // Opening balance: sum all entries strictly before `from`.
  let opening = 0;
  if (fromIso) {
    const { data: before } = await supabase
      .from('journal_entry_lines')
      .select('debit, credit, journal_entry:journal_entries!inner(company_id, is_void, entry_date)')
      .eq('account_id', accountId)
      .eq('journal_entry.company_id', companyId)
      .lt('journal_entry.entry_date', from!)
      .limit(5000);
    opening = (before || []).reduce((s, r: Record<string, unknown>) => {
      const je = (r as Record<string, unknown>).journal_entry as Record<string, unknown> | null;
      if (je && (je.is_void as boolean)) return s;
      return s + Number(r.debit || 0) - Number(r.credit || 0);
    }, 0);
  }

  // In-range rows
  let q = supabase
    .from('journal_entry_lines')
    .select(
      `
      id, debit, credit, description,
      journal_entry:journal_entries!inner(
        id, entry_no, entry_date, description, reference_type, reference_id, is_void, created_at, company_id
      )
    `,
    )
    .eq('account_id', accountId)
    .eq('journal_entry.company_id', companyId);
  if (fromIso) q = q.gte('journal_entry.entry_date', from!);
  if (toIso) q = q.lte('journal_entry.entry_date', to!);
  const { data, error } = await q
    .order('entry_date', { ascending: true, foreignTable: 'journal_entries' })
    .order('created_at', { ascending: true, foreignTable: 'journal_entries' });
  if (error) return { openingBalance: opening, lines: [], error: error.message };

  const rows = (data || []) as Array<{
    id: string;
    debit: number;
    credit: number;
    description: string | null;
    journal_entry: Record<string, unknown> | Record<string, unknown>[] | null;
  }>;

  let running = opening;
  const lines: LedgerLine[] = [];
  for (const r of rows) {
    const je = Array.isArray(r.journal_entry) ? r.journal_entry[0] : r.journal_entry;
    if (!je || je.is_void === true) continue;
    const debit = Number(r.debit || 0);
    const credit = Number(r.credit || 0);
    running += debit - credit;
    lines.push({
      id: String(r.id ?? ''),
      journalEntryId: String(je.id ?? ''),
      sourceReferenceId: je.reference_id ? String(je.reference_id) : null,
      date: je.entry_date ? String(je.entry_date).slice(0, 10) : '',
      createdAt: String(je.created_at ?? ''),
      entryNo: String(je.entry_no ?? ''),
      description: String(r.description || je.description || ''),
      reference: String(je.entry_no ?? ''),
      referenceType: String(je.reference_type ?? ''),
      debit,
      credit,
      runningBalance: running,
    });
  }
  return { openingBalance: opening, lines, error: null };
}

/** Contacts of a specific type (customer/supplier) with optional outstanding balance. */
export interface PartyRow {
  id: string;
  name: string;
  code?: string | null;
  phone?: string | null;
  email?: string | null;
  balance: number;
}

export async function getContactsByType(
  companyId: string,
  type: 'customer' | 'supplier',
): Promise<{ data: PartyRow[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  // Narrow select to columns that exist in every schema version and filter by
  // type (also accept 'both' because some contacts double as customers+suppliers).
  // Previously the select included `code, customer_code, supplier_code` which
  // fails on DBs where those columns were renamed/removed, silently returning
  // an empty list from the client's perspective.
  const tryFetch = async (columns: string) =>
    supabase
      .from('contacts')
      .select(columns)
      .eq('company_id', companyId)
      .in('type', [type, 'both'])
      .order('name');
  let res = await tryFetch('id, name, code, customer_code, supplier_code, phone, email, balance, type');
  if (res.error) {
    // Fallback: minimal column set that we know exists everywhere.
    res = await tryFetch('id, name, phone, email, balance, type');
  }
  if (res.error) {
    // Many schemas have opening_balance/current_balance but no `balance` column.
    res = await tryFetch('id, name, phone, email, type');
  }
  if (res.error) return { data: [], error: res.error.message };
  return {
    data: ((res.data ?? []) as unknown as Array<Record<string, unknown>>).map((r) => ({
      id: String(r.id),
      name: String(r.name ?? '?'),
      code: (r.code ?? r.customer_code ?? r.supplier_code)
        ? String(r.code ?? r.customer_code ?? r.supplier_code)
        : null,
      phone: r.phone ? String(r.phone) : null,
      email: r.email ? String(r.email) : null,
      balance: Number(r.balance) || 0,
    })),
    error: null,
  };
}

/** Resolve a contact's AR/AP sub-account id (created by party sub-ledger migration). */
export async function getContactSubAccountId(
  companyId: string,
  contactId: string,
): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase
    .from('accounts')
    .select('id')
    .eq('company_id', companyId)
    .eq('linked_contact_id', contactId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  return data?.id ? String(data.id) : null;
}

// ---------------------------------------------------------------------------
// Aging (payables / receivables)
// ---------------------------------------------------------------------------

export interface AgingRow {
  partyId: string;
  partyName: string;
  meta?: string;
  buckets: number[];
  total: number;
}

export interface AgingReport {
  labels: string[];
  totals: { amount: number; count: number }[];
  grandTotal: number;
  parties: AgingRow[];
}

const AGING_LABELS = ['0-30', '31-60', '61-90', '91-180', '180+'] as const;
const AGING_BOUNDARIES = [30, 60, 90, 180] as const;

function bucketIndexForAge(days: number): number {
  for (let i = 0; i < AGING_BOUNDARIES.length; i++) {
    if (days <= AGING_BOUNDARIES[i]) return i;
  }
  return AGING_LABELS.length - 1;
}

export async function getReceivablesAging(companyId: string, branchId?: string | null): Promise<AgingReport> {
  const labels = [...AGING_LABELS];
  const emptyTotals = labels.map(() => ({ amount: 0, count: 0 }));
  if (!isSupabaseConfigured) return { labels, totals: emptyTotals, grandTotal: 0, parties: [] };

  let q = supabase
    .from('sales')
    .select('id, customer_id, customer_name, total, paid_amount, due_amount, invoice_date, payment_status, branch_id')
    .eq('company_id', companyId)
    .in('payment_status', ['unpaid', 'partial']);
  if (branchId && branchId !== 'all' && branchId !== 'default') q = q.eq('branch_id', branchId);
  const { data } = await q;
  if (!data) return { labels, totals: emptyTotals, grandTotal: 0, parties: [] };

  const now = Date.now();
  const parties = new Map<string, AgingRow>();
  const totals = labels.map(() => ({ amount: 0, count: 0 }));
  let grand = 0;

  for (const s of data as Record<string, unknown>[]) {
    const due = Math.max(0, Number(s.due_amount ?? 0));
    if (due <= 0.001) continue;
    const dt = s.invoice_date ? new Date(String(s.invoice_date)) : new Date(String(s.created_at ?? Date.now()));
    const days = Math.max(0, Math.floor((now - dt.getTime()) / 86400000));
    const idx = bucketIndexForAge(days);
    const pid = String(s.customer_id ?? `walkin:${s.customer_name ?? 'walkin'}`);
    const pname = String(s.customer_name ?? 'Walk-in');
    let row = parties.get(pid);
    if (!row) {
      row = {
        partyId: pid,
        partyName: pname,
        buckets: labels.map(() => 0),
        total: 0,
      };
      parties.set(pid, row);
    }
    row.buckets[idx] += due;
    row.total += due;
    totals[idx].amount += due;
    totals[idx].count += 1;
    grand += due;
  }

  return {
    labels,
    totals,
    grandTotal: grand,
    parties: Array.from(parties.values()).sort((a, b) => b.total - a.total),
  };
}

export async function getPayablesAging(companyId: string): Promise<AgingReport> {
  const labels = [...AGING_LABELS];
  const emptyTotals = labels.map(() => ({ amount: 0, count: 0 }));
  if (!isSupabaseConfigured) return { labels, totals: emptyTotals, grandTotal: 0, parties: [] };

  const { data } = await supabase
    .from('purchases')
    .select('id, supplier_id, supplier_name, total, paid_amount, due_amount, po_date, payment_status')
    .eq('company_id', companyId)
    .in('payment_status', ['unpaid', 'partial']);
  if (!data) return { labels, totals: emptyTotals, grandTotal: 0, parties: [] };

  const now = Date.now();
  const parties = new Map<string, AgingRow>();
  const totals = labels.map(() => ({ amount: 0, count: 0 }));
  let grand = 0;

  for (const s of data as Record<string, unknown>[]) {
    const due = Math.max(0, Number(s.due_amount ?? 0));
    if (due <= 0.001) continue;
    const dt = s.po_date ? new Date(String(s.po_date)) : new Date();
    const days = Math.max(0, Math.floor((now - dt.getTime()) / 86400000));
    const idx = bucketIndexForAge(days);
    const pid = String(s.supplier_id ?? `unknown:${s.supplier_name ?? 'unknown'}`);
    const pname = String(s.supplier_name ?? 'Unknown');
    let row = parties.get(pid);
    if (!row) {
      row = {
        partyId: pid,
        partyName: pname,
        buckets: labels.map(() => 0),
        total: 0,
      };
      parties.set(pid, row);
    }
    row.buckets[idx] += due;
    row.total += due;
    totals[idx].amount += due;
    totals[idx].count += 1;
    grand += due;
  }

  return {
    labels,
    totals,
    grandTotal: grand,
    parties: Array.from(parties.values()).sort((a, b) => b.total - a.total),
  };
}

// ---------------------------------------------------------------------------
// Day book (all journal entries in a date range)
// ---------------------------------------------------------------------------

export interface DayBookJournalEntry {
  id: string;
  entryNo: string;
  date: string;
  createdAt: string;
  description: string;
  referenceType: string;
  debit: number;
  credit: number;
  /** True if at least one line touches a cash / bank / mobile_wallet account. */
  isCash: boolean;
  lines: { accountCode: string; accountName: string; accountType: string; debit: number; credit: number; description: string }[];
}

/** `mode='cash'` limits to Roznamcha-style entries (any line touching cash/bank/wallet). */
export async function getDayBook(
  companyId: string,
  from: string,
  to: string,
  branchId?: string | null,
  mode: 'all' | 'cash' = 'all',
): Promise<{ data: DayBookJournalEntry[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  let q = supabase
    .from('journal_entries')
    .select(
      `
      id, entry_no, entry_date, description, reference_type, created_at, is_void,
      total_debit, total_credit,
      lines:journal_entry_lines(
        debit, credit, description,
        account:accounts(code, name, type)
      )
    `,
    )
    .eq('company_id', companyId)
    .gte('entry_date', from)
    .lte('entry_date', to)
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1000);
  if (branchId && branchId !== 'all' && branchId !== 'default') q = q.eq('branch_id', branchId);
  const { data, error } = await q;
  if (error) return { data: [], error: error.message };
  const rows = (data || []) as Record<string, unknown>[];
  const out: DayBookJournalEntry[] = [];
  const CASH_TYPES = new Set(['cash', 'bank', 'mobile_wallet']);
  for (const e of rows) {
    if (e.is_void === true) continue;
    const linesRaw = (e.lines as Record<string, unknown>[]) || [];
    let debit = 0;
    let credit = 0;
    let isCash = false;
    const lines = linesRaw.map((l) => {
      const acc = (l.account as Record<string, unknown>) || {};
      const d = Number(l.debit || 0);
      const c = Number(l.credit || 0);
      const accountType = String(acc.type ?? '').toLowerCase();
      if (CASH_TYPES.has(accountType)) isCash = true;
      debit += d;
      credit += c;
      return {
        accountCode: String(acc.code ?? ''),
        accountName: String(acc.name ?? ''),
        accountType,
        debit: d,
        credit: c,
        description: String(l.description || ''),
      };
    });
    if (mode === 'cash' && !isCash) continue;
    out.push({
      id: String(e.id),
      entryNo: String(e.entry_no ?? ''),
      date: e.entry_date ? String(e.entry_date).slice(0, 10) : '',
      createdAt: String(e.created_at ?? ''),
      description: String(e.description ?? ''),
      referenceType: String(e.reference_type ?? ''),
      debit: Number(e.total_debit ?? debit),
      credit: Number(e.total_credit ?? credit),
      isCash,
      lines,
    });
  }
  return { data: out, error: null };
}

// ---------------------------------------------------------------------------
// Sales / Purchases / Expenses lists (for operational reports)
// ---------------------------------------------------------------------------

export interface SalesReportRow {
  id: string;
  invoiceNo: string;
  customerName: string;
  customerId: string | null;
  total: number;
  paid: number;
  due: number;
  status: string;
  paymentStatus: string;
  date: string;
  createdAt: string;
  branchId: string | null;
  isStudio: boolean;
}

export async function getSalesInRange(
  companyId: string,
  from?: string,
  to?: string,
  branchId?: string | null,
  isStudio?: boolean,
): Promise<{ data: SalesReportRow[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  let q = supabase
    .from('sales')
    .select('id, invoice_no, customer_id, customer_name, total, paid_amount, due_amount, status, payment_status, invoice_date, created_at, branch_id, is_studio')
    .eq('company_id', companyId)
    .order('invoice_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(500);
  if (from) q = q.gte('invoice_date', from);
  if (to) q = q.lte('invoice_date', to);
  if (branchId && branchId !== 'all' && branchId !== 'default') q = q.eq('branch_id', branchId);
  if (typeof isStudio === 'boolean') q = q.eq('is_studio', isStudio);
  const { data, error } = await q;
  if (error) return { data: [], error: error.message };
  return {
    data: (data || []).map((r: Record<string, unknown>) => ({
      id: String(r.id),
      invoiceNo: String(r.invoice_no ?? '???'),
      customerName: String(r.customer_name ?? 'Walk-in'),
      customerId: r.customer_id ? String(r.customer_id) : null,
      total: Number(r.total) || 0,
      paid: Number(r.paid_amount) || 0,
      due: Number(r.due_amount) || 0,
      status: String(r.status ?? ''),
      paymentStatus: String(r.payment_status ?? ''),
      date: r.invoice_date ? String(r.invoice_date).slice(0, 10) : '',
      createdAt: String(r.created_at ?? ''),
      branchId: r.branch_id ? String(r.branch_id) : null,
      isStudio: !!r.is_studio,
    })),
    error: null,
  };
}

export interface PurchaseReportRow {
  id: string;
  poNo: string;
  supplierName: string;
  supplierId: string | null;
  total: number;
  paid: number;
  due: number;
  status: string;
  paymentStatus: string;
  date: string;
  branchId: string | null;
}

export async function getPurchasesInRange(
  companyId: string,
  from?: string,
  to?: string,
  branchId?: string | null,
): Promise<{ data: PurchaseReportRow[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  let q = supabase
    .from('purchases')
    .select('id, po_no, supplier_id, supplier_name, total, paid_amount, due_amount, status, payment_status, po_date, branch_id')
    .eq('company_id', companyId)
    .order('po_date', { ascending: false })
    .limit(500);
  if (from) q = q.gte('po_date', from);
  if (to) q = q.lte('po_date', to);
  if (branchId && branchId !== 'all' && branchId !== 'default') q = q.eq('branch_id', branchId);
  const { data, error } = await q;
  if (error) return { data: [], error: error.message };
  return {
    data: (data || []).map((r: Record<string, unknown>) => ({
      id: String(r.id),
      poNo: String(r.po_no ?? '???'),
      supplierName: String(r.supplier_name ?? 'Unknown'),
      supplierId: r.supplier_id ? String(r.supplier_id) : null,
      total: Number(r.total) || 0,
      paid: Number(r.paid_amount) || 0,
      due: Number(r.due_amount) || 0,
      status: String(r.status ?? ''),
      paymentStatus: String(r.payment_status ?? ''),
      date: r.po_date ? String(r.po_date).slice(0, 10) : '',
      branchId: r.branch_id ? String(r.branch_id) : null,
    })),
    error: null,
  };
}

export interface ExpenseReportRow {
  id: string;
  expenseNo: string;
  category: string;
  description: string;
  amount: number;
  method: string;
  date: string;
  branchId: string | null;
  status: string;
}

export async function getExpensesInRange(
  companyId: string,
  from?: string,
  to?: string,
  branchId?: string | null,
): Promise<{ data: ExpenseReportRow[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  let q = supabase
    .from('expenses')
    .select('id, expense_no, category, description, amount, payment_method, expense_date, branch_id, status')
    .eq('company_id', companyId)
    .order('expense_date', { ascending: false })
    .limit(500);
  if (from) q = q.gte('expense_date', from);
  if (to) q = q.lte('expense_date', to);
  if (branchId && branchId !== 'all' && branchId !== 'default') q = q.eq('branch_id', branchId);
  const { data, error } = await q;
  if (error) return { data: [], error: error.message };
  return {
    data: (data || []).map((r: Record<string, unknown>) => ({
      id: String(r.id),
      expenseNo: String(r.expense_no ?? '???'),
      category: String(r.category ?? '???'),
      description: String(r.description ?? ''),
      amount: Number(r.amount) || 0,
      method: String(r.payment_method ?? ''),
      date: r.expense_date ? String(r.expense_date).slice(0, 10) : '',
      branchId: r.branch_id ? String(r.branch_id) : null,
      status: String(r.status ?? ''),
    })),
    error: null,
  };
}

export interface StudioProductionRow {
  id: string;
  productionNo: string;
  productName: string;
  quantity: number;
  status: string;
  date: string;
  saleId: string | null;
  invoiceNo: string | null;
  customerName: string | null;
  saleTotal: number;
  stageCount: number;
  stagesCompleted: number;
  workerCost: number;
  customerCharge: number;
  profit: number;
}

function buildVariationLabel(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const variation = raw as { sku?: string; attributes?: Record<string, string> };
  const attrs = variation.attributes ?? {};
  const parts = Object.values(attrs).filter(Boolean);
  if (parts.length > 0) return parts.join(' - ');
  return variation.sku ?? null;
}

export async function getStudioProductions(
  companyId: string,
  from?: string,
  to?: string,
): Promise<{ data: StudioProductionRow[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  // Split-query pattern: avoid ambiguous embeds so reports still work when
  // multiple FKs exist between studio_productions and child tables.
  let q = supabase
    .from('studio_productions')
    .select(
      `id, production_no, quantity, status, production_date, created_at, sale_id, product_id`,
    )
    .eq('company_id', companyId)
    .order('production_date', { ascending: false, nullsFirst: false })
    .limit(500);
  // Prefer production_date for the range filter; fall back to created_at via OR
  // would be fragile, so we accept ranges that use production_date OR created_at.
  if (from) q = q.or(`production_date.gte.${from},created_at.gte.${from}T00:00:00+00:00`);
  if (to) q = q.or(`production_date.lte.${to},created_at.lte.${to}T23:59:59+00:00`);
  const { data, error } = await q;
  if (error) return { data: [], error: error.message };
  const rows = (data || []) as Array<Record<string, unknown>>;

  const productIds = Array.from(
    new Set(rows.map((r) => String(r.product_id ?? '')).filter((id) => !!id)),
  );
  const saleIds = Array.from(
    new Set(rows.map((r) => String(r.sale_id ?? '')).filter((id) => !!id)),
  );
  const prodIds = Array.from(new Set(rows.map((r) => String(r.id ?? ''))));

  const [productRes, saleRes, stageRes] = await Promise.all([
    productIds.length
      ? supabase.from('products').select('id, name').in('id', productIds)
      : Promise.resolve({ data: [], error: null } as { data: Array<Record<string, unknown>>; error: null }),
    saleIds.length
      ? supabase.from('sales').select('id, invoice_no, customer_name, total').in('id', saleIds)
      : Promise.resolve({ data: [], error: null } as { data: Array<Record<string, unknown>>; error: null }),
    prodIds.length
      ? supabase
          .from('studio_production_stages')
          .select('id, status, cost, production_id')
          .in('production_id', prodIds)
      : Promise.resolve({ data: [], error: null } as { data: Array<Record<string, unknown>>; error: null }),
  ]);

  const productNameMap = new Map<string, string>();
  ((productRes.data || []) as Array<Record<string, unknown>>).forEach((p) => {
    productNameMap.set(String(p.id ?? ''), String(p.name ?? '?'));
  });
  const saleMap = new Map<string, Record<string, unknown>>();
  ((saleRes.data || []) as Array<Record<string, unknown>>).forEach((s) => {
    saleMap.set(String(s.id ?? ''), s);
  });
  const stagesByProduction = new Map<string, Array<{ status: string; cost: number }>>();
  ((stageRes.data || []) as Array<Record<string, unknown>>).forEach((st) => {
    const key = String(st.production_id ?? '');
    if (!key) return;
    const arr = stagesByProduction.get(key) ?? [];
    arr.push({ status: String(st.status ?? ''), cost: Number(st.cost) || 0 });
    stagesByProduction.set(key, arr);
  });

  return {
    data: rows.map((r) => {
      const sale = saleMap.get(String(r.sale_id ?? '')) || {};
      const stages = stagesByProduction.get(String(r.id ?? '')) ?? [];
      const workerCost = stages.reduce((s, st) => s + (Number(st.cost) || 0), 0);
      const stagesCompleted = stages.filter((s) => s.status === 'completed').length;
      const saleTotal = Number(sale.total) || 0;
      const customerCharge = saleTotal;
      return {
        id: String(r.id),
        productionNo: String(r.production_no ?? '?'),
        productName: productNameMap.get(String(r.product_id ?? '')) ?? '?',
        quantity: Number(r.quantity) || 0,
        status: String(r.status ?? ''),
        date: r.production_date
          ? String(r.production_date).slice(0, 10)
          : (r.created_at ? String(r.created_at).slice(0, 10) : ''),
        saleId: r.sale_id ? String(r.sale_id) : null,
        invoiceNo: sale.invoice_no ? String(sale.invoice_no) : null,
        customerName: sale.customer_name ? String(sale.customer_name) : null,
        saleTotal,
        stageCount: stages.length,
        stagesCompleted,
        workerCost,
        customerCharge,
        profit: customerCharge - workerCost,
      };
    }),
    error: null,
  };
}

export interface RentalReportRow {
  id: string;
  bookingNo: string;
  customerName: string;
  total: number;
  paid: number;
  due: number;
  status: string;
  date: string;
  pickupDate: string | null;
  returnDate: string | null;
  actualReturnDate: string | null;
  itemCount: number;
  itemsSummary: string;
  penaltyAmount: number;
  damageAmount: number;
}

export async function getRentalsInRange(
  companyId: string,
  from?: string,
  to?: string,
): Promise<{ data: RentalReportRow[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  let q = supabase
    .from('rentals')
    .select(
      `*, items:rental_items(id, product_name, quantity)`,
    )
    .eq('company_id', companyId)
    .order('booking_date', { ascending: false })
    .limit(500);
  // Use booking_date primary filter with created_at fallback so bookings that
  // were back-dated or front-dated still appear within the report range.
  if (from) q = q.or(`booking_date.gte.${from},created_at.gte.${from}T00:00:00+00:00`);
  if (to) q = q.or(`booking_date.lte.${to},created_at.lte.${to}T23:59:59+00:00`);
  const { data, error } = await q;
  if (error) return { data: [], error: error.message };
  return {
    data: (data || []).map((r: Record<string, unknown>) => {
      const items = (r.items as Array<{ product_name: string; quantity: number }>) || [];
      const itemsSummary = items
        .map((it) => `${it.product_name}${it.quantity > 1 ? ` x${it.quantity}` : ''}`)
        .slice(0, 3)
        .join(', ') + (items.length > 3 ? `, +${items.length - 3}` : '');
      return {
        id: String(r.id),
        bookingNo: String(r.booking_no ?? '?'),
        customerName: String(r.customer_name ?? '?'),
        total: Number(r.total_amount ?? r.total ?? 0) || 0,
        paid: Number(r.paid_amount) || 0,
        due: Number(r.due_amount) || 0,
        status: String(r.status ?? ''),
        date: r.booking_date
          ? String(r.booking_date).slice(0, 10)
          : (r.created_at ? String(r.created_at).slice(0, 10) : ''),
        pickupDate: r.pickup_date ? String(r.pickup_date).slice(0, 10) : null,
        returnDate: r.return_date ? String(r.return_date).slice(0, 10) : null,
        actualReturnDate: r.actual_return_date ? String(r.actual_return_date).slice(0, 10) : null,
        itemCount: items.length,
        itemsSummary,
        penaltyAmount: Number(r.penalty_amount ?? r.late_fee ?? 0) || 0,
        damageAmount: Number(r.damage_amount ?? r.damage_charges ?? 0) || 0,
      };
    }),
    error: null,
  };
}

export interface StockMovementRow {
  id: string;
  date: string;
  createdAt: string;
  productId: string;
  productName: string;
  variationId: string | null;
  variationLabel: string | null;
  movementType: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  referenceType: string;
  referenceId: string | null;
  notes: string | null;
}

export async function getStockMovements(
  companyId: string,
  from?: string,
  to?: string,
  productId?: string | null,
  variationId?: string | null,
): Promise<{ data: StockMovementRow[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  let q = supabase
    .from('stock_movements')
    .select(
      `id, created_at, product_id, variation_id, movement_type, quantity, unit_cost, total_cost,
       reference_type, reference_id, notes`,
    )
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(1000);
  if (from) q = q.gte('created_at', `${from}T00:00:00+00:00`);
  if (to) q = q.lte('created_at', `${to}T23:59:59+00:00`);
  if (productId) q = q.eq('product_id', productId);
  if (variationId) q = q.eq('variation_id', variationId);
  const { data, error } = await q;
  if (error) return { data: [], error: error.message };
  const rows = (data || []) as Array<Record<string, unknown>>;
  const productIds = Array.from(
    new Set(rows.map((r) => String(r.product_id ?? '')).filter((id) => !!id)),
  );
  const variationIds = Array.from(
    new Set(rows.map((r) => String(r.variation_id ?? '')).filter((id) => !!id)),
  );
  const productNameMap = new Map<string, string>();
  if (productIds.length > 0) {
    const { data: productRows, error: productErr } = await supabase
      .from('products')
      .select('id, name')
      .in('id', productIds);
    if (productErr) return { data: [], error: productErr.message };
    (productRows || []).forEach((p: Record<string, unknown>) => {
      productNameMap.set(String(p.id ?? ''), String(p.name ?? '?'));
    });
  }
  const variationMap = new Map<string, string | null>();
  if (variationIds.length > 0) {
    const { data: variationRows, error: variationErr } = await supabase
      .from('product_variations')
      .select('id, sku, attributes')
      .in('id', variationIds);
    if (!variationErr) {
      (variationRows || []).forEach((v: Record<string, unknown>) => {
        variationMap.set(String(v.id ?? ''), buildVariationLabel(v));
      });
    }
  }
  return {
    data: rows.map((r: Record<string, unknown>) => {
      const resolvedVariationId = r.variation_id ? String(r.variation_id) : null;
      const variationLabel = resolvedVariationId ? (variationMap.get(resolvedVariationId) ?? null) : null;
      return {
        id: String(r.id),
        date: r.created_at ? String(r.created_at).slice(0, 10) : '',
        createdAt: String(r.created_at ?? ''),
        productId: String(r.product_id ?? ''),
        productName: productNameMap.get(String(r.product_id ?? '')) ?? '?',
        variationId: resolvedVariationId,
        variationLabel,
        movementType: String(r.movement_type ?? ''),
        quantity: Number(r.quantity) || 0,
        unitCost: Number(r.unit_cost) || 0,
        totalCost: Number(r.total_cost) || 0,
        referenceType: String(r.reference_type ?? ''),
        referenceId: r.reference_id ? String(r.reference_id) : null,
        notes: r.notes ? String(r.notes) : null,
      };
    }),
    error: null,
  };
}

// ==== Legacy exports (used by other modules) ====
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
  // All final invoices in range (include unpaid/partial) G?? same basis as web dashboard total sales
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
      supplier: String(r.supplier_name ?? 'G??'),
      total: Number(r.total) || 0,
      date: r.po_date ? new Date(r.po_date as string).toISOString().slice(0, 10) : 'G??',
      paymentStatus: String(r.payment_status ?? 'unpaid'),
    })),
    error: null,
  };
}

/** Day Book (Roznamcha) G?? flattened journal entries for date range, chronological order */
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

/** Total receivables G?? same operational basis as web Contacts (`get_contact_balances_summary`). */
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
 * Outstanding invoices G?? uses same payment/studio enrichment as mobile Sales list (not stale sales.due_amount).
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
        invoice_no: String(r.invoice_no ?? 'G??'),
        customer_name: String(cust?.name ?? r.customer_name ?? 'G??'),
        invoice_date: r.invoice_date ? new Date(String(r.invoice_date)).toISOString().slice(0, 10) : 'G??',
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

