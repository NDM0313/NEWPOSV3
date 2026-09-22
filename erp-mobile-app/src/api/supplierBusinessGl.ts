/**
 * Mobile Supplier Business GL — parity with web `src/app/lib/supplierBusinessGl.ts`.
 * Components: ap_2000 + legacy_2090. Excludes worker/courier.
 * Sign: credit − debit (positive = payable). READ-ONLY.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { fetchInBatches } from '../lib/chunkInQuery';
import { enrichLedgerLinesWithHasAttachments } from '../lib/loadMergedAttachments';
import type { LedgerLine } from './reports';
import {
  attributePartyIdForJournalLine,
  classifyJournalGlComponent,
  type JournalGlComponent,
} from '../lib/journalPartyAttribution';
import {
  loadPartyAttributedGlLedger,
  loadVerifiedAccountRemaps,
  type AttributedGlRow,
  type PartyAttributedGlResult,
} from './partyAttributedGlLedger';

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
  openingRows: AttributedGlRow[];
  periodRows: AttributedGlRow[];
  totals: SupplierBusinessHistoryTotals;
  /** Period lines as mobile LedgerLine (+ synthetic opening not included). */
  lines: LedgerLine[];
  openingBalance: number;
};

export type SupplierBusinessBalanceSlice = {
  businessNet: number;
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

export function filterSupplierBusinessAttributedRows(rows: AttributedGlRow[]): AttributedGlRow[] {
  return rows.filter((r) => {
    const c = glComponentFromAttributedNotes(r.notes);
    if (!c) {
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

function attributedRowToLedgerLine(r: AttributedGlRow, index: number, running: number): LedgerLine {
  const jelId = r.journal_line_id;
  const id =
    jelId != null && String(jelId).trim() !== ''
      ? String(jelId)
      : `biz-${String(r.journal_entry_id || 'line')}-${index}`;
  const entryNo = r.entry_no != null && String(r.entry_no).trim() !== '' ? String(r.entry_no) : '';
  const reference =
    entryNo !== ''
      ? entryNo
      : r.reference_number ||
        (String(r.journal_entry_id || '').length >= 8
          ? String(r.journal_entry_id).slice(0, 8)
          : '—');
  return {
    id,
    journalEntryId: String(r.journal_entry_id || ''),
    sourceReferenceId: null,
    date: String(r.date || '').slice(0, 10),
    createdAt: r.created_at != null ? String(r.created_at) : '',
    entryNo,
    description: String(r.description || '—'),
    reference,
    referenceType: String(r.reference_type || ''),
    debit: Number(r.debit || 0),
    credit: Number(r.credit || 0),
    runningBalance: running,
    paymentId: r.payment_id ?? null,
    glAccountCode: String(r.gl_account_code || '') || null,
  };
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
  if (!isSupabaseConfigured) {
    return {
      attributed: {
        officialApRows: [],
        attributedRows: [],
        unresolvedLineCount: 0,
        officialApNet: 0,
      },
      openingRows: [],
      periodRows: [],
      totals: { opening: 0, periodDebit: 0, periodCredit: 0, closing: 0 },
      lines: [],
      openingBalance: 0,
    };
  }

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

  let run = totals.opening;
  const rawLines = periodRows.map((r, i) => {
    run += Number(r.credit || 0) - Number(r.debit || 0);
    return attributedRowToLedgerLine(r, i, run);
  });
  const lines = await enrichLedgerLinesWithHasAttachments(params.companyId, rawLines);

  return {
    attributed: {
      ...attributed,
      attributedRows: businessRows,
    },
    openingRows,
    periodRows,
    totals,
    lines,
    openingBalance: totals.opening,
  };
}

/**
 * Batch supplier business + official AP nets as-of endDate.
 * One accounts scan + paged lines scan — not N per-contact attributed loads.
 *
 * Fail-loud: on line-fetch failure returns `{ complete: false, error }` with an
 * empty map so callers never treat "all zeros" as successful Business GL.
 */
export type SupplierBusinessGlBalancesResult = {
  map: Map<string, SupplierBusinessBalanceSlice>;
  error: string | null;
  /** True only when journal lines were scanned successfully (true zeros are valid). */
  complete: boolean;
  meta: {
    accountCount: number;
    lineCount: number;
    supplierCount: number;
    durationMs: number;
  };
};

export async function loadSupplierBusinessGlBalancesMap(params: {
  companyId: string;
  branchId?: string | null;
  endDate?: string | null;
}): Promise<SupplierBusinessGlBalancesResult> {
  const emptyMeta = { accountCount: 0, lineCount: 0, supplierCount: 0, durationMs: 0 };
  const started = Date.now();
  const out = new Map<string, SupplierBusinessBalanceSlice>();
  if (!isSupabaseConfigured) {
    return {
      map: out,
      error: 'App not configured.',
      complete: false,
      meta: { ...emptyMeta, durationMs: Date.now() - started },
    };
  }

  const companyId = params.companyId;
  const branchId =
    params.branchId && params.branchId !== 'all' && params.branchId !== 'default'
      ? String(params.branchId).trim()
      : null;
  const endDate = params.endDate ? String(params.endDate).slice(0, 10) : null;

  const { data: contactsRaw, error: contactsErr } = await supabase
    .from('contacts')
    .select('id, type')
    .eq('company_id', companyId);
  if (contactsErr) {
    return {
      map: out,
      error: contactsErr.message,
      complete: false,
      meta: { ...emptyMeta, durationMs: Date.now() - started },
    };
  }
  const supplierContactIds = new Set(
    (contactsRaw || [])
      .filter((c: { id: string; type: string }) => isSupplierBusinessContactType(c.type))
      .map((c: { id: string }) => String(c.id)),
  );

  const remaps = await loadVerifiedAccountRemaps(companyId);
  const { data: accountsRaw, error: accountsErr } = await supabase
    .from('accounts')
    .select('id, code, name, parent_id, linked_contact_id, is_active')
    .eq('company_id', companyId);
  if (accountsErr) {
    return {
      map: out,
      error: accountsErr.message,
      complete: false,
      meta: {
        accountCount: 0,
        lineCount: 0,
        supplierCount: supplierContactIds.size,
        durationMs: Date.now() - started,
      },
    };
  }
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

  for (const id of supplierContactIds) {
    out.set(id, {
      businessNet: 0,
      officialApNet: 0,
      businessLineCount: 0,
      officialApLineCount: 0,
    });
  }

  if (accountIds.size === 0) {
    return {
      map: out,
      error: null,
      complete: true,
      meta: {
        accountCount: 0,
        lineCount: 0,
        supplierCount: supplierContactIds.size,
        durationMs: Date.now() - started,
      },
    };
  }

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
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[supplierBusinessGl] batch lines:', msg);
    return {
      map: new Map(),
      error: msg,
      complete: false,
      meta: {
        accountCount: accountIds.size,
        lineCount: 0,
        supplierCount: supplierContactIds.size,
        durationMs: Date.now() - started,
      },
    };
  }

  const seen = new Set<string>();
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
    if (endDate && entryDate > endDate) continue;

    const lineId = String((line as { id?: string }).id || '');
    if (lineId && seen.has(lineId)) continue;
    if (lineId) seen.add(lineId);

    const acc = (line as {
      account?: {
        id?: string;
        code?: string;
        linked_contact_id?: string;
        parent_id?: string;
      } | null;
    }).account;
    const accountId = String((line as { account_id?: string }).account_id || acc?.id || '');
    const attr = attributePartyIdForJournalLine({
      accountLinkedContactId: acc?.linked_contact_id ?? byId.get(accountId)?.linked_contact_id,
      accountId,
      verifiedRemaps: remaps,
      contactIdByAccountId: contactByAccount,
    });
    if (attr.unresolved || !attr.partyId || !supplierContactIds.has(attr.partyId)) continue;

    const accLike = byId.get(accountId) || {
      id: accountId,
      code: acc?.code ?? null,
      name: null,
      parent_id: acc?.parent_id ?? null,
      linked_contact_id: acc?.linked_contact_id ?? null,
      is_active: true,
    };
    const component = classifyJournalGlComponent(accLike, byId);
    const debit = Number((line as { debit?: number }).debit) || 0;
    const credit = Number((line as { credit?: number }).credit) || 0;
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

  return {
    map: out,
    error: null,
    complete: true,
    meta: {
      accountCount: accountIds.size,
      lineCount: seen.size,
      supplierCount: supplierContactIds.size,
      durationMs: Date.now() - started,
    },
  };
}

/** List-row balance: signed Business GL (Cr−Dr). Positive = payable. */
export function supplierBusinessListBalance(
  slice: SupplierBusinessBalanceSlice | undefined,
): number {
  return Number(slice?.businessNet || 0);
}
