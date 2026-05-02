import { supabase, isSupabaseConfigured } from '../lib/supabase';

/**
 * A single payment transaction flattened for UI display.
 * Joins payments + journal_entry_lines + accounts + contacts so the UI
 * shows date/time, from/to account, and party in one row.
 */
export interface TransactionRow {
  id: string;
  paymentId: string;
  createdAt: string;
  paymentDate: string;
  direction: 'received' | 'paid';
  referenceType: string;
  referenceId: string;
  referenceNumber: string | null;
  amount: number;
  method: string;
  paymentAccountId: string | null;
  paymentAccountName: string | null;
  partyAccountId: string | null;
  partyAccountName: string | null;
  partyId: string | null;
  partyName: string | null;
  branchId: string | null;
  branchName: string | null;
  notes: string | null;
  journalEntryId: string | null;
  entryNo: string | null;
  createdBy: string | null;
  attachments: Array<{ url: string; name?: string | null }> | null;
}

export interface TransactionJournalLine {
  id: string;
  accountId: string;
  accountName: string | null;
  accountCode: string | null;
  debit: number;
  credit: number;
  description: string | null;
}

export interface TransactionDetail extends TransactionRow {
  journalLines: TransactionJournalLine[];
  partyPhone: string | null;
  partyType: string | null;
}

export interface GetTransactionsFilters {
  companyId: string;
  branchId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  direction?: 'all' | 'received' | 'paid';
  paymentAccountId?: string | null;
  method?: string | null;
  referenceType?: string | null;
  search?: string | null;
  limit?: number;
}

type PaymentSupabaseRow = {
  id: string;
  created_at: string;
  payment_date: string;
  payment_type: string;
  reference_type: string;
  reference_id: string;
  reference_number: string | null;
  amount: number | string;
  payment_method: string;
  payment_account_id: string | null;
  branch_id: string | null;
  notes: string | null;
  attachments: unknown;
  created_by: string | null;
};

type JournalEntryLite = {
  id: string;
  entry_no: string | null;
  reference_id: string;
};

type JournalLineLite = {
  id: string;
  journal_entry_id: string;
  account_id: string;
  debit: number | string;
  credit: number | string;
  description: string | null;
};

type AccountLite = {
  id: string;
  code: string | null;
  name: string;
  type?: string;
  parent_id?: string | null;
  linked_contact_id?: string | null;
};

type ContactLite = {
  id: string;
  name: string;
  type?: string | null;
  phone?: string | null;
};

type BranchLite = {
  id: string;
  name: string;
};

async function getSalesPartyMap(companyId: string, saleIds: string[]): Promise<Record<string, string | null>> {
  if (!saleIds.length) return {};
  const { data } = await supabase
    .from('sales')
    .select('id, customer_id')
    .eq('company_id', companyId)
    .in('id', saleIds);
  const map: Record<string, string | null> = {};
  (data || []).forEach((r: Record<string, unknown>) => {
    map[String(r.id)] = r.customer_id ? String(r.customer_id) : null;
  });
  return map;
}

async function getPurchasesPartyMap(companyId: string, ids: string[]): Promise<Record<string, string | null>> {
  if (!ids.length) return {};
  const { data } = await supabase
    .from('purchases')
    .select('id, supplier_id')
    .eq('company_id', companyId)
    .in('id', ids);
  const map: Record<string, string | null> = {};
  (data || []).forEach((r: Record<string, unknown>) => {
    map[String(r.id)] = r.supplier_id ? String(r.supplier_id) : null;
  });
  return map;
}

async function getRentalsPartyMap(companyId: string, ids: string[]): Promise<Record<string, string | null>> {
  if (!ids.length) return {};
  const { data } = await supabase
    .from('rentals')
    .select('id, customer_id')
    .eq('company_id', companyId)
    .in('id', ids);
  const map: Record<string, string | null> = {};
  (data || []).forEach((r: Record<string, unknown>) => {
    map[String(r.id)] = r.customer_id ? String(r.customer_id) : null;
  });
  return map;
}

