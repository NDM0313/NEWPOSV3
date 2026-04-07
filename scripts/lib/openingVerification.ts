/**
 * Schema-aware opening-balance analysis, supplier repair, and GL verification for admin scripts.
 * Uses direct Supabase admin client only (no src/ imports).
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export const REF_AP = 'opening_balance_contact_ap';
export const REF_AR = 'opening_balance_contact_ar';
export const REF_WORKER = 'opening_balance_contact_worker';

const MONEY_EPS = 0.02;

export function roundMoney(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export type TableSchemaShape = {
  table: string;
  columns: string[];
  note?: string;
};

/** Infer column names from one sample row (service role). Empty table → fallback list. */
export async function inferTableShape(
  supabase: SupabaseClient,
  table: string,
  fallbackColumns: string[]
): Promise<TableSchemaShape> {
  const { data, error } = await supabase.from(table).select('*').limit(1).maybeSingle();
  if (error) {
    return {
      table,
      columns: fallbackColumns,
      note: `Sample select failed: ${error.message}. Using fallback column list.`,
    };
  }
  if (data && typeof data === 'object') {
    return { table, columns: Object.keys(data as Record<string, unknown>).sort() };
  }
  return {
    table,
    columns: fallbackColumns,
    note: 'No sample row returned; using fallback column list.',
  };
}

const FALLBACK: Record<string, string[]> = {
  contacts: [
    'id',
    'company_id',
    'type',
    'name',
    'opening_balance',
    'supplier_opening_balance',
    'branch_id',
  ],
  journal_entries: [
    'id',
    'company_id',
    'branch_id',
    'entry_no',
    'entry_date',
    'description',
    'reference_type',
    'reference_id',
    'is_void',
    'created_at',
  ],
  journal_entry_lines: ['id', 'journal_entry_id', 'account_id', 'debit', 'credit', 'description'],
  accounts: ['id', 'company_id', 'code', 'name', 'type', 'is_active'],
};

export async function inspectCoreSchemas(supabase: SupabaseClient): Promise<TableSchemaShape[]> {
  const tables = ['contacts', 'journal_entries', 'journal_entry_lines', 'accounts'] as const;
  const out: TableSchemaShape[] = [];
  for (const t of tables) {
    out.push(await inferTableShape(supabase, t, FALLBACK[t] ?? []));
  }
  return out;
}

export type ContactRow = {
  id: string;
  type: string;
  name: string | null;
  opening_balance: number | null;
  supplier_opening_balance: number | null;
  branch_id?: string | null;
};

export async function fetchContactsForCompany(
  supabase: SupabaseClient,
  companyId: string
): Promise<ContactRow[]> {
  const { data, error } = await supabase
    .from('contacts')
    .select('id, type, name, opening_balance, supplier_opening_balance, branch_id')
    .eq('company_id', companyId);
  if (error) throw error;
  return (data || []) as ContactRow[];
}

export function groupContactsByType(rows: ContactRow[]): Record<string, ContactRow[]> {
  const g: Record<string, ContactRow[]> = {};
  for (const r of rows) {
    const t = String(r.type || 'unknown').toLowerCase();
    if (!g[t]) g[t] = [];
    g[t].push(r);
  }
  return g;
}

/** Supplier-only legacy pattern: payable stored in opening_balance, supplier_opening_balance ~ 0 */
export function findSupplierOnlyNormalizeCandidates(rows: ContactRow[]): ContactRow[] {
  return rows.filter((r) => {
    if (String(r.type || '').toLowerCase() !== 'supplier') return false;
    const sup = roundMoney(Number(r.supplier_opening_balance) || 0);
    const ob = roundMoney(Number(r.opening_balance) || 0);
    return Math.abs(sup) < MONEY_EPS && ob > MONEY_EPS;
  });
}

/** both-type: opening_balance > 0 and supplier_opening ~ 0 — manual review only */
export function findBothTypeReview(rows: ContactRow[]): ContactRow[] {
  return rows.filter((r) => {
    if (String(r.type || '').toLowerCase() !== 'both') return false;
    const sup = roundMoney(Number(r.supplier_opening_balance) || 0);
    const ob = roundMoney(Number(r.opening_balance) || 0);
    return ob > MONEY_EPS && Math.abs(sup) < MONEY_EPS;
  });
}

export type AccountMini = { id: string; code: string | null; name: string | null; type: string | null };

export async function fetchAccountsForCompany(
  supabase: SupabaseClient,
  companyId: string
): Promise<AccountMini[]> {
  const { data, error } = await supabase
    .from('accounts')
    .select('id, code, name, type')
    .eq('company_id', companyId)
    .eq('is_active', true);
  if (error) throw error;
  return (data || []) as AccountMini[];
}

