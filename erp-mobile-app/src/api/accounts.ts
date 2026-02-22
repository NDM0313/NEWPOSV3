import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getNextDocumentNumber } from './documentNumber';

export interface AccountRow {
  id: string;
  code: string;
  name: string;
  type: string;
  balance: number;
}

/** Account types supported for Create Account (same as web ERP) */
export const ACCOUNT_TYPES = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank' },
  { value: 'mobile_wallet', label: 'Mobile Wallet' },
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'receivable', label: 'Receivable' },
  { value: 'payable', label: 'Payable' },
  { value: 'asset', label: 'Asset' },
  { value: 'liability', label: 'Liability' },
  { value: 'equity', label: 'Equity' },
  { value: 'revenue', label: 'Revenue' },
] as const;

/** Reserved codes for cash/bank/wallet – same as web ERP (AddAccountDrawer) */
const RESERVED_CODES: Record<string, string> = {
  cash: '1000',
  bank: '1010',
  mobile_wallet: '1020',
};

/** Next account code in same series as web: 1000/1001… (cash), 1010/1011/1012… (bank), 1020… (wallet), 2000… (others). */
async function getNextAccountCode(companyId: string, type: string): Promise<string> {
  const { data: existing } = await getAccounts(companyId);
  const codes = (existing || []).map((a) => (a.code || '').trim()).filter(Boolean);
  const typeLower = (type || '').toLowerCase().trim();
  const reserved = RESERVED_CODES[typeLower];

  if (reserved) {
    const prefix = reserved.slice(0, 3);
    const startSuffix = parseInt(reserved.slice(3), 10);
    const sameSeries = codes.filter((c) => c.length > prefix.length && c.startsWith(prefix) && /^\d+$/.test(c));
    const suffixes = sameSeries.map((c) => parseInt(c.slice(prefix.length), 10)).filter((n) => !Number.isNaN(n));
    const maxSuffix = suffixes.length ? Math.max(...suffixes) : startSuffix - 1;
    return prefix + (maxSuffix + 1);
  }

  const prefix = '200';
  const sameSeries = codes.filter((c) => c.length >= 3 && c.startsWith(prefix) && /^\d+$/.test(c));
  const suffixes = sameSeries.map((c) => parseInt(c.slice(3), 10)).filter((n) => !Number.isNaN(n));
  const maxSuffix = suffixes.length ? Math.max(...suffixes) : -1;
  return prefix + (maxSuffix + 1);
}

/** Create account (Chart of Accounts) – same backend and code numbering as web ERP. */
export async function createAccount(
  companyId: string,
  params: { code?: string; name: string; type: string; balance?: number; is_active?: boolean }
): Promise<{ data: AccountRow | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  const trimmedCode = (params.code || '').trim();
  const code = trimmedCode || (await getNextAccountCode(companyId, params.type || 'expense'));
  const payload = {
    company_id: companyId,
    code,
    name: (params.name || '').trim(),
    type: (params.type || 'expense').toLowerCase().trim(),
    balance: Number(params.balance) || 0,
    is_active: params.is_active !== false,
  };
  const { data, error } = await supabase.from('accounts').insert(payload).select('id, code, name, type, balance').single();
  if (error) return { data: null, error: error.message };
  const row = data as Record<string, unknown>;
  return {
    data: {
      id: String(row.id ?? ''),
      code: String(row.code ?? '—'),
      name: String(row.name ?? '—'),
      type: String(row.type ?? '—'),
      balance: Number(row.balance) || 0,
    },
    error: null,
  };
}