/**
 * Unified paged transactions list for the Reports timeline.
 * Returns payments enriched with payment-account name, party-subledger
 * account name, and the party (contact) name.
 */
export async function getPaymentTransactions(
  filters: GetTransactionsFilters,
): Promise<{ data: TransactionRow[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };

  let q = supabase
    .from('payments')
    .select(
      'id, created_at, payment_date, payment_type, reference_type, reference_id, reference_number, amount, payment_method, payment_account_id, branch_id, notes, attachments, created_by',
    )
    .eq('company_id', filters.companyId)
    .order('payment_date', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(filters.limit ?? 150);

  if (filters.branchId && filters.branchId !== 'all' && filters.branchId !== 'default') {
    q = q.eq('branch_id', filters.branchId);
  }
  if (filters.startDate) q = q.gte('payment_date', filters.startDate);
  if (filters.endDate) q = q.lte('payment_date', filters.endDate);
  if (filters.direction && filters.direction !== 'all') q = q.eq('payment_type', filters.direction);
  if (filters.paymentAccountId) q = q.eq('payment_account_id', filters.paymentAccountId);
  if (filters.method) q = q.eq('payment_method', filters.method);
  if (filters.referenceType) q = q.eq('reference_type', filters.referenceType);

  const { data: payments, error } = await q;
  if (error) return { data: [], error: error.message };
  const rows = (payments || []) as PaymentSupabaseRow[];
  if (!rows.length) return { data: [], error: null };

  const paymentIds = rows.map((r) => r.id);

  const { data: journalEntries } = await supabase
    .from('journal_entries')
    .select('id, entry_no, reference_id')
    .eq('reference_type', 'payment')
    .in('reference_id', paymentIds);

  const entryByPayment: Record<string, JournalEntryLite> = {};
  ((journalEntries || []) as JournalEntryLite[]).forEach((e) => {
    entryByPayment[String(e.reference_id)] = e;
  });
  const entryIds = Object.values(entryByPayment).map((e) => e.id);

  let linesByEntry: Record<string, JournalLineLite[]> = {};
  if (entryIds.length) {
    const { data: lines } = await supabase
      .from('journal_entry_lines')
      .select('id, journal_entry_id, account_id, debit, credit, description')
      .in('journal_entry_id', entryIds);
    ((lines || []) as JournalLineLite[]).forEach((l) => {
      const key = String(l.journal_entry_id);
      if (!linesByEntry[key]) linesByEntry[key] = [];
      linesByEntry[key].push(l);
    });
  }

  const accountIds = new Set<string>();
  rows.forEach((r) => {
    if (r.payment_account_id) accountIds.add(r.payment_account_id);
  });
  Object.values(linesByEntry)
    .flat()
    .forEach((l) => accountIds.add(String(l.account_id)));

  let accountsById: Record<string, AccountLite> = {};
  if (accountIds.size) {
    const { data: accs } = await supabase
      .from('accounts')
      .select('id, code, name, type, parent_id, linked_contact_id')
      .in('id', Array.from(accountIds));
    ((accs || []) as AccountLite[]).forEach((a) => {
      accountsById[String(a.id)] = a;
    });
  }

  const saleIds = rows.filter((r) => r.reference_type === 'sale').map((r) => r.reference_id);
  const purchaseIds = rows.filter((r) => r.reference_type === 'purchase').map((r) => r.reference_id);
  const rentalIds = rows.filter((r) => r.reference_type === 'rental').map((r) => r.reference_id);

  const [salesPartyMap, purchasesPartyMap, rentalsPartyMap] = await Promise.all([
    getSalesPartyMap(filters.companyId, saleIds),
    getPurchasesPartyMap(filters.companyId, purchaseIds),
    getRentalsPartyMap(filters.companyId, rentalIds),
  ]);

  const contactIdSet = new Set<string>();
  Object.values(accountsById).forEach((a) => {
    if (a.linked_contact_id) contactIdSet.add(a.linked_contact_id);
  });
  Object.values(salesPartyMap).forEach((v) => {
    if (v) contactIdSet.add(v);
  });
  Object.values(purchasesPartyMap).forEach((v) => {
    if (v) contactIdSet.add(v);
  });
  Object.values(rentalsPartyMap).forEach((v) => {
    if (v) contactIdSet.add(v);
  });
  rows.forEach((r) => {
    if (r.reference_type === 'worker_payment' && r.reference_id) contactIdSet.add(r.reference_id);
  });

  let contactsById: Record<string, ContactLite> = {};
  if (contactIdSet.size) {
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, name, type, phone')
      .in('id', Array.from(contactIdSet));
    ((contacts || []) as ContactLite[]).forEach((c) => {
      contactsById[String(c.id)] = c;
    });
  }

  const branchIdSet = new Set<string>();
  rows.forEach((r) => {
    if (r.branch_id) branchIdSet.add(r.branch_id);
  });
  let branchesById: Record<string, BranchLite> = {};
  if (branchIdSet.size) {
    const { data: branches } = await supabase
      .from('branches')
      .select('id, name')
      .in('id', Array.from(branchIdSet));
    ((branches || []) as BranchLite[]).forEach((b) => {
      branchesById[String(b.id)] = b;
    });
  }

  const out: TransactionRow[] = rows.map((row) => {
    const direction = (row.payment_type === 'received' ? 'received' : 'paid') as 'received' | 'paid';
    const entry = entryByPayment[row.id];
    const lines = entry ? linesByEntry[entry.id] ?? [] : [];
    const payAcc = row.payment_account_id ? accountsById[row.payment_account_id] ?? null : null;

    // Identify the party (AR/AP/WP) line by excluding the payment account and
    // preferring an account with linked_contact_id.
    let partyAcc: AccountLite | null = null;
    const candidate = lines
      .map((l) => accountsById[l.account_id])
      .filter((a): a is AccountLite => !!a && a.id !== (payAcc?.id ?? ''));
    partyAcc = candidate.find((a) => a.linked_contact_id) ?? candidate[0] ?? null;

    let partyId: string | null = partyAcc?.linked_contact_id ?? null;
    if (!partyId) {
      if (row.reference_type === 'sale') partyId = salesPartyMap[row.reference_id] ?? null;
      else if (row.reference_type === 'purchase') partyId = purchasesPartyMap[row.reference_id] ?? null;
      else if (row.reference_type === 'rental') partyId = rentalsPartyMap[row.reference_id] ?? null;
      else if (row.reference_type === 'worker_payment') partyId = row.reference_id;
    }

    const partyContact = partyId ? contactsById[partyId] ?? null : null;

    const attachments = Array.isArray(row.attachments) ? (row.attachments as Array<{ url: string; name?: string | null }>) : null;

    return {
      id: row.id,
      paymentId: row.id,
      createdAt: row.created_at,
      paymentDate: row.payment_date,
      direction,
      referenceType: row.reference_type,
      referenceId: row.reference_id,
      referenceNumber: row.reference_number,
      amount: Number(row.amount) || 0,
      method: row.payment_method,
      paymentAccountId: payAcc?.id ?? null,
      paymentAccountName: payAcc?.name ?? null,
      partyAccountId: partyAcc?.id ?? null,
      partyAccountName: partyAcc?.name ?? null,
      partyId,
      partyName: partyContact?.name ?? null,
      branchId: row.branch_id,
      branchName: row.branch_id ? branchesById[row.branch_id]?.name ?? null : null,
      notes: row.notes,
      journalEntryId: entry?.id ?? null,
      entryNo: entry?.entry_no ?? null,
      createdBy: row.created_by,
      attachments,
    };
  });

  if (filters.search && filters.search.trim().length > 0) {
    const q = filters.search.toLowerCase();
    return {
      data: out.filter(
        (t) =>
          (t.partyName || '').toLowerCase().includes(q) ||
          (t.referenceNumber || '').toLowerCase().includes(q) ||
          (t.notes || '').toLowerCase().includes(q),
      ),
      error: null,
    };
  }

  return { data: out, error: null };
}

/** Detailed view — includes full journal-lines breakdown for the tx modal. */
export async function getTransactionDetail(
  companyId: string,
  paymentId: string,
): Promise<{ data: TransactionDetail | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  const { data: baseArr, error } = await getPaymentTransactions({ companyId, limit: 500 });
  if (error) return { data: null, error };
  const base = baseArr.find((t) => t.paymentId === paymentId);
  if (!base) return { data: null, error: 'Transaction not found.' };

  let journalLines: TransactionJournalLine[] = [];
  if (base.journalEntryId) {
    const { data: lines } = await supabase
      .from('journal_entry_lines')
      .select('id, account_id, debit, credit, description')
      .eq('journal_entry_id', base.journalEntryId);
    const ids = (lines || []).map((l: Record<string, unknown>) => String(l.account_id));
    let accountsById: Record<string, AccountLite> = {};
    if (ids.length) {
      const { data: accs } = await supabase
        .from('accounts')
        .select('id, code, name')
        .in('id', ids);
      ((accs || []) as AccountLite[]).forEach((a) => (accountsById[a.id] = a));
    }
    journalLines = (lines || []).map((l: Record<string, unknown>) => {
      const acc = accountsById[String(l.account_id)];
      return {
        id: String(l.id),
        accountId: String(l.account_id),
        accountName: acc?.name ?? null,
        accountCode: acc?.code ?? null,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
        description: (l.description as string | null) ?? null,
      };
    });
  }

  let partyPhone: string | null = null;
  let partyType: string | null = null;
  if (base.partyId) {
    const { data: contact } = await supabase
      .from('contacts')
      .select('phone, type')
      .eq('id', base.partyId)
      .maybeSingle();
    if (contact) {
      partyPhone = ((contact as Record<string, unknown>).phone as string | null) ?? null;
      partyType = ((contact as Record<string, unknown>).type as string | null) ?? null;
    }
  }

  return {
    data: { ...base, journalLines, partyPhone, partyType },
    error: null,
  };
}

export interface TransactionEditability {
  editable: boolean;
  kind: 'payment' | 'journal' | 'locked';
  reason?: string;
}
export type TransactionEditSource = 'payment_row' | 'journal_entry' | 'unknown';

const LOCKED_REFERENCE_TYPES = new Set(['sale', 'purchase', 'stock_movement', 'inventory']);
const JOURNAL_EDITABLE_REFERENCE_TYPES = new Set(['general', 'transfer', 'expense', 'expense_payment']);

export function canEditTransaction(referenceType: string, source: TransactionEditSource = 'unknown'): TransactionEditability {
  const type = String(referenceType || '').toLowerCase();
  // Transactions tab rows are always payment records; allow payment edit even when
  // reference type points to source documents like sale/purchase.
  if (source === 'payment_row') {
    if (type === 'stock_movement' || type === 'inventory') {
      return { editable: false, kind: 'locked', reason: 'Inventory source transaction is locked.' };
    }
    return { editable: true, kind: 'payment' };
  }
  if (LOCKED_REFERENCE_TYPES.has(type)) {
    return { editable: false, kind: 'locked', reason: 'Source document controls this transaction.' };
  }
  if (type === 'payment' || type === 'rental' || type === 'worker_payment' || type === 'on_account' || type === 'manual_receipt') {
    return { editable: true, kind: 'payment' };
  }
  if (JOURNAL_EDITABLE_REFERENCE_TYPES.has(type)) {
    return { editable: true, kind: 'journal' };
  }
  return { editable: false, kind: 'locked', reason: `Editing not allowed for ${type || 'this'} transaction.` };
}

export interface PaymentTransactionUpdateInput {
  companyId: string;
  paymentId: string;
  amount: number;
  paymentDate: string;
  paymentAccountId: string;
  paymentMethod?: string;
  notes?: string | null;
  referenceNumber?: string | null;
}

export async function updatePaymentTransactionInPlace(
  input: PaymentTransactionUpdateInput
): Promise<{ data: { paymentId: string } | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  const amount = Number(input.amount) || 0;
  if (amount <= 0) return { data: null, error: 'Amount must be greater than zero.' };

  const { data: paymentRow, error: paymentReadErr } = await supabase
    .from('payments')
    .select('id, company_id, payment_account_id, payment_method, payment_date, notes, reference_number')
    .eq('id', input.paymentId)
    .eq('company_id', input.companyId)
    .maybeSingle();
  if (paymentReadErr || !paymentRow) return { data: null, error: paymentReadErr?.message || 'Payment not found.' };

  const { data: jeRow, error: jeErr } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('company_id', input.companyId)
    .eq('payment_id', input.paymentId)
    .limit(1)
    .maybeSingle();
  if (jeErr || !jeRow?.id) return { data: null, error: jeErr?.message || 'Linked journal entry not found.' };

  const { data: jeLines, error: lineErr } = await supabase
    .from('journal_entry_lines')
    .select('id, account_id, debit, credit')
    .eq('journal_entry_id', jeRow.id);
  if (lineErr || !jeLines?.length) return { data: null, error: lineErr?.message || 'Journal lines not found.' };

  const oldPaymentAccountId = String(paymentRow.payment_account_id || '');
  const paymentLine = jeLines.find((l) => String(l.account_id) === oldPaymentAccountId);
  if (!paymentLine) return { data: null, error: 'Payment account line not found in journal.' };
  const counterLine = jeLines.find((l) => l.id !== paymentLine.id);
  if (!counterLine) return { data: null, error: 'Counter journal line not found.' };

  const payLineWasDebit = Number(paymentLine.debit || 0) > 0;
  const updates = [
    {
      id: paymentLine.id,
      account_id: input.paymentAccountId,
      debit: payLineWasDebit ? amount : 0,
      credit: payLineWasDebit ? 0 : amount,
    },
    {
      id: counterLine.id,
      account_id: counterLine.account_id,
      debit: payLineWasDebit ? 0 : amount,
      credit: payLineWasDebit ? amount : 0,
    },
  ];

  for (const row of updates) {
    const { error } = await supabase
      .from('journal_entry_lines')
      .update({
        account_id: row.account_id,
        debit: row.debit,
        credit: row.credit,
      })
      .eq('id', row.id);
    if (error) return { data: null, error: error.message };
  }

  const { error: paymentUpdateErr } = await supabase
    .from('payments')
    .update({
      amount,
      payment_date: input.paymentDate,
      payment_account_id: input.paymentAccountId,
      payment_method: input.paymentMethod || paymentRow.payment_method || 'cash',
      notes: input.notes ?? null,
      reference_number: input.referenceNumber ?? paymentRow.reference_number ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.paymentId)
    .eq('company_id', input.companyId);
  if (paymentUpdateErr) return { data: null, error: paymentUpdateErr.message };

  const { error: jeUpdateErr } = await supabase
    .from('journal_entries')
    .update({
      entry_date: input.paymentDate,
      description: `Payment: ${input.referenceNumber || paymentRow.reference_number || input.paymentId}`,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jeRow.id)
    .eq('company_id', input.companyId);
  if (jeUpdateErr) return { data: null, error: jeUpdateErr.message };

  return { data: { paymentId: input.paymentId }, error: null };
}