export function accountIdByCode(accounts: AccountMini[], code: string): string | null {
  const c = code.trim();
  const hit = accounts.find((a) => String(a.code ?? '').trim() === c);
  return hit?.id ?? null;
}

export function resolveEquityAccountId(accounts: AccountMini[]): string {
  let id = accountIdByCode(accounts, '3000');
  if (id) return id;
  const named = accounts.find(
    (a) =>
      String(a.type ?? '').toLowerCase() === 'equity' && /capital|owner|opening/i.test(String(a.name ?? ''))
  );
  if (named?.id) return named.id;
  const anyEq = accounts.find((a) => String(a.type ?? '').toLowerCase() === 'equity');
  if (anyEq?.id) return anyEq.id;
  throw new Error('No equity account (code 3000 or type equity) for company — seed default COA first.');
}

async function fetchActiveJournalEntryIdsForCompany(
  supabase: SupabaseClient,
  companyId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('company_id', companyId)
    .or('is_void.is.null,is_void.eq.false');
  if (error) throw error;
  return (data || []).map((r: { id: string }) => r.id);
}

async function fetchLinesForJournalIds(
  supabase: SupabaseClient,
  journalIds: string[]
): Promise<{ journal_entry_id: string; account_id: string; debit: number; credit: number }[]> {
  if (journalIds.length === 0) return [];
  const chunk = 80;
  const all: { journal_entry_id: string; account_id: string; debit: number; credit: number }[] = [];
  for (let i = 0; i < journalIds.length; i += chunk) {
    const slice = journalIds.slice(i, i + chunk);
    const { data, error } = await supabase
      .from('journal_entry_lines')
      .select('journal_entry_id, account_id, debit, credit')
      .in('journal_entry_id', slice);
    if (error) throw error;
    all.push(...((data || []) as any[]));
  }
  return all;
}

/** Per control code: total debit, credit, net (debit − credit) — matches app TB line convention */
export async function snapshotControlAccounts(
  supabase: SupabaseClient,
  companyId: string,
  controlCodes: string[]
): Promise<Record<string, { debit: number; credit: number; netDrMinusCr: number }>> {
  const accounts = await fetchAccountsForCompany(supabase, companyId);
  const codeSet = new Set(controlCodes.map((c) => c.trim()));
  const idToCode = new Map<string, string>();
  for (const a of accounts) {
    const code = String(a.code ?? '').trim();
    if (codeSet.has(code)) idToCode.set(a.id, code);
  }

  const jeIds = await fetchActiveJournalEntryIdsForCompany(supabase, companyId);
  const lines = await fetchLinesForJournalIds(supabase, jeIds);

  const agg: Record<string, { debit: number; credit: number }> = {};
  for (const c of controlCodes) {
    agg[c] = { debit: 0, credit: 0 };
  }

  for (const ln of lines) {
    const code = idToCode.get(ln.account_id);
    if (!code) continue;
    agg[code].debit += Number(ln.debit) || 0;
    agg[code].credit += Number(ln.credit) || 0;
  }

  const out: Record<string, { debit: number; credit: number; netDrMinusCr: number }> = {};
  for (const c of controlCodes) {
    const d = roundMoney(agg[c].debit);
    const cr = roundMoney(agg[c].credit);
    out[c] = { debit: d, credit: cr, netDrMinusCr: roundMoney(d - cr) };
  }
  return out;
}

export type ApOpeningJournalRow = {
  id: string;
  reference_id: string | null;
  entry_no: string | null;
  entry_date: string | null;
  is_void: boolean | null;
};

export async function fetchApOpeningJournals(
  supabase: SupabaseClient,
  companyId: string
): Promise<ApOpeningJournalRow[]> {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('id, reference_id, entry_no, entry_date, is_void')
    .eq('company_id', companyId)
    .eq('reference_type', REF_AP)
    .or('is_void.is.null,is_void.eq.false');
  if (error) throw error;
  return (data || []) as ApOpeningJournalRow[];
}

export function findDuplicateApOpenings(rows: ApOpeningJournalRow[]): Map<string, number> {
  const byRef = new Map<string, number>();
  for (const r of rows) {
    if (!r.reference_id) continue;
    const k = String(r.reference_id);
    byRef.set(k, (byRef.get(k) || 0) + 1);
  }
  const dup = new Map<string, number>();
  for (const [k, n] of byRef) {
    if (n > 1) dup.set(k, n);
  }
  return dup;
}

async function findActiveOpeningEntryId(
  supabase: SupabaseClient,
  companyId: string,
  referenceType: string,
  referenceId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('company_id', companyId)
    .eq('reference_type', referenceType)
    .eq('reference_id', referenceId)
    .or('is_void.is.null,is_void.eq.false')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error && error.code !== 'PGRST116') return null;
  return (data as { id?: string } | null)?.id ?? null;
}

