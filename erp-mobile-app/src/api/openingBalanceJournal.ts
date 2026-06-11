/**
 * Opening balance → GL posting for chart accounts (mobile).
 * Idempotent per (reference_type, reference_id): one active JE; amount changes void prior and recreate.
 */
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { createJournalEntry, getAccounts } from './accounts';
import { ensureDefaultAccounts } from './defaultAccounts';
import type { AccountCategory } from '../lib/accountProfessionalCategory';

export const OPENING_BALANCE_REFERENCE = {
  GL_ACCOUNT: 'opening_balance_account',
} as const;

const MONEY_EPS = 0.02;

function roundMoney(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function normalizeBranchId(branchId?: string | null): string | undefined {
  if (!branchId || branchId === 'all') return undefined;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(branchId)) return undefined;
  return branchId;
}

function openingEntryDate(): string {
  return new Date().toISOString().slice(0, 10);
}

async function findAccountIdByCode(companyId: string, code: string): Promise<string | null> {
  const { data } = await getAccounts(companyId);
  const c = code.trim();
  const hit = (data || []).find((a) => String(a.code ?? '').trim() === c);
  return hit?.id ?? null;
}

/** Prefer 3000 Owner Capital / Capital; fallback first equity-type account. */
async function resolveOpeningEquityAccountId(companyId: string): Promise<string> {
  await ensureDefaultAccounts(companyId);
  let id = await findAccountIdByCode(companyId, '3000');
  if (id) return id;
  const { data: rows } = await getAccounts(companyId);
  const t = (rows || []).find(
    (a) =>
      String(a.type ?? '').toLowerCase() === 'equity' &&
      /capital|owner|opening/i.test(String(a.name ?? '')),
  );
  if (t?.id) return t.id;
  const anyEq = (rows || []).find((a) => String(a.type ?? '').toLowerCase() === 'equity');
  if (anyEq?.id) return anyEq.id;
  throw new Error(
    'Opening balance equity account not found (expected code 3000 or an equity account). Run default account setup.',
  );
}

async function findActiveOpeningEntry(
  companyId: string,
  referenceType: string,
  referenceId: string,
): Promise<{ id: string } | null> {
  if (!isSupabaseConfigured) return null;
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
  if (error && error.code !== 'PGRST116') {
    console.warn('[openingBalanceJournal] findActiveOpeningEntry:', error.message);
    return null;
  }
  return data?.id ? { id: data.id as string } : null;
}

async function voidJournalEntry(journalEntryId: string): Promise<void> {
  const { error } = await supabase
    .from('journal_entries')
    .update({ is_void: true, updated_at: new Date().toISOString() })
    .eq('id', journalEntryId);
  if (error) throw error;
}

async function sumLineOnAccount(
  journalEntryId: string,
  accountId: string,
): Promise<{ debit: number; credit: number }> {
  const { data, error } = await supabase
    .from('journal_entry_lines')
    .select('debit, credit')
    .eq('journal_entry_id', journalEntryId)
    .eq('account_id', accountId);
  if (error || !data?.length) return { debit: 0, credit: 0 };
  let debit = 0;
  let credit = 0;
  data.forEach((l: { debit?: number; credit?: number }) => {
    debit += Number(l.debit) || 0;
    credit += Number(l.credit) || 0;
  });
  return { debit: roundMoney(debit), credit: roundMoney(credit) };
}

async function reconcileOrVoidOpeningJe(params: {
  companyId: string;
  referenceType: string;
  referenceId: string;
  primaryAccountId: string;
  expectedPrimaryNet: number;
}): Promise<boolean> {
  const existing = await findActiveOpeningEntry(params.companyId, params.referenceType, params.referenceId);
  if (!existing) return false;
  const { debit, credit } = await sumLineOnAccount(existing.id, params.primaryAccountId);
  const net = roundMoney(debit - credit);
  if (Math.abs(net - roundMoney(params.expectedPrimaryNet)) <= MONEY_EPS) return true;
  await voidJournalEntry(existing.id);
  return false;
}

async function postBalancedOpening(params: {
  companyId: string;
  branchId?: string;
  referenceType: string;
  referenceId: string;
  description: string;
  lines: { account_id: string; debit: number; credit: number; description: string }[];
  entryDate: string;
}): Promise<void> {
  const totalDebit = roundMoney(params.lines.reduce((s, l) => s + l.debit, 0));
  const totalCredit = roundMoney(params.lines.reduce((s, l) => s + l.credit, 0));
  if (Math.abs(totalDebit - totalCredit) > MONEY_EPS) {
    throw new Error(`Opening balance JE not balanced: debit ${totalDebit} credit ${totalCredit}`);
  }
  if (totalDebit < MONEY_EPS && totalCredit < MONEY_EPS) return;

  const { error } = await createJournalEntry({
    companyId: params.companyId,
    branchId: params.branchId ?? null,
    entryDate: params.entryDate.slice(0, 10),
    description: params.description,
    referenceType: params.referenceType,
    referenceId: params.referenceId,
    lines: params.lines.map((l) => ({
      accountId: l.account_id,
      debit: l.debit,
      credit: l.credit,
      description: l.description,
    })),
  });
  if (error) throw new Error(error);
}

/**
 * Post opening for a chart/GL account (cash/bank/wallet or any COA row).
 */
export async function syncChartAccountOpening(params: {
  companyId: string;
  branchId?: string;
  accountId: string;
  accountCode?: string;
  accountName?: string;
  category: AccountCategory;
  openingAmount: number;
  /** GL entry_date for the opening balance JE (defaults to today). */
  entryDate?: string;
}): Promise<void> {
  const amt = roundMoney(Math.abs(params.openingAmount));
  if (amt < MONEY_EPS) {
    const ex = await findActiveOpeningEntry(
      params.companyId,
      OPENING_BALANCE_REFERENCE.GL_ACCOUNT,
      params.accountId,
    );
    if (ex) await voidJournalEntry(ex.id);
    return;
  }

  await ensureDefaultAccounts(params.companyId);
  const equityId = await resolveOpeningEquityAccountId(params.companyId);
  const branchId = normalizeBranchId(params.branchId);

  const debitNatural =
    params.category === 'Assets' || params.category === 'Cost of Sales' || params.category === 'Expenses';

  const primaryNet = debitNatural ? amt : -amt;
  const ok = await reconcileOrVoidOpeningJe({
    companyId: params.companyId,
    referenceType: OPENING_BALANCE_REFERENCE.GL_ACCOUNT,
    referenceId: params.accountId,
    primaryAccountId: params.accountId,
    expectedPrimaryNet: primaryNet,
  });
  if (ok) return;

  const label = [params.accountCode, params.accountName].filter(Boolean).join(' — ') || params.accountId;
  const lines = debitNatural
    ? [
        { account_id: params.accountId, debit: amt, credit: 0, description: `Opening balance — ${label}` },
        { account_id: equityId, debit: 0, credit: amt, description: 'Opening balance — offset (Owner Capital)' },
      ]
    : [
        { account_id: equityId, debit: amt, credit: 0, description: 'Opening balance — offset (Owner Capital)' },
        { account_id: params.accountId, debit: 0, credit: amt, description: `Opening balance — ${label}` },
      ];

  const entryDate = String(params.entryDate || '').trim().slice(0, 10) || openingEntryDate();
  await postBalancedOpening({
    companyId: params.companyId,
    branchId,
    referenceType: OPENING_BALANCE_REFERENCE.GL_ACCOUNT,
    referenceId: params.accountId,
    description: `Opening balance — account ${label}`,
    lines,
    entryDate,
  });
}
