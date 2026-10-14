/**
 * Party-attributed GL activity across linked CoA leaves (2000 AP, legacy 210xxx,
 * worker 2010/1180, courier 203x) without folding non-AP into official AP totals.
 *
 * Attribution is line-level via linked_contact_id (or verified remap → target link).
 * JE-level party fallback is NOT used — two-party JEs stay split per line.
 */

import { supabase } from '@/lib/supabase';
import type { AccountLedgerEntry } from '@/app/services/accountingService';
import {
  attributePartyIdForJournalLine,
  classifyJournalGlComponent,
  journalGlComponentLabel,
  type JournalGlComponent,
  type VerifiedAccountRemap,
} from '@/app/lib/journalPartyPosting';

export type PartyAttributedComponentSummary = {
  component: JournalGlComponent;
  label: string;
  lineCount: number;
  debit: number;
  credit: number;
  /** Liability-style net (credit − debit) for AP/courier/worker payable; asset-style (debit − credit) for AR/WA. */
  net: number;
};

export type PartyAttributedGlResult = {
  /** Official AP (2000) rows for suppliers — same filter as control report when component=ap_2000. */
  officialApRows: AccountLedgerEntry[];
  /** All attributed lines for this party (may include legacy/worker/courier). */
  attributedRows: AccountLedgerEntry[];
  /** Lines on this party’s JE counterparts that could not be attributed (rare; cash etc. excluded). */
  unresolvedLineCount: number;
  components: PartyAttributedComponentSummary[];
  /** Sum of ap_2000 component only — do not mix worker/courier into AP control. */
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
  const { data, error } = await supabase
    .from('journal_account_verified_remaps')
    .select('from_account_id, to_account_id')
    .eq('company_id', companyId);
  if (error) {
    // Table may not be applied yet — soft empty.
    if (import.meta.env?.DEV) {
      console.warn('[partyAttributedGl] verified remaps:', error.message);
    }
    return [];
  }
  return (data || []).map((r: { from_account_id: string; to_account_id: string }) => ({
    fromAccountId: r.from_account_id,
    toAccountId: r.to_account_id,
  }));
}

/**
 * Load all journal lines whose account is linked to this contact, or whose
 * account has a verified remap target linked to this contact (retired unlinked legacy).
 */
export async function loadPartyAttributedGlLedger(params: {
  companyId: string;
  contactId: string;
  branchId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  verifiedRemaps?: VerifiedAccountRemap[];
}): Promise<PartyAttributedGlResult> {
  const { companyId, contactId } = params;
  const branchId =
    params.branchId && params.branchId !== 'all' ? String(params.branchId).trim() : null;
  const startDate = params.startDate ? params.startDate.slice(0, 10) : null;
  const endDate = params.endDate ? params.endDate.slice(0, 10) : null;

  const remaps = params.verifiedRemaps ?? (await loadVerifiedAccountRemaps(companyId));

  const { data: accountsRaw } = await supabase
    .from('accounts')
    .select('id, code, name, parent_id, linked_contact_id, is_active')
    .eq('company_id', companyId);

  const accounts = (accountsRaw || []) as AccRow[];
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const contactByAccount = new Map(
    accounts.map((a) => [a.id, a.linked_contact_id] as const),
  );

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

  if (accountIds.size === 0) {
    return {
      officialApRows: [],
      attributedRows: [],
      unresolvedLineCount: 0,
      components: [],
      officialApNet: 0,
    };
  }

  const idList = [...accountIds];
  const { data: lines, error } = await supabase
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
    .in('account_id', idList);

  if (error) {
    console.error('[partyAttributedGl] lines:', error.message);
    return {
      officialApRows: [],
      attributedRows: [],
      unresolvedLineCount: 0,
      components: [],
      officialApNet: 0,
    };
  }

  const componentTotals = new Map<
    JournalGlComponent,
    { debit: number; credit: number; lineCount: number }
  >();
  const attributedRows: AccountLedgerEntry[] = [];
  const officialApRows: AccountLedgerEntry[] = [];
  let unresolvedLineCount = 0;
  let officialApNet = 0;

  const seenLine = new Set<string>();

  for (const line of lines || []) {
    const entry = (line as any).journal_entry;
    if (!entry || entry.is_void === true) continue;
    if (String(entry.company_id || '') && String(entry.company_id) !== companyId) continue;
    if (branchId) {
      const bid = entry.branch_id;
      if (bid != null && bid !== '' && bid !== branchId) continue;
    }
    const entryDate = String(entry.entry_date || '').slice(0, 10);
    if (startDate && entryDate < startDate) continue;
    if (endDate && entryDate > endDate) continue;

    const lineId = String((line as any).id || '');
    if (lineId && seenLine.has(lineId)) continue;
    if (lineId) seenLine.add(lineId);

    const acc = (line as any).account as AccRow | null;
    const accountId = String((line as any).account_id || acc?.id || '');
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
      code: acc?.code,
      name: acc?.name,
      parent_id: acc?.parent_id,
      linked_contact_id: acc?.linked_contact_id,
    };
    const component = classifyJournalGlComponent(accLike as any, byId as any);
    const debit = Number((line as any).debit) || 0;
    const credit = Number((line as any).credit) || 0;

    const bucket = componentTotals.get(component) || { debit: 0, credit: 0, lineCount: 0 };
    bucket.debit += debit;
    bucket.credit += credit;
    bucket.lineCount += 1;
    componentTotals.set(component, bucket);

    const row: AccountLedgerEntry = {
      date: entryDate,
      created_at: entry.created_at,
      reference_number: entry.entry_no || String(entry.id || '').slice(0, 8),
      entry_no: entry.entry_no,
      description: `${journalGlComponentLabel(component)} — ${
        entry.description || (line as any).description || '—'
      }`,
      debit,
      credit,
      running_balance: 0,
      source_module: 'Accounting',
      journal_entry_id: entry.id,
      journal_line_id: lineId || null,
      payment_id: entry.payment_id || undefined,
      je_reference_type: entry.reference_type,
      branch_id: entry.branch_id || undefined,
      branch_name: entry.branch?.name,
      account_name: acc?.name || '',
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

  // Running balance on attributed view is informative only (mixed components).
  let run = 0;
  for (const r of attributedRows) {
    const comp = String(r.notes || '').replace('gl_component:', '') as JournalGlComponent;
    run += liabilityNet(comp || 'other', r.debit, r.credit);
    r.running_balance = run;
  }

  const components: PartyAttributedComponentSummary[] = [...componentTotals.entries()]
    .map(([component, t]) => ({
      component,
      label: journalGlComponentLabel(component),
      lineCount: t.lineCount,
      debit: t.debit,
      credit: t.credit,
      net: liabilityNet(component, t.debit, t.credit),
    }))
    .sort((a, b) => a.component.localeCompare(b.component));

  return {
    officialApRows,
    attributedRows,
    unresolvedLineCount,
    components,
    officialApNet,
  };
}
