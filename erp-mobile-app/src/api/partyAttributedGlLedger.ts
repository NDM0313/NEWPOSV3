/**
 * Party-attributed GL loaders for mobile — mirrors web
 * `partyAttributedGlLedgerService` (linked_contact_id + verified remaps).
 * READ-ONLY. No JE / account / contact mutation.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { fetchInBatches } from '../lib/chunkInQuery';
import {
  attributePartyIdForJournalLine,
  classifyJournalGlComponent,
  journalGlComponentLabel,
  type JournalGlComponent,
  type VerifiedAccountRemap,
} from '../lib/journalPartyAttribution';

export type AttributedGlRow = {
  date: string;
  created_at?: string | null;
  reference_number: string;
  entry_no?: string | null;
  description: string;
  debit: number;
  credit: number;
  running_balance: number;
  journal_entry_id: string;
  journal_line_id: string | null;
  payment_id?: string | null;
  reference_type?: string | null;
  branch_id?: string | null;
  branch_name?: string | null;
  gl_account_code: string;
  document_type: string;
  notes: string;
};

export type PartyAttributedGlResult = {
  officialApRows: AttributedGlRow[];
  attributedRows: AttributedGlRow[];
  unresolvedLineCount: number;
  officialApNet: number;
};

type AccRow = {
  id: string;
  code: string | null;
  name: string | null;
  parent_id: string | null;
  linked_contact_id: string | null;
  is_active: boolean | null;
};

function liabilityNet(component: JournalGlComponent, debit: number, credit: number): number {
  if (component === 'ar_1100' || component === 'worker_1180') return debit - credit;
  return credit - debit;
}

export async function loadVerifiedAccountRemaps(companyId: string): Promise<VerifiedAccountRemap[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('journal_account_verified_remaps')
    .select('from_account_id, to_account_id')
    .eq('company_id', companyId);
  if (error) {
    console.warn('[partyAttributedGl] verified remaps:', error.message);
    return [];
  }
  return (data || []).map((r: { from_account_id: string; to_account_id: string }) => ({
    fromAccountId: r.from_account_id,
    toAccountId: r.to_account_id,
  }));
}

const LINE_PAGE = 1000;

async function fetchLinesForAccountIds(accountIds: string[]): Promise<unknown[]> {
  return fetchInBatches(
    accountIds,
    async (chunk) => {
      const page: unknown[] = [];
      for (let from = 0; ; from += LINE_PAGE) {
        const { data, error } = await supabase
          .from('journal_entry_lines')
          .select(
            `
            id, account_id, debit, credit, description,
            account:accounts(id, name, code, linked_contact_id, parent_id),
            journal_entry:journal_entries(
              id, entry_no, entry_date, description, reference_type, payment_id,
              branch_id, created_at, is_void, company_id,
              branch:branches(id, name)
            )
          `,
          )
          .in('account_id', chunk)
          .range(from, from + LINE_PAGE - 1);
        if (error) throw error;
        const rows = data || [];
        page.push(...rows);
        if (rows.length < LINE_PAGE) break;
      }
      return page;
    },
    { chunkSize: 25, concurrency: 3 },
  );
}

/**
 * Load all journal lines whose account is linked to this contact, or whose
 * account has a verified remap target linked to this contact.
 */
