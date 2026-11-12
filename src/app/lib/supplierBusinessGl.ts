/**
 * Canonical supplier Business GL read model (web).
 * Reuses partyAttributedGlLedgerService attribution (linked_contact_id + verified remaps).
 * Opening-safe: attributed read omits startDate; wrapper splits opening vs period.
 * Does NOT mutate JE / accounts / contacts. Official AP stays ap_2000-only.
 */

import type { AccountLedgerEntry } from '@/app/services/accountingService';
import type { PartyAttributedGlResult } from '@/app/services/partyAttributedGlLedgerService';
import type { JournalGlComponent } from '@/app/lib/journalPartyPosting';

/** DIN COLLECTION — ARIF golden fixture */
export const ARIF_GOLDEN_COMPANY_ID = 'e08a04af-22a8-4869-9b4d-da31fce13158';
export const ARIF_GOLDEN_CONTACT_ID = '21e1ac76-b911-44a1-87dd-6283969efa4c';
export const ARIF_GOLDEN_LEGACY_ACCOUNT_CODE = '210017';

export type SupplierStatementViewMode = 'business_history' | 'official_ap';

export type SupplierAttributedLineLike = {
  journal_line_id?: string | null;
  date: string;
  debit?: number | null;
  credit?: number | null;
  notes?: string | null;
  gl_account_code?: string | null;
};

export type SupplierBusinessHistoryTotals = {
  opening: number;
  periodDebit: number;
  periodCredit: number;
  closing: number;
};

export type SupplierBusinessHistoryResult = {
  attributed: PartyAttributedGlResult;
  openingRows: AccountLedgerEntry[];
  periodRows: AccountLedgerEntry[];
  totals: SupplierBusinessHistoryTotals;
  statementRows: AccountLedgerEntry[];
};

export type SupplierBusinessBalanceSlice = {
  /** Liability-style Cr−Dr across ap_2000 + legacy_2090 attributed lines (as-of endDate). */
  businessNet: number;
  /** Official AP control (ap_2000 only). */
  officialApNet: number;
  businessLineCount: number;
  officialApLineCount: number;
};

const SUPPLIER_BUSINESS_COMPONENTS = new Set<JournalGlComponent>(['ap_2000', 'legacy_2090']);

export function isSupplierBusinessContactType(type: string | null | undefined): boolean {
  const t = String(type || '').toLowerCase();
  if (!t) return false;
  if (t === 'worker' || t.includes('worker')) return false;
  if (t === 'courier' || t.includes('courier')) return false;
  return (
    t === 'supplier' ||
    t === 'both' ||
    t.includes('supplier') ||
    t === 'money_exchange' ||
    t.includes('money_exchange')
  );
}

export function glComponentFromAttributedNotes(notes: string | null | undefined): JournalGlComponent | null {
  const raw = String(notes || '').replace(/^gl_component:/, '').trim();
  if (!raw) return null;
  return raw as JournalGlComponent;
}

/** Keep merchandise supplier Business History legs only (AP + legacy 2090/210xxx). */
export function filterSupplierBusinessAttributedRows(rows: AccountLedgerEntry[]): AccountLedgerEntry[] {
  return rows.filter((r) => {
    const c = glComponentFromAttributedNotes(r.notes);
    if (!c) {
      // Fallback by account code when notes missing
      const code = String(r.gl_account_code || '');
      if (code.startsWith('AP-') || code === '2000') return true;
      if (/^210\d+/.test(code) || code === '2090') return true;
      return false;
    }
    return SUPPLIER_BUSINESS_COMPONENTS.has(c);
  });
}

export function dedupeAttributedRowsByJournalLineId<T extends { journal_line_id?: string | null }>(
  rows: T[],
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const id = String(row.journal_line_id || '').trim();
    if (id) {
      if (seen.has(id)) continue;
      seen.add(id);
    }
    out.push(row);
  }
  return out;
}

export function splitSupplierBusinessHistoryRows<T extends SupplierAttributedLineLike>(
  rows: T[],
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): { openingRows: T[]; periodRows: T[] } {
  const start = startDate ? String(startDate).slice(0, 10) : null;
  const end = endDate ? String(endDate).slice(0, 10) : null;
  const deduped = dedupeAttributedRowsByJournalLineId(rows);
  const openingRows: T[] = [];
  const periodRows: T[] = [];
  for (const row of deduped) {
    const d = String(row.date || '').slice(0, 10);
    if (!d) continue;
    if (start && d < start) {
      openingRows.push(row);
      continue;
    }
    if (end && d > end) continue;
    periodRows.push(row);
  }
  return { openingRows, periodRows };
}