async function sumLineOnAccount(
  supabase: SupabaseClient,
  journalEntryId: string,
  accountId: string
): Promise<{ debit: number; credit: number }> {
  const { data, error } = await supabase
    .from('journal_entry_lines')
    .select('debit, credit')
    .eq('journal_entry_id', journalEntryId)
    .eq('account_id', accountId);
  if (error || !data?.length) return { debit: 0, credit: 0 };
  let debit = 0;
  let credit = 0;
  for (const l of data as { debit?: number; credit?: number }[]) {
    debit += Number(l.debit) || 0;
    credit += Number(l.credit) || 0;
  }
  return { debit: roundMoney(debit), credit: roundMoney(credit) };
}

async function voidJournalEntry(supabase: SupabaseClient, journalEntryId: string, jeColumns: string[]): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (jeColumns.includes('is_void')) patch.is_void = true;
  if (jeColumns.includes('updated_at')) patch.updated_at = new Date().toISOString();
  if (Object.keys(patch).length === 0) {
    throw new Error('journal_entries has no is_void — cannot void safely');
  }
  const { error } = await supabase.from('journal_entries').update(patch).eq('id', journalEntryId);
  if (error) throw error;
}

function openingEntryDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * AP source for sync (aligned with openingBalanceJournalService after supplier-only fix).
 */
export function computeApSource(contact: ContactRow): number {
  const type = String(contact.type || '').toLowerCase();
  const supOb = contact.supplier_opening_balance;
  const ob = contact.opening_balance;
  if (type === 'supplier') {
    if (supOb == null || (typeof supOb === 'string' && String(supOb).trim() === '')) {
      return roundMoney(Number(ob) || 0);
    }
    const supNum = roundMoney(Number(supOb) || 0);
    if (Math.abs(supNum) < MONEY_EPS) return roundMoney(Number(ob) || 0);
    return supNum;
  }
  if (type === 'both') {
    return roundMoney(Number(supOb) || 0);
  }
  return 0;
}

export type RepairPlanItem = {
  contactId: string;
  name: string;
  action: 'normalize_supplier_row' | 'sync_ap_opening' | 'void_stale_ap' | 'skip';
  detail: string;
};

export type RepairResult = {
  plans: RepairPlanItem[];
  normalizedContactIds: string[];
  journalsCreated: string[];
  journalsVoided: string[];
};

/**
 * Idempotent company repair: normalize supplier-only rows; sync AP opening for supplier + both.
 */
