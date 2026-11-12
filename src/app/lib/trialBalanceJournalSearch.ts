import { supabase } from '@/lib/supabase';
import type { TrialBalanceRow } from '@/app/services/accountingReportsService';

/** Branch-scoped reports include JEs with NULL branch_id (company-wide openings and legacy rows). */
function journalEntryMatchesBranchFilter(
  jeBranchId: string | null | undefined,
  filterBranchId?: string | null
): boolean {
  if (!filterBranchId || filterBranchId === 'all') return true;
  if (jeBranchId == null || jeBranchId === '') return true;
  return jeBranchId === filterBranchId;
}

export function trialBalanceRowMatchesAccountSearch(row: TrialBalanceRow, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;
  const textHay = [row.account_code, row.account_name, row.account_type]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (textHay.includes(q)) return true;
  const amtHay = [row.debit, row.credit, row.balance]
    .map((n) => String(n ?? ''))
    .join(' ');
  return amtHay.includes(q.replace(/,/g, ''));
}

export function filterTrialBalanceAccountRows(rows: TrialBalanceRow[], rawQuery: string): TrialBalanceRow[] {
  const q = rawQuery.trim();
  if (!q) return rows;
  return rows.filter((row) => trialBalanceRowMatchesAccountSearch(row, q));
}

export function computeTrialBalanceTotals(rows: TrialBalanceRow[]): {
  totalDebit: number;
  totalCredit: number;
  difference: number;
} {
  let rawTotalDebit = 0;
  let rawTotalCredit = 0;
  for (const row of rows) {
    rawTotalDebit += row.debit || 0;
    rawTotalCredit += row.credit || 0;
  }
  const totalDebit = Math.round(rawTotalDebit * 100) / 100;
  const totalCredit = Math.round(rawTotalCredit * 100) / 100;
  const difference = Math.round((totalDebit - totalCredit) * 100) / 100;
  return { totalDebit, totalCredit, difference };
}

function escapeIlikePattern(raw: string): string {
  return raw.replace(/[%_\\]/g, '\\$&');
}

type JeLineRow = {
  id: string;
  branch_id?: string | null;
  payment_id?: string | null;
  journal_entry_lines?: { account_id: string }[] | null;
};

function collectAccountIdsFromJournalRows(rows: JeLineRow[] | null | undefined, branchId?: string): Set<string> {
  const ids = new Set<string>();
  for (const je of rows || []) {
    if (!journalEntryMatchesBranchFilter(je.branch_id, branchId)) continue;
    for (const line of je.journal_entry_lines || []) {
      if (line?.account_id) ids.add(line.account_id);
    }
  }
  return ids;
}

/** Read-only: find account ids with journal lines matching ref/description in the trial balance period. */
export async function searchTrialBalanceJournalAccounts(opts: {
  companyId: string;
  startDate: string;
  endDate: string;
  branchId?: string;
  query: string;
}): Promise<Set<string>> {
  const { companyId, startDate, endDate, branchId, query } = opts;
  const q = query.trim();
  if (!q || !companyId) return new Set();

  const start = startDate.slice(0, 10);
  const end = endDate.slice(0, 10);
  const pattern = `%${escapeIlikePattern(q)}%`;

  const baseSelect = `
    id,
    branch_id,
    payment_id,
    journal_entry_lines ( account_id )
  `;

  const textOr = `entry_no.ilike.${pattern},document_no.ilike.${pattern},description.ilike.${pattern}`;

  const { data: textMatches, error: textErr } = await supabase
    .from('journal_entries')
    .select(baseSelect)
    .eq('company_id', companyId)
    .eq('is_void', false)
    .gte('entry_date', start)
    .lte('entry_date', end)
    .or(textOr);

  if (textErr) {
    console.warn('[trialBalanceJournalSearch] journal text search failed', textErr.message);
  }

  const accountIds = collectAccountIdsFromJournalRows(textMatches as JeLineRow[] | null, branchId);

  const { data: paymentRows, error: payErr } = await supabase
    .from('payments')
    .select('id')
    .eq('company_id', companyId)
    .ilike('reference_number', pattern)
    .limit(200);

  if (payErr) {
    console.warn('[trialBalanceJournalSearch] payment ref search failed', payErr.message);
    return accountIds;
  }

  const paymentIds = (paymentRows || []).map((p: { id: string }) => p.id).filter(Boolean);
  if (!paymentIds.length) return accountIds;

  const { data: paymentJeRows, error: payJeErr } = await supabase
    .from('journal_entries')
    .select(baseSelect)
    .eq('company_id', companyId)
    .eq('is_void', false)
    .gte('entry_date', start)
    .lte('entry_date', end)
    .in('payment_id', paymentIds);

  if (payJeErr) {
    console.warn('[trialBalanceJournalSearch] payment JE search failed', payJeErr.message);
    return accountIds;
  }

  for (const id of collectAccountIdsFromJournalRows(paymentJeRows as JeLineRow[] | null, branchId)) {
    accountIds.add(id);
  }

  return accountIds;
}

export function mergeTrialBalanceSearchResults(
  rows: TrialBalanceRow[],
  rawQuery: string,
  journalAccountIds: Set<string> | null,
  journalSearchEnabled: boolean
): TrialBalanceRow[] {
  const q = rawQuery.trim();
  if (!q) return rows;

  const accountMatches = filterTrialBalanceAccountRows(rows, q);
  if (!journalSearchEnabled || !journalAccountIds?.size) {
    return accountMatches;
  }

  const merged = new Map<string, TrialBalanceRow>();
  for (const row of accountMatches) merged.set(row.account_id, row);
  for (const row of rows) {
    if (journalAccountIds.has(row.account_id)) merged.set(row.account_id, row);
  }
  return Array.from(merged.values());
}