export async function loadPartyAttributedGlLedger(params: {
  companyId: string;
  contactId: string;
  branchId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  verifiedRemaps?: VerifiedAccountRemap[];
}): Promise<PartyAttributedGlResult> {
  const empty: PartyAttributedGlResult = {
    officialApRows: [],
    attributedRows: [],
    unresolvedLineCount: 0,
    officialApNet: 0,
  };
  if (!isSupabaseConfigured) return empty;

  const { companyId, contactId } = params;
  const branchId =
    params.branchId && params.branchId !== 'all' && params.branchId !== 'default'
      ? String(params.branchId).trim()
      : null;
  const startDate = params.startDate ? params.startDate.slice(0, 10) : null;
  const endDate = params.endDate ? params.endDate.slice(0, 10) : null;

  const remaps = params.verifiedRemaps ?? (await loadVerifiedAccountRemaps(companyId));

  const { data: accountsRaw } = await supabase
    .from('accounts')
    .select('id, code, name, parent_id, linked_contact_id, is_active')
    .eq('company_id', companyId);

  const accounts = (accountsRaw || []) as AccRow[];
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const contactByAccount = new Map(accounts.map((a) => [a.id, a.linked_contact_id] as const));

  const accountIds = new Set<string>();
  for (const a of accounts) {
    if (String(a.linked_contact_id || '') === contactId) accountIds.add(a.id);
  }
  for (const r of remaps) {
    const to = byId.get(r.toAccountId);
    if (to && String(to.linked_contact_id || '') === contactId) {
      accountIds.add(r.fromAccountId);
      accountIds.add(r.toAccountId);
    }
  }

  if (accountIds.size === 0) return empty;

  let lines: unknown[] = [];
  try {
    lines = await fetchLinesForAccountIds([...accountIds]);
  } catch (e) {
    console.error(
      '[partyAttributedGl] lines:',
      e instanceof Error ? e.message : String(e),
    );
    return empty;
  }

  const attributedRows: AttributedGlRow[] = [];
  const officialApRows: AttributedGlRow[] = [];
  let unresolvedLineCount = 0;
  let officialApNet = 0;
  const seenLine = new Set<string>();

  for (const line of lines) {
    const entry = (line as { journal_entry?: Record<string, unknown> }).journal_entry as
      | Record<string, unknown>
      | undefined;
    if (!entry || entry.is_void === true) continue;
    if (String(entry.company_id || '') && String(entry.company_id) !== companyId) continue;
    if (branchId) {
      const bid = entry.branch_id;
      if (bid != null && bid !== '' && bid !== branchId) continue;
    }
    const entryDate = String(entry.entry_date || '').slice(0, 10);
    if (startDate && entryDate < startDate) continue;
    if (endDate && entryDate > endDate) continue;

    const lineId = String((line as { id?: string }).id || '');
    if (lineId && seenLine.has(lineId)) continue;
    if (lineId) seenLine.add(lineId);

    const acc = (line as { account?: AccRow | null }).account ?? null;
    const accountId = String(
      (line as { account_id?: string }).account_id || acc?.id || '',
    );
    const attr = attributePartyIdForJournalLine({
      accountLinkedContactId: acc?.linked_contact_id ?? byId.get(accountId)?.linked_contact_id,
      accountId,
      verifiedRemaps: remaps,
      contactIdByAccountId: contactByAccount,
    });

    if (attr.unresolved || attr.partyId !== contactId) {
      if (attr.unresolved) unresolvedLineCount += 1;
      continue;
    }

    const accLike = byId.get(accountId) || {
      id: accountId,
      code: acc?.code ?? null,
      name: acc?.name ?? null,
      parent_id: acc?.parent_id ?? null,
      linked_contact_id: acc?.linked_contact_id ?? null,
      is_active: true,
    };
    const component = classifyJournalGlComponent(accLike, byId);
    const debit = Number((line as { debit?: number }).debit) || 0;
    const credit = Number((line as { credit?: number }).credit) || 0;
    const branch = entry.branch as { name?: string } | undefined;

    const row: AttributedGlRow = {
      date: entryDate,
      created_at: entry.created_at != null ? String(entry.created_at) : null,
      reference_number: String(entry.entry_no || String(entry.id || '').slice(0, 8)),
      entry_no: entry.entry_no != null ? String(entry.entry_no) : null,
      description: `${journalGlComponentLabel(component)} — ${
        String(entry.description || (line as { description?: string }).description || '—')
      }`,
      debit,
      credit,
      running_balance: 0,
      journal_entry_id: String(entry.id || ''),
      journal_line_id: lineId || null,
      payment_id: entry.payment_id != null ? String(entry.payment_id) : null,
      reference_type: entry.reference_type != null ? String(entry.reference_type) : null,
      branch_id: entry.branch_id != null ? String(entry.branch_id) : null,
      branch_name: branch?.name ?? null,
      gl_account_code: String(acc?.code || accLike.code || ''),
      document_type: journalGlComponentLabel(component),
      notes: `gl_component:${component}`,
    };

    attributedRows.push(row);
    if (component === 'ap_2000') {
      officialApRows.push(row);
      officialApNet += liabilityNet(component, debit, credit);
    }
  }

  attributedRows.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return String(a.created_at || '').localeCompare(String(b.created_at || ''));
  });

  let run = 0;
  for (const r of attributedRows) {
    const comp = String(r.notes || '').replace('gl_component:', '') as JournalGlComponent;
    run += liabilityNet(comp, r.debit, r.credit);
    r.running_balance = run;
  }

  return {
    officialApRows,
    attributedRows,
    unresolvedLineCount,
    officialApNet,
  };
}