export function computeSupplierBusinessHistoryTotals(
  openingRows: SupplierAttributedLineLike[],
  periodRows: SupplierAttributedLineLike[],
): SupplierBusinessHistoryTotals {
  const liabilityNet = (rows: SupplierAttributedLineLike[]) =>
    rows.reduce((s, r) => s + (Number(r.credit || 0) - Number(r.debit || 0)), 0);
  const opening = liabilityNet(openingRows);
  const periodDebit = periodRows.reduce((s, r) => s + Number(r.debit || 0), 0);
  const periodCredit = periodRows.reduce((s, r) => s + Number(r.credit || 0), 0);
  const closing = opening + periodCredit - periodDebit;
  return { opening, periodDebit, periodCredit, closing };
}

export function mapSupplierBusinessNetToDueAdvance(businessNet: number): {
  due: number;
  advanceGl: number;
} {
  const n = Number(businessNet) || 0;
  return {
    due: Math.max(0, n),
    advanceGl: Math.max(0, -n),
  };
}

export function buildSupplierBusinessHistoryStatementRows(
  opening: number,
  periodRows: AccountLedgerEntry[],
  startDate: string,
): AccountLedgerEntry[] {
  const start = String(startDate || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
  const openingRow: AccountLedgerEntry = {
    date: start,
    created_at: `${start}T00:00:00.000Z`,
    reference_number: 'OPENING',
    description: 'Opening Balance',
    debit: 0,
    credit: 0,
    running_balance: opening,
    source_module: 'Accounting',
    journal_entry_id: 'supplier-business-opening',
    journal_line_id: null,
    document_type: 'Opening Balance',
    gl_account_code: '',
    notes: 'supplier_business:opening',
  };
  let run = opening;
  const body = periodRows.map((r) => {
    run += Number(r.credit || 0) - Number(r.debit || 0);
    return { ...r, running_balance: run };
  });
  return [openingRow, ...body];
}

export function mapSupplierBusinessHistoryToV2Rows(statementRows: AccountLedgerEntry[]) {
  return statementRows.map((e, i) => {
    const isOpening =
      String(e.document_type || '').toLowerCase().includes('opening') ||
      String(e.description || '').toLowerCase().includes('opening balance');
    return {
      id: String(e.journal_line_id || e.journal_entry_id || `supplier-bh-${i}`),
      date: e.date,
      referenceNo: e.reference_number || '—',
      transactionType: e.document_type || (isOpening ? 'Opening Balance' : 'Journal'),
      description: e.description || '—',
      branch: e.branch_name || e.branch_id || '—',
      debit: Number(e.debit || 0),
      credit: Number(e.credit || 0),
      runningBalance: Number(e.running_balance || 0),
      paymentMethod: '—',
      createdBy: '—',
      hasAttachments: false,
      sourceKind: isOpening ? ('opening' as const) : ('journal' as const),
      journalEntryId: isOpening ? undefined : e.journal_entry_id,
      paymentId: e.payment_id,
      glEntry: e,
      sourceAccountCode: String(e.gl_account_code || ''),
    };
  });
}

/**
 * Per-contact Supplier Business History (opening-safe).
 * contactType optional — when provided, worker/courier roles are rejected.
 */
export async function loadSupplierBusinessHistory(params: {
  companyId: string;
  contactId: string;
  contactType?: string | null;
  branchId?: string | null;
  startDate: string;
  endDate: string;
}): Promise<SupplierBusinessHistoryResult | null> {
  if (params.contactType != null && !isSupplierBusinessContactType(params.contactType)) {
    return null;
  }

  const { loadPartyAttributedGlLedger } = await import(
    '@/app/services/partyAttributedGlLedgerService'
  );

  const attributed = await loadPartyAttributedGlLedger({
    companyId: params.companyId,
    contactId: params.contactId,
    branchId: params.branchId,
    startDate: null,
    endDate: params.endDate,
  });

  const businessRows = filterSupplierBusinessAttributedRows(attributed.attributedRows);
  const { openingRows, periodRows } = splitSupplierBusinessHistoryRows(
    businessRows,
    params.startDate,
    params.endDate,
  );
  const totals = computeSupplierBusinessHistoryTotals(openingRows, periodRows);
  const statementRows = buildSupplierBusinessHistoryStatementRows(
    totals.opening,
    periodRows,
    params.startDate,
  );

  return {
    attributed: {
      ...attributed,
      attributedRows: businessRows,
    },
    openingRows,
    periodRows,
    totals,
    statementRows,
  };
}

/**
 * Batch supplier business + official AP nets as-of endDate (for Contacts / C&S overlay).
 * One accounts scan + one lines scan — not N per-contact attributed loads.
 */
export async function loadSupplierBusinessGlBalancesMap(params: {
  companyId: string;
  branchId?: string | null;
  endDate?: string | null;
}): Promise<Map<string, SupplierBusinessBalanceSlice>> {
  const { supabase } = await import('@/lib/supabase');
  const { loadVerifiedAccountRemaps } = await import(
    '@/app/services/partyAttributedGlLedgerService'
  );
  const {
    attributePartyIdForJournalLine,
    classifyJournalGlComponent,
  } = await import('@/app/lib/journalPartyPosting');

  const companyId = params.companyId;
  const branchId =
    params.branchId && params.branchId !== 'all' ? String(params.branchId).trim() : null;
  const endDate = params.endDate ? String(params.endDate).slice(0, 10) : null;

  const { data: contactsRaw } = await supabase
    .from('contacts')
    .select('id, type')
    .eq('company_id', companyId);
  const supplierContactIds = new Set(
    (contactsRaw || [])
      .filter((c: { id: string; type: string }) => isSupplierBusinessContactType(c.type))
      .map((c: { id: string }) => String(c.id)),
  );

  const remaps = await loadVerifiedAccountRemaps(companyId);
  const { data: accountsRaw } = await supabase
    .from('accounts')
    .select('id, code, name, parent_id, linked_contact_id, is_active')
    .eq('company_id', companyId);
  const accounts = (accountsRaw || []) as Array<{
    id: string;
    code: string | null;
    name: string | null;
    parent_id: string | null;
    linked_contact_id: string | null;
    is_active: boolean | null;
  }>;
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const contactByAccount = new Map(accounts.map((a) => [a.id, a.linked_contact_id] as const));

  const accountIds = new Set<string>();
  for (const a of accounts) {
    const cid = String(a.linked_contact_id || '');
    if (cid && supplierContactIds.has(cid)) accountIds.add(a.id);
  }
  for (const r of remaps) {
    const to = byId.get(r.toAccountId);
    const cid = to ? String(to.linked_contact_id || '') : '';
    if (cid && supplierContactIds.has(cid)) {
      accountIds.add(r.fromAccountId);
      accountIds.add(r.toAccountId);
    }
  }

  const out = new Map<string, SupplierBusinessBalanceSlice>();
  for (const id of supplierContactIds) {
    out.set(id, {
      businessNet: 0,
      officialApNet: 0,
      businessLineCount: 0,
      officialApLineCount: 0,
    });
  }

  if (accountIds.size === 0) return out;

  // Chunk `.in(account_id)` and page each chunk — a single PostgREST call hits URI
  // length and/or the default 1000-row cap (DIN COLLECTION alone has 5k+ party lines),
  // which previously returned empty → all Business GL zeros on Balance Basis Guide.
  const { fetchInBatches } = await import('@/app/lib/chunkInQuery');
  const LINE_PAGE = 1000;
  let lines: unknown[] = [];
  try {
    lines = await fetchInBatches(
      [...accountIds],
      async (chunk) => {
        const page: unknown[] = [];
        for (let from = 0; ; from += LINE_PAGE) {
          const { data, error } = await supabase
            .from('journal_entry_lines')
            .select(
              `
              id, account_id, debit, credit,
              account:accounts(id, code, linked_contact_id, parent_id),
              journal_entry:journal_entries(id, entry_date, is_void, company_id, branch_id)
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
  } catch (e) {
    console.error(
      '[supplierBusinessGl] batch lines:',
      e instanceof Error ? e.message : String(e),
    );
    return out;
  }

  const seen = new Set<string>();
  for (const line of lines || []) {
    const entry = (line as any).journal_entry;
    if (!entry || entry.is_void === true) continue;
    if (String(entry.company_id || '') && String(entry.company_id) !== companyId) continue;
    if (branchId) {
      const bid = entry.branch_id;
      if (bid != null && bid !== '' && bid !== branchId) continue;
    }
    const entryDate = String(entry.entry_date || '').slice(0, 10);
    if (endDate && entryDate > endDate) continue;

    const lineId = String((line as any).id || '');
    if (lineId && seen.has(lineId)) continue;
    if (lineId) seen.add(lineId);

    const acc = (line as any).account as
      | { id?: string; code?: string; linked_contact_id?: string; parent_id?: string }
      | null;
    const accountId = String((line as any).account_id || acc?.id || '');
    const attr = attributePartyIdForJournalLine({
      accountLinkedContactId: acc?.linked_contact_id ?? byId.get(accountId)?.linked_contact_id,
      accountId,
      verifiedRemaps: remaps,
      contactIdByAccountId: contactByAccount,
    });
    if (attr.unresolved || !attr.partyId || !supplierContactIds.has(attr.partyId)) continue;

    const accLike = byId.get(accountId) || {
      id: accountId,
      code: acc?.code,
      name: null,
      parent_id: acc?.parent_id ?? null,
      linked_contact_id: acc?.linked_contact_id ?? null,
      is_active: true,
    };
    const component = classifyJournalGlComponent(accLike as any, byId as any);
    const debit = Number((line as any).debit) || 0;
    const credit = Number((line as any).credit) || 0;
    const slice = out.get(attr.partyId)!;

    if (component === 'ap_2000') {
      slice.officialApNet += credit - debit;
      slice.officialApLineCount += 1;
      slice.businessNet += credit - debit;
      slice.businessLineCount += 1;
    } else if (component === 'legacy_2090') {
      slice.businessNet += credit - debit;
      slice.businessLineCount += 1;
    }
  }

  return out;
}
