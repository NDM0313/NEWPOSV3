import { erpMobileUsingDemoSupabaseAnonKey, isSupabaseConfigured, supabase } from '../lib/supabase';

/** Extra context when Postgres RPC exhausts PAY reference retries (wrong DB / missing migrations). */
function appendPayReferenceAllocationHint(message: string): string {
  if (!message.includes('Payment reference allocation')) return message;
  let out =
    `${message} Use the same VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY as the web app (.env.production); restart the dev server. Apply SQL migrations 20260509180000, 20260509190000, 20260510100000 on that database (one file: migrations/rollups/record_payment_allocation_fix_bundle.sql).`;
  if (erpMobileUsingDemoSupabaseAnonKey) {
    out += ' This session still uses the public Supabase tutorial anon key — replace it.';
  }
  return out;
}
import { getNextDocumentNumber } from './documentNumber';
import { getAccountBalancesFromJournal } from './accountBalancesFromJournal';
import { isLiquidityPaymentAccount } from '../lib/liquidityPaymentAccount';
import { isBrowserOffline, listCacheGet, listCacheKeys, listCacheSet } from '../lib/listCache';
import { resolveBranchUuidForWrite, safeRpcBranchId } from '../utils/branchId';
import { getCurrentLocalTimestamp, localNowDateString, toLocalDateString } from '../utils/localDate';
import { hasNormalizedAttachments } from '../lib/normalizeAttachments';
import {
  balanceRowFromMap,
  fetchContactPartyGlBalancesMap,
  fetchOperationalContactBalancesSummary,
  partyGlSliceFromMap,
  resolveContactListBalance,
} from './contactBalancesRpc';
import { normalizeCompanyId } from './contactBalancesUtils';
import {
  applyManualSupplierPaymentAllocations,
  sortSuppliersByPayable,
} from '../lib/supplierPaymentAllocation';

export interface AccountRow {
  id: string;
  code: string;
  name: string;
  type: string;
  balance: number;
  parentId?: string | null;
  isGroup?: boolean;
  isDefaultCash?: boolean;
  isDefaultBank?: boolean;
  /** Party-linked AR/AP sub-account — enables party GL ledger RPC on mobile. */
  linkedContactId?: string | null;
}

/** Operational roles — same as web AddAccountDrawer operational tab */
export const OPERATIONAL_ACCOUNT_ROLES = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank' },
  { value: 'mobile_wallet', label: 'Mobile Wallet' },
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'receivable', label: 'Receivable' },
  { value: 'payable', label: 'Payable' },
] as const;

/** @deprecated use OPERATIONAL_ACCOUNT_ROLES */
export const ACCOUNT_TYPES = OPERATIONAL_ACCOUNT_ROLES;

/** Reserved codes for cash/bank/wallet – same as web ERP (AddAccountDrawer) */
const RESERVED_CODES: Record<string, string> = {
  cash: '1000',
  bank: '1010',
  mobile_wallet: '1020',
};

const PAYMENT_METHOD_MAP: Record<string, 'cash' | 'bank' | 'card' | 'other'> = {
  cash: 'cash',
  bank: 'bank',
  card: 'card',
  cheque: 'other',
  check: 'other',
  wallet: 'other',
  mobile_wallet: 'other',
  mobilewallet: 'other',
  'mobile wallet': 'other',
  other: 'other',
};

function normalizePaymentMethod(method?: string): 'cash' | 'bank' | 'card' | 'other' {
  const m = String(method || 'cash').trim().toLowerCase();
  return PAYMENT_METHOD_MAP[m] || 'cash';
}

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

/** Create account (Chart of Accounts) – same backend, parent_id, and code rules as web ERP. */
export async function createAccount(
  companyId: string,
  params: {
    code?: string;
    name: string;
    type: string;
    balance?: number;
    is_active?: boolean;
    parent_id?: string | null;
  }
): Promise<{ data: AccountRow | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  const trimmedCode = (params.code || '').trim();
  let code = trimmedCode;
  if (!code) {
    if (params.parent_id) {
      const { data: existing } = await getAccounts(companyId);
      const list = existing || [];
      const parent = list.find((a) => a.id === params.parent_id);
      if (parent) {
        const { getNextChildAccountCode } = await import('../lib/addAccountCoaPicker');
        code = getNextChildAccountCode(
          { id: parent.id, code: parent.code, parent_id: parent.parentId ?? null },
          list.map((a) => ({ id: a.id, code: a.code, parent_id: a.parentId ?? null }))
        );
      }
    }
    if (!code) code = await getNextAccountCode(companyId, params.type || 'expense');
  }
  const payload: Record<string, unknown> = {
    company_id: companyId,
    code,
    name: (params.name || '').trim(),
    type: (params.type || 'expense').toLowerCase().trim(),
    balance: Number(params.balance) || 0,
    is_active: params.is_active !== false,
  };
  if (params.parent_id) payload.parent_id = params.parent_id;
  const { data, error } = await supabase
    .from('accounts')
    .insert(payload)
    .select('id, code, name, type, balance, parent_id, is_group')
    .single();
  if (error) return { data: null, error: error.message };
  const row = data as Record<string, unknown>;
  return {
    data: {
      id: String(row.id ?? ''),
      code: String(row.code ?? '—'),
      name: String(row.name ?? '—'),
      type: String(row.type ?? '—'),
      balance: Number(row.balance) || 0,
      parentId: row.parent_id != null ? String(row.parent_id) : null,
      isGroup: row.is_group === true,
    },
    error: null,
  };
}