export async function getAccounts(companyId: string): Promise<{ data: AccountRow[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  const q = supabase
    .from('accounts')
    .select('id, code, name, type, balance')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('code');
  const { data, error } = await q;
  if (error) return { data: [], error: error.message };
  return {
    data: (data || []).map((r: Record<string, unknown>) => ({
      id: String(r.id ?? ''),
      code: String(r.code ?? '—'),
      name: String(r.name ?? '—'),
      type: String(r.type ?? '—'),
      balance: Number(r.balance) || 0,
    })),
    error: null,
  };
}

/** Payment accounts: cash, bank, wallet (for transfers) */
export async function getPaymentAccounts(companyId: string): Promise<{ data: AccountRow[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  const q = supabase
    .from('accounts')
    .select('id, code, name, type, balance')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .or('type.eq.cash,type.eq.bank,type.eq.asset,type.eq.mobile_wallet,is_default_cash.eq.true,is_default_bank.eq.true')
    .order('code');
  const { data, error } = await q;
  if (error) return { data: [], error: error.message };
  const rows = (data || []).map((r: Record<string, unknown>) => ({
    id: String(r.id ?? ''),
    code: String(r.code ?? '—'),
    name: String(r.name ?? '—'),
    type: String(r.type ?? '—'),
    balance: Number(r.balance) || 0,
  }));
  return { data: rows, error: null };
}

export interface JournalEntryRow {
  id: string;
  entry_no: string;
  entry_date: string;
  description: string;
  reference_type: string;
  total_debit: number;
  total_credit: number;
  lines?: { account_id: string; debit: number; credit: number; account?: { name: string } }[];
}

export async function getJournalEntries(
  companyId: string,
  branchId?: string | null,
  limit = 50
): Promise<{ data: JournalEntryRow[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  let q = supabase
    .from('journal_entries')
    .select(`
      id, entry_no, entry_date, description, reference_type,
      lines:journal_entry_lines(account_id, debit, credit, account:accounts(name))
    `)
    .eq('company_id', companyId)
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (branchId && branchId !== 'all') q = q.eq('branch_id', branchId);
  const { data, error } = await q;
  if (error) return { data: [], error: error.message };
  const rows = (data || []).map((e: Record<string, unknown>) => {
    const lines = (e.lines as Record<string, unknown>[] || []) as { account_id: string; debit: number; credit: number; account?: { name: string } }[];
    const totalDebit = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
    return {
      id: String(e.id ?? ''),
      entry_no: String(e.entry_no ?? ''),
      entry_date: e.entry_date ? new Date(e.entry_date as string).toISOString().slice(0, 10) : '',
      description: String(e.description ?? ''),
      reference_type: String(e.reference_type ?? ''),
      total_debit: totalDebit,
      total_credit: totalCredit,
      lines,
    };
  });
  return { data: rows, error: null };
}


/** Create journal entry (general entry or account transfer). Optional attachments (same as web). */
export async function createJournalEntry(params: {
  companyId: string;
  branchId?: string | null;
  entryDate: string;
  description: string;
  referenceType: string;
  lines: { accountId: string; debit: number; credit: number; description?: string }[];
  userId?: string | null;
  attachments?: { url: string; name: string }[] | null;
}): Promise<{ data: { id: string; entry_no: string } | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  const { companyId, branchId, entryDate, description, referenceType, lines, userId, attachments } = params;
  const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    return { data: null, error: 'Debit must equal Credit.' };
  }
  const entryNo = await getNextDocumentNumber(companyId, branchId ?? null, 'journal');
  const entryRow: Record<string, unknown> = {
    company_id: companyId,
    entry_no: entryNo,
    entry_date: entryDate,
    description,
    reference_type: referenceType,
    created_by: userId ?? null,
  };
  if (branchId && branchId !== 'all') entryRow.branch_id = branchId;
  if (attachments && attachments.length > 0) entryRow.attachments = attachments;

  let result = await supabase.from('journal_entries').insert(entryRow).select('id, entry_no').single();
  if (result.error && result.error.code === 'PGRST204' && result.error.message?.includes('attachments')) {
    delete entryRow.attachments;
    result = await supabase.from('journal_entries').insert(entryRow).select('id, entry_no').single();
  }
  const { data: entry, error: entryErr } = result;
  if (entryErr || !entry) return { data: null, error: entryErr?.message ?? 'Failed to create entry.' };

  for (const line of lines) {
    const { error: lineErr } = await supabase.from('journal_entry_lines').insert({
      journal_entry_id: entry.id,
      account_id: line.accountId,
      debit: line.debit,
      credit: line.credit,
      description: line.description ?? description,
    });
    if (lineErr) return { data: null, error: lineErr.message };
  }
  return { data: { id: entry.id, entry_no: entry.entry_no }, error: null };
}

export interface SupplierWithPayable {
  id: string;
  name: string;
  phone: string;
  totalPayable: number;
  lastPayment?: string;
}

/** Suppliers with outstanding from purchases */
export async function getSuppliersWithPayable(companyId: string): Promise<{ data: SupplierWithPayable[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  const { data: purchases, error: purErr } = await supabase
    .from('purchases')
    .select('id, supplier_id, supplier_name, due_amount, paid_amount, po_date')
    .eq('company_id', companyId)
    .gt('due_amount', 0)
    .is('cancelled_at', null);
  if (purErr) return { data: [], error: purErr.message };

  const bySupplier = new Map<string, { totalPayable: number; supplierName: string }>();
  for (const p of purchases || []) {
    const sid = (p.supplier_id as string) || `name:${p.supplier_name}`;
    const existing = bySupplier.get(sid) || { totalPayable: 0, supplierName: String(p.supplier_name ?? 'Unknown') };
    existing.totalPayable += Number(p.due_amount) || 0;
    if (p.supplier_name) existing.supplierName = String(p.supplier_name);
    bySupplier.set(sid, existing);
  }

  const supplierIds = [...new Set((purchases || []).map((p) => p.supplier_id).filter(Boolean))] as string[];
  let contacts: { id: string; name: string; phone?: string }[] = [];
  if (supplierIds.length > 0) {
    const { data: c } = await supabase.from('contacts').select('id, name, phone').in('id', supplierIds);
    contacts = c || [];
  }

  const result: SupplierWithPayable[] = [];
  for (const [entityId, info] of bySupplier) {
    if (entityId.startsWith('name:')) continue;
    const contact = contacts.find((c) => c.id === entityId);
    result.push({
      id: entityId,
      name: contact?.name ?? info.supplierName ?? 'Unknown',
      phone: contact?.phone ?? '',
      totalPayable: info.totalPayable,
      lastPayment: undefined,
    });
  }
  return { data: result, error: null };
}

export interface PurchaseWithDue {
  id: string;
  po_no: string;
  po_date: string;
  due_amount: number;
  total: number;
}

export async function getPurchasesBySupplier(companyId: string, supplierId: string): Promise<{ data: PurchaseWithDue[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  const { data, error } = await supabase
    .from('purchases')
    .select('id, po_no, po_date, due_amount, total')
    .eq('company_id', companyId)
    .eq('supplier_id', supplierId)
    .gt('due_amount', 0)
    .is('cancelled_at', null)
    .order('po_date', { ascending: true });
  if (error) return { data: [], error: error.message };
  return {
    data: (data || []).map((r: Record<string, unknown>) => ({
      id: String(r.id ?? ''),
      po_no: String(r.po_no ?? ''),
      po_date: r.po_date ? new Date(r.po_date as string).toISOString().slice(0, 10) : '',
      due_amount: Number(r.due_amount) || 0,
      total: Number(r.total) || 0,
    })),
    error: null,
  };
}

/** Record supplier payment via RPC */
export async function recordSupplierPayment(params: {
  companyId: string;
  branchId: string;
  purchaseId: string;
  amount: number;
  paymentDate: string;
  paymentAccountId: string;
  paymentMethod: 'cash' | 'bank' | 'card' | 'other';
  reference?: string;
  notes?: string;
  userId?: string;
}): Promise<{ data: { payment_id: string } | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  const refNum = params.reference ?? await getNextDocumentNumber(params.companyId, params.branchId, 'payment');
  const { data, error } = await supabase.rpc('record_payment_with_accounting', {
    p_company_id: params.companyId,
    p_branch_id: params.branchId,
    p_payment_type: 'paid',
    p_reference_type: 'purchase',
    p_reference_id: params.purchaseId,
    p_amount: params.amount,
    p_payment_method: params.paymentMethod,
    p_payment_date: params.paymentDate,
    p_payment_account_id: params.paymentAccountId,
    p_reference_number: refNum,
    p_notes: params.notes ?? null,
    p_created_by: params.userId ?? null,
  });
  if (error) return { data: null, error: error.message };
  const res = data as { success?: boolean; payment_id?: string; error?: string };
  if (res?.success && res.payment_id) return { data: { payment_id: res.payment_id }, error: null };
  return { data: null, error: res?.error ?? 'Payment failed.' };
}

export interface WorkerWithPayable {
  id: string;
  name: string;
  phone: string;
  type: string;
  totalPayable: number;
  weeklyRate?: number;
  lastPayment?: string;
}

/** Workers with outstanding (from workers table or worker_ledger) */
export async function getWorkersWithPayable(companyId: string): Promise<{ data: WorkerWithPayable[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  const { data: workers, error } = await supabase
    .from('workers')
    .select('id, name, phone, worker_type, current_balance, payment_rate')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('name');
  if (error) return { data: [], error: error.message };
  const list = (workers || []).map((w: Record<string, unknown>) => ({
    id: String(w.id ?? ''),
    name: String(w.name ?? '—'),
    phone: String(w.phone ?? ''),
    type: String(w.worker_type ?? 'worker'),
    totalPayable: Number(w.current_balance) || 0,
    weeklyRate: w.payment_rate ? Number(w.payment_rate) : undefined,
    lastPayment: undefined,
  }));
  return { data: list, error: null };
}

/** Record worker payment - insert into worker_ledger_entries */
export async function recordWorkerPayment(params: {
  companyId: string;
  workerId: string;
  amount: number;
  paymentDate: string;
  workPeriod?: string;
  notes?: string;
  paymentReference?: string;
}): Promise<{ data: { id: string } | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  const ref = params.paymentReference ?? await getNextDocumentNumber(params.companyId, null, 'payment');
  const { data, error } = await supabase
    .from('worker_ledger_entries')
    .insert({
      company_id: params.companyId,
      worker_id: params.workerId,
      amount: -params.amount,
      reference_type: 'payment',
      reference_id: null,
      document_no: ref,
      notes: params.notes ?? params.workPeriod ?? 'Worker payment',
      status: 'paid',
      paid_at: params.paymentDate,
      payment_reference: ref,
      entry_type: 'payment',
    })
    .select('id')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data ? { id: data.id } : null, error: null };
}