export async function runSupplierOpeningRepair(
  supabase: SupabaseClient,
  companyId: string,
  options: { dryRun: boolean; journalEntryColumnKeys: string[] }
): Promise<RepairResult> {
  const plans: RepairPlanItem[] = [];
  const normalizedContactIds: string[] = [];
  const journalsCreated: string[] = [];
  const journalsVoided: string[] = [];

  const contacts = await fetchContactsForCompany(supabase, companyId);
  const accounts = await fetchAccountsForCompany(supabase, companyId);
  const apId = accountIdByCode(accounts, '2000');
  const equityId = resolveEquityAccountId(accounts);
  if (!apId) {
    throw new Error('Accounts Payable code 2000 not found for company — run default COA setup.');
  }

  const candidates = findSupplierOnlyNormalizeCandidates(contacts);
  for (const c of candidates) {
    const ob = roundMoney(Number(c.opening_balance) || 0);
    plans.push({
      contactId: c.id,
      name: c.name || c.id,
      action: 'normalize_supplier_row',
      detail: `Set supplier_opening_balance=${ob}, opening_balance=0`,
    });
    if (!options.dryRun) {
      const { error } = await supabase
        .from('contacts')
        .update({ supplier_opening_balance: ob, opening_balance: 0 })
        .eq('id', c.id);
      if (error) throw error;
      normalizedContactIds.push(c.id);
    }
  }

  const contactsAfter = options.dryRun
    ? contacts.map((r) => {
        const hit = candidates.find((c) => c.id === r.id);
        if (!hit) return r;
        return {
          ...r,
          supplier_opening_balance: roundMoney(Number(r.opening_balance) || 0),
          opening_balance: 0,
        };
      })
    : await fetchContactsForCompany(supabase, companyId);

  const toSync = contactsAfter.filter((r) => {
    const t = String(r.type || '').toLowerCase();
    return t === 'supplier' || t === 'both';
  });

  for (const c of toSync) {
    const apSource = computeApSource(c);
    const name = c.name || c.id;

    if (Math.abs(apSource) < MONEY_EPS) {
      const existing = await findActiveOpeningEntryId(supabase, companyId, REF_AP, c.id);
      if (existing) {
        plans.push({
          contactId: c.id,
          name,
          action: 'void_stale_ap',
          detail: 'Zero AP opening — void active opening_balance_contact_ap if any',
        });
        if (!options.dryRun) {
          await voidJournalEntry(supabase, existing, options.journalEntryColumnKeys);
          journalsVoided.push(existing);
        }
      } else {
        plans.push({ contactId: c.id, name, action: 'skip', detail: 'No AP opening amount' });
      }
      continue;
    }

    const primaryNet = apSource > 0 ? -apSource : Math.abs(apSource);
    const existingId = await findActiveOpeningEntryId(supabase, companyId, REF_AP, c.id);
    if (existingId) {
      const { debit, credit } = await sumLineOnAccount(supabase, existingId, apId);
      const net = roundMoney(debit - credit);
      if (Math.abs(net - roundMoney(primaryNet)) <= MONEY_EPS) {
        plans.push({
          contactId: c.id,
          name,
          action: 'skip',
          detail: `Active JE ${existingId} already matches AP net ${primaryNet}`,
        });
        continue;
      }
      plans.push({
        contactId: c.id,
        name,
        action: 'sync_ap_opening',
        detail: `Void JE ${existingId} (net mismatch ${net} vs ${primaryNet}), recreate`,
      });
      if (!options.dryRun) {
        await voidJournalEntry(supabase, existingId, options.journalEntryColumnKeys);
        journalsVoided.push(existingId);
      }
    } else {
      plans.push({
        contactId: c.id,
        name,
        action: 'sync_ap_opening',
        detail: `Create opening_balance_contact_ap amount=${Math.abs(apSource)}`,
      });
    }

    if (options.dryRun) continue;

    const amt = Math.abs(apSource);
    const entryNo = `JE-OB-ADMIN-${Date.now()}-${c.id.slice(0, 8)}`;
    const jeInsert: Record<string, unknown> = {
      company_id: companyId,
      entry_no: entryNo,
      entry_date: openingEntryDate(),
      description: `Opening balance — supplier AP — ${name}`,
      reference_type: REF_AP,
      reference_id: c.id,
    };
    if (options.journalEntryColumnKeys.includes('branch_id') && c.branch_id) {
      jeInsert.branch_id = c.branch_id;
    }

    const { data: jeRow, error: jeErr } = await supabase
      .from('journal_entries')
      .insert(jeInsert)
      .select('id')
      .single();
    if (jeErr) throw jeErr;
    const jeId = (jeRow as { id: string }).id;

    const lineRows =
      apSource > 0
        ? [
            {
              journal_entry_id: jeId,
              account_id: equityId,
              debit: amt,
              credit: 0,
              description: 'Opening balance — offset (Owner Capital)',
            },
            {
              journal_entry_id: jeId,
              account_id: apId,
              debit: 0,
              credit: amt,
              description: 'Opening balance — payable',
            },
          ]
        : [
            {
              journal_entry_id: jeId,
              account_id: apId,
              debit: amt,
              credit: 0,
              description: 'Opening balance — payable (debit)',
            },
            {
              journal_entry_id: jeId,
              account_id: equityId,
              debit: 0,
              credit: amt,
              description: 'Opening balance — offset (Owner Capital)',
            },
          ];

    const { error: lnErr } = await supabase.from('journal_entry_lines').insert(lineRows);
    if (lnErr) throw lnErr;
    journalsCreated.push(jeId);
  }

  return { plans, normalizedContactIds, journalsCreated, journalsVoided };
}

export type VerificationSummary = {
  controls: Record<string, { debit: number; credit: number; netDrMinusCr: number }>;
  apOpeningCount: number;
  /** Active AP opening JEs sharing the same reference_id (should be empty). */
  apDuplicates: { contactId: string; count: number }[];
  arOpeningCount: number;
  workerOpeningCount: number;
  supplierCandidatesRemaining: number;
  bothReviewRemaining: number;
};

export async function runVerificationSummary(
  supabase: SupabaseClient,
  companyId: string
): Promise<VerificationSummary> {
  const contacts = await fetchContactsForCompany(supabase, companyId);
  const apJes = await fetchApOpeningJournals(supabase, companyId);
  const dups = findDuplicateApOpenings(apJes);

  const { count: arCount } = await supabase
    .from('journal_entries')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('reference_type', REF_AR)
    .or('is_void.is.null,is_void.eq.false');

  const { count: workerCount } = await supabase
    .from('journal_entries')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('reference_type', REF_WORKER)
    .or('is_void.is.null,is_void.eq.false');

  const controls = await snapshotControlAccounts(supabase, companyId, ['1100', '2000', '2010', '3000']);

  return {
    controls,
    apOpeningCount: apJes.length,
    apDuplicates: [...dups.entries()].map(([contactId, count]) => ({ contactId, count })),
    arOpeningCount: arCount ?? 0,
    workerOpeningCount: workerCount ?? 0,
    supplierCandidatesRemaining: findSupplierOnlyNormalizeCandidates(contacts).length,
    bothReviewRemaining: findBothTypeReview(contacts).length,
  };
}
