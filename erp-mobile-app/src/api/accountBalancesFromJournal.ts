/**
 * GL account balances from journal lines only — aligned with web
 * `accountingReportsService.getAccountBalancesFromJournal` (company-wide).
 */
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { fetchInBatches } from '../lib/chunkInQuery';

type JournalEntryJoin = {
  entry_date?: string;
  company_id?: string;
  branch_id?: string | null;
  is_void?: boolean | null;
};

type JournalLineRow = {
  account_id: string;
  debit?: number;
  credit?: number;
  journal_entry?: JournalEntryJoin | JournalEntryJoin[] | null;
};

/**
 * Returns account_id → balance (debit − credit) for all active accounts up to asOfDate.
 * Company-wide: no branch filter. Voided JEs excluded.
 */
export async function getAccountBalancesFromJournal(
  companyId: string,
  asOfDate?: string
): Promise<{ map: Map<string, number>; error: string | null }> {
  if (!isSupabaseConfigured) return { map: new Map(), error: 'App not configured.' };
  if (!companyId) return { map: new Map(), error: 'Missing company.' };

  const end = (asOfDate ?? new Date().toISOString().slice(0, 10)).slice(0, 10);
  const start = '1900-01-01';

  const { data: accounts, error: accErr } = await supabase
    .from('accounts')
    .select('id')
    .eq('company_id', companyId)
    .eq('is_active', true);

  if (accErr) return { map: new Map(), error: accErr.message };
  const accountIds = (accounts || []).map((a: { id: string }) => String(a.id));
  if (!accountIds.length) return { map: new Map(), error: null };

  const lineSelect = `
    account_id,
    debit,
    credit,
    journal_entry:journal_entries(entry_date, company_id, branch_id, is_void)
  `;

  let lines: JournalLineRow[] = [];
  try {
    lines = await fetchInBatches(accountIds, async (chunk) => {
      const { data, error: chunkErr } = await supabase
        .from('journal_entry_lines')
        .select(lineSelect)
        .in('account_id', chunk);
      if (chunkErr) throw chunkErr;
      return (data || []) as JournalLineRow[];
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Journal balance fetch failed.';
    return { map: new Map(), error: msg };
  }

  const byAccount: Record<string, { debit: number; credit: number }> = {};
  for (const id of accountIds) {
    byAccount[id] = { debit: 0, credit: 0 };
  }

  for (const line of lines) {
    const rawJe = line.journal_entry;
    const je = Array.isArray(rawJe) ? rawJe[0] : rawJe;
    if (!je || je.company_id !== companyId) continue;
    if (je.is_void === true) continue;
    const ed = String(je.entry_date || '').slice(0, 10);
    if (ed < start || ed > end) continue;
    const accId = String(line.account_id || '');
    if (!accId) continue;
    if (!byAccount[accId]) byAccount[accId] = { debit: 0, credit: 0 };
    byAccount[accId].debit += Number(line.debit) || 0;
    byAccount[accId].credit += Number(line.credit) || 0;
  }

  const map = new Map<string, number>();
  for (const id of accountIds) {
    const d = byAccount[id] || { debit: 0, credit: 0 };
    map.set(id, Math.round((d.debit - d.credit) * 100) / 100);
  }

  return { map, error: null };
}