export async function getAccounts(companyId: string): Promise<{ data: AccountRow[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  const withLink = await supabase
    .from('accounts')
    .select('id, code, name, type, balance, parent_id, is_group, linked_contact_id')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('code');
  let rows: Record<string, unknown>[] = (withLink.data || []) as Record<string, unknown>[];
  let error = withLink.error;
  if (error && /linked_contact|column/i.test(String(error.message || ''))) {
    const mid = await supabase
      .from('accounts')
      .select('id, code, name, type, balance, parent_id, is_group')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('code');
    rows = (mid.data || []) as Record<string, unknown>[];
    error = mid.error;
    if (error && /parent_id|is_group|column/i.test(String(error.message || ''))) {
      const minimal = await supabase
        .from('accounts')
        .select('id, code, name, type, balance')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('code');
      rows = (minimal.data || []) as Record<string, unknown>[];
      error = minimal.error;
    }
  }
  if (error) return { data: [], error: error.message };
  return {
    data: rows.map((r) => ({
      id: String(r.id ?? ''),
      code: String(r.code ?? '—'),
      name: String(r.name ?? '—'),
      type: String(r.type ?? '—'),
      balance: Number(r.balance) || 0,
      parentId: r['parent_id'] != null && String(r['parent_id']).trim() !== '' ? String(r['parent_id']) : null,
      isGroup: r['is_group'] === true,
      linkedContactId:
        r['linked_contact_id'] != null && String(r['linked_contact_id']).trim() !== ''
          ? String(r['linked_contact_id'])
          : null,
    })),
    error: null,
  };
}

function mapPaymentAccountRow(r: Record<string, unknown>): AccountRow {
  return {
    id: String(r.id ?? ''),
    code: String(r.code ?? '—'),
    name: String(r.name ?? '—'),
    type: String(r.type ?? '—'),
    balance: Number(r.balance) || 0,
    isDefaultCash: r.is_default_cash === true,
    isDefaultBank: r.is_default_bank === true,
  };
}

function isLiquidityPaymentAccountRow(acc: AccountRow): boolean {
  return isLiquidityPaymentAccount({
    code: acc.code,
    name: acc.name,
    type: acc.type,
    is_active: true,
  });
}

async function mergeJournalBalances(
  companyId: string,
  rows: AccountRow[],
): Promise<AccountRow[]> {
  const { map: journalBalances, error: jbErr } = await getAccountBalancesFromJournal(companyId);
  if (jbErr) return rows;
  return rows.map((acc) => ({
    ...acc,
    balance: journalBalances.get(acc.id) ?? 0,
  }));
}

/** Overlay journal net balances (debit − credit) onto account rows — GL truth for list UIs. */
export async function overlayAccountBalancesFromJournal(
  companyId: string,
  rows: AccountRow[],
): Promise<AccountRow[]> {
  return mergeJournalBalances(companyId, rows);
}

/** Payment accounts: cash, bank, mobile wallet only (no generic asset / AR / etc.). */
export async function getPaymentAccounts(companyId: string): Promise<{ data: AccountRow[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  const cacheKey = listCacheKeys.paymentAccounts(companyId);
  if (isBrowserOffline()) {
    const cached = await listCacheGet<AccountRow[]>(cacheKey);
    const filtered = (cached ?? []).filter((a) => isLiquidityPaymentAccountRow(a));
    return {
      data: filtered,
      error: filtered.length ? null : 'Offline: payment accounts not cached. Connect once while logged in.',
    };
  }
  const withDefaults = await supabase
    .from('accounts')
    .select('id, code, name, type, balance, is_default_cash, is_default_bank')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .or('is_group.eq.false,is_group.is.null')
    .order('code');
  let rawRows: Record<string, unknown>[] = (withDefaults.data || []) as Record<string, unknown>[];
  let error = withDefaults.error;
  if (error && /is_default_cash|is_default_bank|column/i.test(String(error.message || ''))) {
    const fallback = await supabase
      .from('accounts')
      .select('id, code, name, type, balance')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .or('is_group.eq.false,is_group.is.null')
      .order('code');
    rawRows = (fallback.data || []) as Record<string, unknown>[];
    error = fallback.error;
  }
  if (error) return { data: [], error: error.message };
  const liquidityRows = rawRows.map(mapPaymentAccountRow).filter(isLiquidityPaymentAccountRow);
  const rows = await mergeJournalBalances(companyId, liquidityRows);
  void listCacheSet(cacheKey, rows);
  return { data: rows, error: null };
}

export interface JournalEntryLineRow {
  account_id: string;
  debit: number;
  credit: number;
  description?: string | null;
  account?: { name: string; code?: string | null };
}

export interface JournalEntryRow {
  id: string;
  entry_no: string;
  /** Payments voucher no (PAY-xx / RCV-xx) when this JE links via payment_id — preferred list label over JE entry_no. */
  payment_reference_number?: string | null;
  /** Expense document no (EXP-xx) — preferred over PAY for expense JEs. */
  display_expense_no?: string | null;
  entry_date: string;
  description: string;
  reference_type: string;
  reference_id?: string | null;
  payment_id?: string | null;
  payment_notes?: string | null;
  /** From linked payments row — received = cash in (RCV), paid = cash out (PAY). */
  payment_type?: 'received' | 'paid' | null;
  total_debit: number;
  total_credit: number;
  posted_at?: string | null;
  created_at?: string | null;
  lines?: JournalEntryLineRow[];
  attachments?: unknown;
  hasAttachments?: boolean;
}

function normalizeJeLines(raw: unknown): JournalEntryLineRow[] {
  const lines = (raw as Record<string, unknown>[] | null) || [];
  return lines.map((line) => {
    let acc = line.account as { name?: string; code?: string | null } | { name?: string; code?: string | null }[] | undefined;
    if (Array.isArray(acc)) acc = acc[0];
    return {
      account_id: String(line.account_id ?? ''),
      debit: Number(line.debit ?? 0),
      credit: Number(line.credit ?? 0),
      description: line.description != null ? String(line.description) : null,
      account: acc?.name
        ? { name: String(acc.name), code: acc.code != null ? String(acc.code) : null }
        : undefined,
    };
  });
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
      id, entry_no, entry_date, description, reference_type, reference_id, payment_id,
      posted_at, created_at, attachments,
      lines:journal_entry_lines(account_id, debit, credit, description, account:accounts(name, code))
    `)
    .eq('company_id', companyId)
    .or('is_void.is.null,is_void.eq.false')
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (branchId && branchId !== 'all' && branchId !== 'default') q = q.eq('branch_id', branchId);
  const { data, error } = await q;
  if (error) return { data: [], error: error.message };
  const paymentIds = Array.from(
    new Set(
      (data || [])
        .map((e: Record<string, unknown>) => (e.payment_id != null ? String(e.payment_id) : ''))
        .filter((id) => id !== ''),
    ),
  );
  const paymentNotesById = new Map<string, string | null>();
  const paymentRefNoById = new Map<string, string | null>();
  const paymentTypeById = new Map<string, 'received' | 'paid' | null>();
  const paymentAttachmentsById = new Map<string, unknown>();
  const paymentExpenseIdById = new Map<string, string>();
  const expenseIdsForNo = new Set<string>();
  (data || []).forEach((e: Record<string, unknown>) => {
    const rt = String(e.reference_type ?? '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '_');
    if (rt === 'expense' && e.reference_id) expenseIdsForNo.add(String(e.reference_id));
  });
  if (paymentIds.length > 0) {
    const { data: paymentRows } = await supabase
      .from('payments')
      .select('id, notes, reference_number, payment_type, attachments, reference_type, reference_id')
      .in('id', paymentIds);
    for (const row of paymentRows || []) {
      const id = String((row as Record<string, unknown>).id ?? '');
      if (!id) continue;
      const notes = (row as Record<string, unknown>).notes;
      paymentNotesById.set(id, notes != null && String(notes).trim() !== '' ? String(notes) : null);
      const rn = (row as Record<string, unknown>).reference_number;
      paymentRefNoById.set(
        id,
        rn != null && String(rn).trim() !== '' ? String(rn).trim() : null,
      );
      const pt = String((row as Record<string, unknown>).payment_type ?? '').trim().toLowerCase();
      paymentTypeById.set(id, pt === 'received' ? 'received' : pt === 'paid' ? 'paid' : null);
      paymentAttachmentsById.set(id, (row as Record<string, unknown>).attachments);
      const payRt = String((row as Record<string, unknown>).reference_type ?? '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '_');
      const payRefId = (row as Record<string, unknown>).reference_id;
      if (payRt === 'expense' && payRefId) {
        const eid = String(payRefId);
        paymentExpenseIdById.set(id, eid);
        expenseIdsForNo.add(eid);
      }
    }
  }
  const expenseNoById = new Map<string, string>();
  if (expenseIdsForNo.size > 0) {
    const { data: expRows } = await supabase
      .from('expenses')
      .select('id, expense_no')
      .in('id', [...expenseIdsForNo]);
    for (const row of expRows || []) {
      const id = String((row as Record<string, unknown>).id ?? '');
      const no = String((row as Record<string, unknown>).expense_no ?? '').trim();
      if (id && no) expenseNoById.set(id, no);
    }
  }
  const rows = (data || []).map((e: Record<string, unknown>) => {
    const lines = normalizeJeLines(e.lines);
    const totalDebit = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
    const paymentId = e.payment_id != null && e.payment_id !== '' ? String(e.payment_id) : null;
    const jeAttachments = e.attachments;
    const payAttachments = paymentId ? paymentAttachmentsById.get(paymentId) : null;
    const hasAttachments =
      hasNormalizedAttachments(jeAttachments) || hasNormalizedAttachments(payAttachments);
    const refType = String(e.reference_type ?? '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '_');
    const expenseId =
      refType === 'expense' && e.reference_id
        ? String(e.reference_id)
        : paymentId
          ? paymentExpenseIdById.get(paymentId)
          : undefined;
    const displayExpenseNo = expenseId ? expenseNoById.get(expenseId) ?? null : null;
    return {
      id: String(e.id ?? ''),
      entry_no: String(e.entry_no ?? ''),
      payment_reference_number: paymentId ? paymentRefNoById.get(paymentId) ?? null : null,
      display_expense_no: displayExpenseNo,
      entry_date: e.entry_date ? toLocalDateString(e.entry_date as string) : '',
      description: String(e.description ?? ''),
      reference_type: String(e.reference_type ?? ''),
      reference_id: e.reference_id != null && e.reference_id !== '' ? String(e.reference_id) : null,
      payment_id: paymentId,
      payment_notes: paymentId ? paymentNotesById.get(paymentId) ?? null : null,
      payment_type: paymentId ? paymentTypeById.get(paymentId) ?? null : null,
      total_debit: totalDebit,
      total_credit: totalCredit,
      posted_at: (e as { posted_at?: string }).posted_at
        ? String((e as { posted_at?: string }).posted_at)
        : null,
      created_at: (e as { created_at?: string }).created_at
        ? String((e as { created_at?: string }).created_at)
        : null,
      lines,
      attachments: jeAttachments,
      hasAttachments,
      _expenseRefId:
        refType === 'expense' || refType === 'expense_payment'
          ? e.reference_id != null && String(e.reference_id).trim() !== ''
            ? String(e.reference_id)
            : null
          : expenseId ?? null,
    };
  });

  const expenseIdsNeedingCheck = rows
    .filter((r) => !r.hasAttachments && r._expenseRefId)
    .map((r) => r._expenseRefId as string);
  if (expenseIdsNeedingCheck.length > 0) {
    const { batchExpenseIdsWithReceiptUrl } = await import('../lib/loadMergedAttachments');
    const withReceipt = await batchExpenseIdsWithReceiptUrl(companyId, expenseIdsNeedingCheck);
    for (const row of rows) {
      if (!row.hasAttachments && row._expenseRefId && withReceipt.has(row._expenseRefId)) {
        row.hasAttachments = true;
      }
    }
  }

  return {
    data: rows.map(({ _expenseRefId: _, ...rest }) => rest as JournalEntryRow),
    error: null,
  };
}


/** Full journal entry with lines (for detail sheet). */
export async function getJournalEntryById(
  companyId: string,
  journalEntryId: string
): Promise<{ data: JournalEntryRow | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  const { data: e, error } = await supabase
    .from('journal_entries')
    .select(
      `
      id, entry_no, entry_date, description, reference_type, reference_id, payment_id,
      posted_at, created_at, attachments,
      lines:journal_entry_lines(account_id, debit, credit, description, account:accounts(name, code))
    `
    )
    .eq('company_id', companyId)
    .eq('id', journalEntryId)
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  if (!e) return { data: null, error: null };
  let paymentNotes: string | null = null;
  let paymentReferenceNumber: string | null = null;
  let paymentType: 'received' | 'paid' | null = null;
  let paymentRow: Record<string, unknown> | null = null;
  const paymentIdRaw = e.payment_id != null && e.payment_id !== '' ? String(e.payment_id) : null;
  if (paymentIdRaw) {
    const { data: payData } = await supabase
      .from('payments')
      .select('notes, reference_number, payment_type, attachments')
      .eq('id', paymentIdRaw)
      .maybeSingle();
    paymentRow = (payData as Record<string, unknown> | null) ?? null;
    const notesVal = paymentRow?.notes;
    paymentNotes = notesVal != null && String(notesVal).trim() !== '' ? String(notesVal) : null;
    const rnVal = paymentRow?.reference_number;
    paymentReferenceNumber =
      rnVal != null && String(rnVal).trim() !== '' ? String(rnVal).trim() : null;
    const ptVal = String(paymentRow?.payment_type ?? '')
      .trim()
      .toLowerCase();
    paymentType = ptVal === 'received' ? 'received' : ptVal === 'paid' ? 'paid' : null;
  }
  const lines = normalizeJeLines(e.lines);
  const totalDebit = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
  const jeAttachments = (e as { attachments?: unknown }).attachments;
  const payAttachments = paymentRow?.attachments ?? null;
  const hasAttachments =
    hasNormalizedAttachments(jeAttachments) || hasNormalizedAttachments(payAttachments);
  return {
    data: {
      id: String(e.id ?? ''),
      entry_no: String(e.entry_no ?? ''),
      entry_date: e.entry_date ? toLocalDateString(e.entry_date as string) : '',
      description: String(e.description ?? ''),
      reference_type: String(e.reference_type ?? ''),
      reference_id: e.reference_id != null && e.reference_id !== '' ? String(e.reference_id) : null,
      payment_id: paymentIdRaw,
      payment_notes: paymentNotes,
      payment_type: paymentType,
      payment_reference_number: paymentReferenceNumber,
      total_debit: totalDebit,
      total_credit: totalCredit,
      posted_at: (e as { posted_at?: string }).posted_at ? String((e as { posted_at?: string }).posted_at) : null,
      created_at: (e as { created_at?: string }).created_at ? String((e as { created_at?: string }).created_at) : null,
      lines,
      attachments: jeAttachments,
      hasAttachments,
    },
    error: null,
  };
}

/** Account ledger entry for one account (date, voucher, description, debit, credit, running balance) */
export interface AccountLedgerLine {
  id: string;
  date: string;
  entry_no: string;
  description: string;
  debit: number;
  credit: number;
  running_balance: number;
  reference_type?: string;
}

/** Get account-wise ledger for date range (journal_entry_lines + journal_entries). */
export async function getAccountLedger(
  _companyId: string,
  accountId: string,
  dateFrom?: string,
  dateTo?: string
): Promise<{ data: AccountLedgerLine[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  let q = supabase
    .from('journal_entry_lines')
    .select(`
      id, debit, credit, description,
      journal_entry:journal_entries(id, entry_no, entry_date, description, reference_type)
    `)
    .eq('account_id', accountId)
    .order('created_at', { ascending: true });
  const { data: lines, error } = await q;
  if (error) return { data: [], error: error.message };

  type Je = { id?: string; entry_no?: string; entry_date?: string; description?: string; reference_type?: string };
  const rows = (lines || []) as Array<{
    id: string;
    debit: number;
    credit: number;
    description?: string;
    journal_entry?: Je | Je[] | null;
  }>;
  let runningBalance = 0;
  const result: AccountLedgerLine[] = [];
  let openingAdded = false;
  for (const line of rows) {
    const je = Array.isArray(line.journal_entry) ? line.journal_entry[0] : line.journal_entry;
    const entryDate = je?.entry_date ? toLocalDateString(je.entry_date as string) : '';
    if (dateFrom && entryDate < dateFrom) {
      runningBalance += Number(line.debit ?? 0) - Number(line.credit ?? 0);
      continue;
    }
    if (dateTo && entryDate > dateTo) continue;
    if (dateFrom && !openingAdded && runningBalance !== 0) {
      result.push({
        id: 'opening',
        date: dateFrom,
        entry_no: '—',
        description: 'Opening Balance',
        debit: 0,
        credit: 0,
        running_balance: runningBalance,
      });
      openingAdded = true;
    }
    runningBalance += Number(line.debit ?? 0) - Number(line.credit ?? 0);
    result.push({
      id: String(line.id ?? ''),
      date: entryDate,
      entry_no: String(je?.entry_no ?? '—'),
      description: String(line.description ?? je?.description ?? ''),
      debit: Number(line.debit ?? 0),
      credit: Number(line.credit ?? 0),
      running_balance: runningBalance,
      reference_type: je?.reference_type ? String(je.reference_type) : undefined,
    });
  }
  return { data: result, error: null };
}


/** Create journal entry (general entry or account transfer). Optional attachments (same as web). */
export async function createJournalEntry(params: {
  companyId: string;
  branchId?: string | null;
  entryDate: string;
  description: string;
  referenceType: string;
  /** When set (e.g. sale id for sale_adjustment), links GL row to the document. */
  referenceId?: string | null;
  /** PF-14 style idempotency key; requires DB column + unique partial index when used. */
  actionFingerprint?: string | null;
  lines: { accountId: string; debit: number; credit: number; description?: string }[];
  userId?: string | null;
  attachments?: { url: string; name: string }[] | null;
}): Promise<{ data: { id: string; entry_no: string } | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  const { companyId, branchId, entryDate, description, referenceType, referenceId, actionFingerprint, lines, userId, attachments } = params;
  const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    return { data: null, error: 'Debit must equal Credit.' };
  }
  let resolvedBranchId: string;
  try {
    resolvedBranchId = await resolveBranchUuidForWrite(
      companyId,
      branchId,
      'No branch set up. Add a branch in Settings to continue.',
    );
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'No branch set up.' };
  }
  const entryNo = await getNextDocumentNumber(companyId, resolvedBranchId, 'journal');
  const entryRow: Record<string, unknown> = {
    company_id: companyId,
    entry_no: entryNo,
    entry_date: entryDate,
    description,
    reference_type: referenceType,
    created_by: userId ?? null,
    branch_id: resolvedBranchId,
  };
  if (referenceId) entryRow.reference_id = referenceId;
  if (actionFingerprint) entryRow.action_fingerprint = actionFingerprint;
  if (attachments && attachments.length > 0) entryRow.attachments = attachments;

  let result = await supabase.from('journal_entries').insert(entryRow).select('id, entry_no').single();
  if (result.error && result.error.code === 'PGRST204' && result.error.message?.includes('attachments')) {
    delete entryRow.attachments;
    result = await supabase.from('journal_entries').insert(entryRow).select('id, entry_no').single();
  }
  if (result.error && result.error.code === 'PGRST204' && String(result.error.message || '').includes('action_fingerprint')) {
    delete entryRow.action_fingerprint;
    result = await supabase.from('journal_entries').insert(entryRow).select('id, entry_no').single();
  }
  if (result.error && result.error.code === 'PGRST204' && String(result.error.message || '').toLowerCase().includes('reference_id')) {
    delete entryRow.reference_id;
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

  const effectiveBranch = resolvedBranchId;
  try {
    const { ensurePaymentsForLiquidityJournal } = await import('../lib/journalLiquidityPayment');
    await ensurePaymentsForLiquidityJournal({
      companyId,
      branchId: effectiveBranch,
      journalEntryId: entry.id,
      entryNo: entry.entry_no,
      entryDate,
      description,
      lines: lines.map((l) => ({
        accountId: l.accountId,
        debit: l.debit,
        credit: l.credit,
      })),
      createdBy: userId ?? null,
    });
  } catch {
    /* Roznamcha read path still picks up journal liquidity legs if payment insert fails */
  }

  return { data: { id: entry.id, entry_no: entry.entry_no }, error: null };
}

export interface JournalEntryEditPayload {
  companyId: string;
  journalEntryId: string;
  entryDate: string;
  description: string;
  debitAccountId: string;
  creditAccountId: string;
  amount: number;
}

export interface JournalEntryEditRow {
  id: string;
  companyId: string;
  entryNo: string;
  entryDate: string;
  description: string;
  referenceType: string;
  referenceId: string | null;
  paymentId: string | null;
  attachments?: unknown;
  debitAccountId: string | null;
  creditAccountId: string | null;
  amount: number;
}

export async function getJournalEntryForEdit(
  companyId: string,
  journalEntryId: string
): Promise<{ data: JournalEntryEditRow | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  const { data: je, error: jeErr } = await supabase
    .from('journal_entries')
    .select('id, company_id, entry_no, entry_date, description, reference_type, reference_id, payment_id, attachments')
    .eq('company_id', companyId)
    .eq('id', journalEntryId)
    .maybeSingle();
  if (jeErr || !je) return { data: null, error: jeErr?.message || 'Journal entry not found.' };

  const { data: lines, error: linesErr } = await supabase
    .from('journal_entry_lines')
    .select('id, account_id, debit, credit')
    .eq('journal_entry_id', journalEntryId);
  if (linesErr || !lines?.length) return { data: null, error: linesErr?.message || 'Journal lines not found.' };

  const debitLine = lines.find((l) => Number(l.debit || 0) > 0) || null;
  const creditLine = lines.find((l) => Number(l.credit || 0) > 0) || null;
  const amount = Number(debitLine?.debit || creditLine?.credit || 0) || 0;

  return {
    data: {
      id: String(je.id),
      companyId: String(je.company_id),
      entryNo: String(je.entry_no ?? ''),
      entryDate: String(je.entry_date ?? '').slice(0, 10),
      description: String(je.description ?? ''),
      referenceType: String(je.reference_type ?? ''),
      referenceId: je.reference_id ? String(je.reference_id) : null,
      paymentId:
        je.payment_id != null && String(je.payment_id).trim() !== '' ? String(je.payment_id) : null,
      attachments: (je as { attachments?: unknown }).attachments,
      debitAccountId: debitLine?.account_id ? String(debitLine.account_id) : null,
      creditAccountId: creditLine?.account_id ? String(creditLine.account_id) : null,
      amount,
    },
    error: null,
  };
}

export async function updateJournalEntryInPlace(
  payload: JournalEntryEditPayload
): Promise<{ data: { id: string } | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  const amount = Number(payload.amount) || 0;
  if (amount <= 0) return { data: null, error: 'Amount must be greater than zero.' };

  const { data: je, error: jeErr } = await supabase
    .from('journal_entries')
    .select('id, reference_type, reference_id, entry_no, branch_id, payment_id')
    .eq('company_id', payload.companyId)
    .eq('id', payload.journalEntryId)
    .maybeSingle();
  if (jeErr || !je) return { data: null, error: jeErr?.message || 'Journal entry not found.' };

  const { data: lines, error: linesErr } = await supabase
    .from('journal_entry_lines')
    .select('id, debit, credit')
    .eq('journal_entry_id', payload.journalEntryId);
  if (linesErr || !lines?.length) return { data: null, error: linesErr?.message || 'Journal lines not found.' };
  const debitLine = lines.find((l) => Number(l.debit || 0) > 0) || lines[0];
  const creditLine = lines.find((l) => Number(l.credit || 0) > 0) || lines.find((l) => l.id !== debitLine.id) || lines[0];

  const { error: entryErr } = await supabase
    .from('journal_entries')
    .update({
      entry_date: payload.entryDate,
      description: payload.description,
      updated_at: getCurrentLocalTimestamp(),
    })
    .eq('id', payload.journalEntryId)
    .eq('company_id', payload.companyId);
  if (entryErr) return { data: null, error: entryErr.message };

  const lineUpdates = [
    { id: debitLine.id, account_id: payload.debitAccountId, debit: amount, credit: 0 },
    { id: creditLine.id, account_id: payload.creditAccountId, debit: 0, credit: amount },
  ];
  for (const update of lineUpdates) {
    const { error } = await supabase
      .from('journal_entry_lines')
      .update({
        account_id: update.account_id,
        debit: update.debit,
        credit: update.credit,
      })
      .eq('id', update.id);
    if (error) return { data: null, error: error.message };
  }

  // Keep expense header in sync when editing an expense journal in-place.
  const refType = String(je.reference_type ?? '').toLowerCase();
  if ((refType === 'expense' || refType === 'expense_payment') && je.reference_id) {
    await supabase
      .from('expenses')
      .update({
        amount,
        expense_date: payload.entryDate,
        description: payload.description,
        updated_at: getCurrentLocalTimestamp(),
      })
      .eq('id', je.reference_id as string)
      .eq('company_id', payload.companyId);
  }

  const lineInputs = [
    { accountId: payload.debitAccountId, debit: amount, credit: 0 },
    { accountId: payload.creditAccountId, debit: 0, credit: amount },
  ];
  const entryNo = String(je.entry_no || '').trim();
  const paymentId = String(je.payment_id || '').trim();
  const isManualJournal =
    refType === 'journal' || refType === 'manual' || refType === 'general' || refType === 'transfer';

  if (isManualJournal) {
    try {
      const {
        syncLiquidityPaymentForJournal,
        syncExistingLiquidityPaymentsForJournal,
        ensurePaymentsForLiquidityJournal,
      } = await import('../lib/journalLiquidityPayment');
      if (paymentId) {
        await syncLiquidityPaymentForJournal({
          companyId: payload.companyId,
          paymentId,
          entryNo,
          entryDate: payload.entryDate,
          description: payload.description,
          lines: lineInputs,
        });
      } else {
        const { syncedCount } = await syncExistingLiquidityPaymentsForJournal({
          companyId: payload.companyId,
          journalEntryId: payload.journalEntryId,
          entryNo,
          entryDate: payload.entryDate,
          description: payload.description,
          lines: lineInputs,
        });
        if (syncedCount === 0) {
          await ensurePaymentsForLiquidityJournal({
            companyId: payload.companyId,
            branchId: je.branch_id ?? null,
            journalEntryId: payload.journalEntryId,
            entryNo,
            entryDate: payload.entryDate,
            description: payload.description,
            lines: lineInputs,
            createdBy: null,
          });
        }
      }
    } catch {
      /* best-effort roznamcha payment sync */
    }
  }

  return { data: { id: payload.journalEntryId }, error: null };
}

export interface SupplierWithPayable {
  id: string;
  name: string;
  phone: string;
  totalPayable: number;
  lastPayment?: string;
}

/** All active supplier/both contacts with GL/operational payable (includes Rs. 0 for advance). */
export async function getAllSuppliersWithPayable(
  companyId: string,
  branchId?: string | null,
): Promise<{ data: SupplierWithPayable[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  const company = normalizeCompanyId(companyId);
  if (!company) return { data: [], error: 'Missing company.' };

  const { data: contacts, error: contactsErr } = await supabase
    .from('contacts')
    .select('id, name, phone, mobile, type, opening_balance, is_active')
    .eq('company_id', company)
    .in('type', ['supplier', 'both'])
    .order('name');
  if (contactsErr) return { data: [], error: contactsErr.message };

  const active = (contacts || []).filter(
    (c: { is_active?: boolean | null }) => c.is_active !== false,
  );
  if (!active.length) return { data: [], error: null };

  const [partyGl, opSummary] = await Promise.all([
    fetchContactPartyGlBalancesMap(company, branchId),
    fetchOperationalContactBalancesSummary(company, branchId),
  ]);
  const glOk = partyGl.error == null;

  const list: SupplierWithPayable[] = active.map(
    (row: {
      id: string;
      name: string;
      phone?: string | null;
      mobile?: string | null;
      type?: string;
      opening_balance?: number | null;
    }) => {
      const opening = Number(row.opening_balance ?? 0);
      const totalPayable = resolveContactListBalance({
        opening,
        contactType: row.type || 'supplier',
        listRole: 'supplier',
        glOk,
        glSlice: partyGlSliceFromMap(partyGl.map, row.id),
        opRow: balanceRowFromMap(opSummary.map, row.id),
      });
      return {
        id: row.id,
        name: row.name || '',
        phone: String(row.phone ?? row.mobile ?? '').trim(),
        totalPayable: Math.max(0, totalPayable),
        lastPayment: undefined,
      };
    },
  );

  return { data: sortSuppliersByPayable(list), error: null };
}

/** @deprecated Prefer getAllSuppliersWithPayable — kept for callers that only need open-purchase suppliers. */
export async function getSuppliersWithPayable(companyId: string): Promise<{ data: SupplierWithPayable[]; error: string | null }> {
  return getAllSuppliersWithPayable(companyId, null);
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
      po_date: r.po_date ? toLocalDateString(r.po_date as string) : '',
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
  paymentAt?: string | null;
  paymentAccountId: string;
  paymentMethod: 'cash' | 'bank' | 'card' | 'other';
  reference?: string;
  notes?: string;
  userId?: string;
  attachments?: { url: string; name: string }[] | null;
}): Promise<{ data: { payment_id: string; reference_number?: string | null } | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  let branchResolved: string;
  try {
    branchResolved = await resolveBranchUuidForWrite(
      params.companyId,
      params.branchId,
      'No branch set up. Add a branch in Settings to record payments.',
    );
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Branch required for payment.' };
  }
  const baseNotes = params.notes?.trim() ?? '';
  const bankTraceId = params.reference?.trim() ?? '';
  const composedNotes = bankTraceId
    ? `${baseNotes ? `${baseNotes} | ` : ''}Bank Trace ID: ${bankTraceId}`
    : baseNotes;
  const { data, error } = await supabase.rpc('record_payment_with_accounting', {
    p_company_id: params.companyId,
    p_branch_id: branchResolved,
    p_payment_type: 'paid',
    p_reference_type: 'purchase',
    p_reference_id: params.purchaseId,
    p_amount: params.amount,
    p_payment_method: params.paymentMethod,
    p_payment_date: params.paymentDate,
    p_payment_account_id: params.paymentAccountId,
    p_reference_number: null,
    p_notes: composedNotes || null,
    p_created_by: params.userId ?? null,
    p_worker_stage_id: null,
  });
  if (error) {
    let msg = error.message;
    if (msg.includes('payment_status') && msg.includes('text')) {
      msg +=
        ' Apply migration migrations/20260449_record_payment_with_accounting_payment_status_cast.sql on Postgres (then NOTIFY pgrst reload if self-hosted).';
    }
    return { data: null, error: appendPayReferenceAllocationHint(msg) };
  }
  const res = data as { success?: boolean; payment_id?: string; error?: string };
  if (res?.success && res.payment_id) {
    if (params.paymentAt) {
      const { patchPaymentCreatedAt } = await import('./paymentTimestamp');
      await patchPaymentCreatedAt(res.payment_id, params.paymentAt);
    }
    if (params.attachments?.length) {
      const patch = { attachments: params.attachments };
      let upd = await supabase.from('payments').update(patch).eq('id', res.payment_id);
      if (upd.error?.code === 'PGRST204' && String(upd.error.message || '').includes('attachments')) {
        // attachments column unavailable — payment still valid
      } else if (upd.error) {
        return {
          data: { payment_id: res.payment_id, reference_number: (res as { reference_number?: string | null }).reference_number ?? null },
          error: `Payment recorded but attachments could not be linked: ${upd.error.message}`,
        };
      }
    }
    const rpcRef = (res as { reference_number?: string | null }).reference_number ?? null;
    return { data: { payment_id: res.payment_id, reference_number: rpcRef }, error: null };
  }
  let rpcErr = res?.error ?? 'Payment failed.';
  if (
    typeof rpcErr === 'string' &&
    rpcErr.includes('payment_status') &&
    (rpcErr.includes('text') || rpcErr.includes('type payment_status'))
  ) {
    rpcErr +=
      ' Apply migration migrations/20260449_record_payment_with_accounting_payment_status_cast.sql on Postgres.';
  }
  return {
    data: null,
    error:
      typeof rpcErr === 'string' ? appendPayReferenceAllocationHint(rpcErr) : rpcErr,
  };
}

/**
 * On-account / manual supplier payment: Dr AP, Cr Cash/Bank via record_payment_with_accounting,
 * then FIFO-allocate to open purchase bills (web createManualSupplierPayment parity).
 */
export async function recordManualSupplierPayment(params: {
  companyId: string;
  branchId: string | null;
  supplierContactId: string;
  supplierName: string;
  amount: number;
  paymentDate: string;
  paymentAt?: string | null;
  paymentAccountId: string;
  paymentMethod: 'cash' | 'bank' | 'card' | 'other' | 'wallet';
  reference?: string;
  notes?: string;
  userId?: string | null;
  attachments?: { url: string; name: string }[] | null;
}): Promise<{ data: { payment_id: string; reference_number?: string | null } | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  if (!params.companyId || !params.supplierContactId || params.amount <= 0 || !params.paymentAccountId) {
    return { data: null, error: 'Company, supplier, amount and account are required.' };
  }
  let branchResolved: string;
  try {
    branchResolved = await resolveBranchUuidForWrite(
      params.companyId,
      params.branchId,
      'No branch set up. Add a branch in Settings to record payments.',
    );
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Branch required for payment.' };
  }

  const baseNotes = params.notes?.trim() ?? '';
  const bankTraceId = params.reference?.trim() ?? '';
  const composedNotes = bankTraceId
    ? `${baseNotes ? `${baseNotes} | ` : ''}Bank Trace ID: ${bankTraceId}`
    : baseNotes || `Manual payment to ${params.supplierName}`;

  const methodMap: Record<string, 'cash' | 'bank' | 'card' | 'other'> = {
    cash: 'cash',
    bank: 'bank',
    card: 'card',
    wallet: 'other',
    other: 'other',
  };
  const enumMethod = methodMap[String(params.paymentMethod).toLowerCase()] || 'cash';

  const { data: authData } = await supabase.auth.getUser();
  const createdBy = params.userId ?? authData?.user?.id ?? null;

  const { data, error } = await supabase.rpc('record_payment_with_accounting', {
    p_company_id: params.companyId,
    p_branch_id: branchResolved,
    p_payment_type: 'paid',
    p_reference_type: 'manual_payment',
    p_reference_id: params.supplierContactId,
    p_amount: params.amount,
    p_payment_method: enumMethod,
    p_payment_date: params.paymentDate || localNowDateString(),
    p_payment_account_id: params.paymentAccountId,
    p_reference_number: null,
    p_notes: composedNotes || null,
    p_created_by: createdBy,
    p_worker_stage_id: null,
  });

  if (error) {
    let msg = error.message;
    if (msg.includes('payment_status') && msg.includes('text')) {
      msg +=
        ' Apply migration migrations/20260449_record_payment_with_accounting_payment_status_cast.sql on Postgres.';
    }
    return { data: null, error: appendPayReferenceAllocationHint(msg) };
  }

  const res = data as {
    success?: boolean;
    payment_id?: string;
    reference_number?: string;
    error?: string;
  } | null;
  if (!res?.success || !res.payment_id) {
    return { data: null, error: res?.error ?? 'Payment failed.' };
  }

  const paymentId = res.payment_id;
  const patch: Record<string, unknown> = {
    reference_type: 'manual_payment',
    reference_id: null,
    contact_id: params.supplierContactId,
    received_by: createdBy,
  };
  if (params.attachments?.length) {
    patch.attachments = params.attachments;
  }

  let payUpd = await supabase.from('payments').update(patch).eq('id', paymentId);
  if (payUpd.error?.code === 'PGRST204' && String(payUpd.error.message || '').includes('attachments')) {
    const { attachments: _a, ...rest } = patch;
    payUpd = await supabase.from('payments').update(rest).eq('id', paymentId);
  } else if (payUpd.error) {
    return {
      data: null,
      error: `Payment recorded but contact link failed: ${payUpd.error.message}`,
    };
  }

  try {
    await applyManualSupplierPaymentAllocations({
      companyId: params.companyId,
      branchId: branchResolved,
      paymentId,
      supplierId: params.supplierContactId,
      amount: params.amount,
      paymentDate: params.paymentDate || localNowDateString(),
      createdBy,
    });
  } catch (allocErr) {
    return {
      data: { payment_id: paymentId, reference_number: res.reference_number ?? null },
      error:
        allocErr instanceof Error
          ? `Payment saved but bill allocation failed: ${allocErr.message}`
          : 'Payment saved but bill allocation failed.',
    };
  }

  if (params.paymentAt) {
    const { patchPaymentCreatedAt } = await import('./paymentTimestamp');
    await patchPaymentCreatedAt(paymentId, params.paymentAt);
  }

  return {
    data: { payment_id: paymentId, reference_number: res.reference_number ?? null },
    error: null,
  };
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

/** Workers with outstanding: list from contacts (type=worker) + workers table; totalPayable from worker_ledger_entries (unpaid only). */
export async function getWorkersWithPayable(companyId: string): Promise<{ data: WorkerWithPayable[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  try {
    const workerList: Array<{ id: string; name: string; phone: string; type: string; weeklyRate?: number }> = [];
    const seenIds = new Set<string>();

    // 1) Workers table
    const { data: workersRows } = await supabase
      .from('workers')
      .select('id, name, phone, worker_type, rate, payment_rate')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('name');
    const workersArr = (workersRows || []) as Record<string, unknown>[];
    const workersById = new Map(workersArr.map((w) => [String(w.id), w]));
    for (const w of workersArr) {
      const id = String(w.id ?? '');
      if (!id || seenIds.has(id)) continue;
      seenIds.add(id);
      workerList.push({
        id,
        name: String(w.name ?? '—'),
        phone: String(w.phone ?? ''),
        type: String(w.worker_type ?? 'worker'),
        weeklyRate: Number((w.rate ?? w.payment_rate) ?? 0) || undefined,
      });
    }

    // 2) Contacts with type=worker (primary in web ERP; assigned_worker_id often is contact id)
    let contacts: Record<string, unknown>[] = [];
    try {
      const { data: contactWorkers } = await supabase
        .from('contacts')
        .select('id, name, phone, mobile, worker_role')
        .eq('company_id', companyId)
        .eq('type', 'worker')
        .order('name');
      contacts = (contactWorkers || []) as Record<string, unknown>[];
    } catch (_) {
      // contacts.type or worker_role may not exist
    }
    for (const c of contacts) {
      const id = String(c.id ?? '');
      if (!id || seenIds.has(id)) continue;
      seenIds.add(id);
      const wr = workersById.get(id) as Record<string, unknown> | undefined;
      workerList.push({
        id,
        name: String(c.name ?? '—'),
        phone: String(c.phone ?? c.mobile ?? ''),
        type: String((c.worker_role ?? wr?.worker_type) ?? 'worker'),
        weeklyRate: wr ? (Number(wr.rate ?? wr.payment_rate) || undefined) : undefined,
      });
    }

    // 3) Outstanding from worker_ledger_entries (unpaid entries only – ledger-driven)
    let ledgerRows: Array<{ worker_id: string; amount: number; status?: string }> = [];
    const { data: withStatus, error: ledgerErr } = await supabase
      .from('worker_ledger_entries')
      .select('worker_id, amount, status')
      .eq('company_id', companyId);
    if (ledgerErr && (ledgerErr.code === '42703' || ledgerErr.message?.includes('status'))) {
      const { data: noStatus } = await supabase
        .from('worker_ledger_entries')
        .select('worker_id, amount')
        .eq('company_id', companyId);
      ledgerRows = (noStatus || []).map((r: Record<string, unknown>) => ({
        worker_id: String(r.worker_id),
        amount: Number(r.amount) || 0,
        status: 'unpaid',
      }));
    } else if (!ledgerErr) {
      ledgerRows = (withStatus || []).map((r: Record<string, unknown>) => ({
        worker_id: String(r.worker_id ?? ''),
        amount: Number(r.amount) || 0,
        status: String(r.status ?? 'unpaid'),
      }));
    }

    const totalPayableByWorker: Record<string, number> = {};
    for (const row of ledgerRows) {
      const wid = row.worker_id;
      if (!wid) continue;
      const st = (row.status || 'unpaid').toLowerCase();
      if (st !== 'paid') {
        totalPayableByWorker[wid] = (totalPayableByWorker[wid] || 0) + row.amount;
      }
    }

    // Include any worker_id from ledger not in worker list (e.g. contact id not in workers)
    for (const wid of Object.keys(totalPayableByWorker)) {
      if (seenIds.has(wid)) continue;
      seenIds.add(wid);
      const fromW = workersById.get(wid) as Record<string, unknown> | undefined;
      const { data: fromContact } = await supabase
        .from('contacts')
        .select('id, name, phone, mobile')
        .eq('id', wid)
        .eq('company_id', companyId)
        .maybeSingle();
      const c = fromContact as Record<string, unknown> | undefined;
      workerList.push({
        id: wid,
        name: String((fromW?.name ?? c?.name) ?? 'Unknown'),
        phone: String((fromW?.phone ?? c?.phone ?? c?.mobile) ?? ''),
        type: String(fromW?.worker_type ?? 'worker'),
      });
    }

    workerList.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    const list: WorkerWithPayable[] = workerList.map((w) => ({
      id: w.id,
      name: w.name,
      phone: w.phone,
      type: w.type,
      totalPayable: totalPayableByWorker[w.id] ?? 0,
      weeklyRate: w.weeklyRate,
      lastPayment: undefined,
    }));

    return { data: list, error: null };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return { data: [], error: msg };
  }
}

/** Ledger entries for a worker (Payable / Paid) – for worker detail view. */
export interface WorkerLedgerEntryRow {
  id: string;
  amount: number;
  status: string;
  reference_type: string;
  reference_id: string;
  notes: string | null;
  created_at: string;
  paid_at: string | null;
}

export async function getWorkerLedgerEntries(
  companyId: string,
  workerId: string
): Promise<{ data: WorkerLedgerEntryRow[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  const cols = 'id, amount, reference_type, reference_id, notes, created_at';
  let data: Record<string, unknown>[] = [];
  const { data: withStatus, error } = await supabase
    .from('worker_ledger_entries')
    .select(`${cols}, status, paid_at`)
    .eq('company_id', companyId)
    .eq('worker_id', workerId)
    .order('created_at', { ascending: false });
  if (error && (error.code === '42703' || error.message?.includes('status') || error.message?.includes('paid_at'))) {
    const { data: fallback } = await supabase
      .from('worker_ledger_entries')
      .select(cols)
      .eq('company_id', companyId)
      .eq('worker_id', workerId)
      .order('created_at', { ascending: false });
    data = (fallback || []).map((r: Record<string, unknown>) => ({ ...r, status: 'unpaid', paid_at: null }));
  } else if (error) {
    if (error.code === 'PGRST116' || error.message?.includes('does not exist')) return { data: [], error: null };
    return { data: [], error: error.message };
  } else {
    data = (withStatus || []) as Record<string, unknown>[];
  }
  const list: WorkerLedgerEntryRow[] = data.map((r) => ({
    id: String(r.id ?? ''),
    amount: Number(r.amount) || 0,
    status: String(r.status ?? 'unpaid').toLowerCase(),
    reference_type: String(r.reference_type ?? ''),
    reference_id: String(r.reference_id ?? ''),
    notes: r.notes != null ? String(r.notes) : null,
    created_at: String(r.created_at ?? ''),
    paid_at: r.paid_at != null ? String(r.paid_at) : null,
  }));
  return { data: list, error: null };
}

/**
 * Record worker payment via `record_payment_with_accounting` (WPY-*), then worker_ledger_entries row.
 */
export async function recordWorkerPayment(params: {
  companyId: string;
  branchId?: string | null;
  workerId: string;
  amount: number;
  paymentDate: string;
  paymentAt?: string | null;
  paymentAccountId: string;
  paymentMethod?: string;
  workerName?: string;
  userId?: string | null;
  workPeriod?: string;
  notes?: string;
  paymentReference?: string;
  /** When paying a specific studio stage (Pay Now), matches web worker payment debit side. */
  stageId?: string | null;
  attachments?: { url: string; name: string }[] | null;
}): Promise<{ data: { id: string } | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  if (!params.workerId || !params.paymentAccountId || Number(params.amount) <= 0) {
    return { data: null, error: 'workerId, paymentAccountId, amount are required.' };
  }
  const amount = Number(params.amount) || 0;
  const paymentMethod = normalizePaymentMethod(params.paymentMethod);
  const notes = params.notes ?? params.workPeriod ?? 'Worker payment';

  let branchResolved: string;
  try {
    branchResolved = await resolveBranchUuidForWrite(
      params.companyId,
      safeRpcBranchId(params.branchId),
      'No branch set up. Add a branch in Settings to record payments.',
    );
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Branch required' };
  }

  const { data, error } = await supabase.rpc('record_payment_with_accounting', {
    p_company_id: params.companyId,
    p_branch_id: branchResolved,
    p_payment_type: 'paid',
    p_reference_type: 'worker_payment',
    p_reference_id: params.workerId,
    p_amount: amount,
    p_payment_method: paymentMethod,
    p_payment_date: params.paymentDate,
    p_payment_account_id: params.paymentAccountId,
    p_reference_number: params.paymentReference?.trim() ? params.paymentReference.trim() : null,
    p_notes: notes,
    p_created_by: params.userId ?? null,
    p_worker_stage_id: params.stageId ?? null,
  });

  if (error) return { data: null, error: appendPayReferenceAllocationHint(error.message) };

  const res = data as {
    success?: boolean;
    payment_id?: string;
    journal_entry_id?: string;
    reference_number?: string | null;
    error?: string;
  };
  if (!res?.success || !res.payment_id || !res.journal_entry_id) {
    const msg = typeof res?.error === 'string' ? res.error : 'Worker payment failed.';
    return { data: null, error: appendPayReferenceAllocationHint(msg) };
  }

  const paymentId = res.payment_id;
  const journalEntryId = res.journal_entry_id;
  const ref = String(res.reference_number ?? '');

  if (params.paymentAt) {
    const { patchPaymentCreatedAt } = await import('./paymentTimestamp');
    await patchPaymentCreatedAt(paymentId, params.paymentAt);
  }

  if (params.attachments?.length) {
    const patch = { attachments: params.attachments };
    const attUpd = await supabase.from('payments').update(patch).eq('id', paymentId);
    if (attUpd.error?.code === 'PGRST204' && String(attUpd.error.message || '').includes('attachments')) {
      // attachments column unavailable — payment still valid
    } else if (attUpd.error) {
      return { data: null, error: `Payment recorded but attachments could not be linked: ${attUpd.error.message}` };
    }
  }

  const { data: existingLedger } = await supabase
    .from('worker_ledger_entries')
    .select('id')
    .eq('company_id', params.companyId)
    .eq('worker_id', params.workerId)
    .or(`reference_id.eq.${journalEntryId},payment_reference.eq.${ref}`)
    .limit(1)
    .maybeSingle();
  if (!existingLedger?.id) {
    const { error: workerLedErr } = await supabase
      .from('worker_ledger_entries')
      .insert({
        company_id: params.companyId,
        worker_id: params.workerId,
        amount,
        reference_type: 'accounting_payment',
        reference_id: journalEntryId,
        document_no: ref,
        notes,
        status: 'paid',
        paid_at: params.paymentDate,
        payment_reference: ref,
        entry_type: 'payment',
      });
    if (workerLedErr) return { data: null, error: workerLedErr.message };
  }

  return { data: { id: paymentId }, error: null };
}
