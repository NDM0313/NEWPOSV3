/**
 * ARIF LHR Supplier Business History pilot (DIN COLLECTION only).
 * Read-model helpers + thin wrapper around partyAttributedGlLedgerService.
 * Does NOT mutate JE / accounts / contacts.
 *
 * Pure helpers (split / totals / gate) are import-safe for node:test.
 * The async loader uses a dynamic import so unit tests never load supabase.
 */

import type { AccountLedgerEntry } from '@/app/services/accountingService';
import type { PartyAttributedGlResult } from '@/app/services/partyAttributedGlLedgerService';

/** DIN COLLECTION */
export const ARIF_PILOT_COMPANY_ID = 'e08a04af-22a8-4869-9b4d-da31fce13158';
/** SUP-ZHD-0017 ARIF LHR */
export const ARIF_PILOT_CONTACT_ID = '21e1ac76-b911-44a1-87dd-6283969efa4c';
export const ARIF_PILOT_LEGACY_ACCOUNT_CODE = '210017';
export const ARIF_PILOT_LEGACY_ACCOUNT_ID = '719c0bab-9484-4cff-84b8-8a0f0ffecffd';
export const ARIF_PILOT_CONTACT_NAME = 'ARIF LHR';

export type ArifPilotViewMode = 'business_history' | 'official_ap';

export type ArifAttributedLineLike = {
  journal_line_id?: string | null;
  date: string;
  debit?: number | null;
  credit?: number | null;
};

export type ArifBusinessHistoryTotals = {
  opening: number;
  periodDebit: number;
  periodCredit: number;
  closing: number;
};

export type ArifBusinessHistoryResult = {
  attributed: PartyAttributedGlResult;
  openingRows: AccountLedgerEntry[];
  periodRows: AccountLedgerEntry[];
  totals: ArifBusinessHistoryTotals;
  /** Opening Balance synthetic row + period rows with liability-style running balances. */
  statementRows: AccountLedgerEntry[];
};

export function isArifSupplierBusinessPilot(
  companyId: string | null | undefined,
  contactId: string | null | undefined,
): boolean {
  return (
    String(companyId || '') === ARIF_PILOT_COMPANY_ID &&
    String(contactId || '') === ARIF_PILOT_CONTACT_ID
  );
}

/** Deduplicate by journal_line_id before any totals. Rows without id keep first-seen order. */
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

/**
 * Split attributed history that was loaded WITHOUT startDate filtering.
 * openingRows: entry_date < startDate
 * periodRows: startDate <= entry_date <= endDate
 */
export function splitArifBusinessHistoryRows<T extends ArifAttributedLineLike>(
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

/** Liability-style supplier convention: net = credit − debit. */
export function computeArifBusinessHistoryTotals(
  openingRows: ArifAttributedLineLike[],
  periodRows: ArifAttributedLineLike[],
): ArifBusinessHistoryTotals {
  const liabilityNet = (rows: ArifAttributedLineLike[]) =>
    rows.reduce((s, r) => s + (Number(r.credit || 0) - Number(r.debit || 0)), 0);

  const opening = liabilityNet(openingRows);
  const periodDebit = periodRows.reduce((s, r) => s + Number(r.debit || 0), 0);
  const periodCredit = periodRows.reduce((s, r) => s + Number(r.credit || 0), 0);
  const closing = opening + periodCredit - periodDebit;
  return { opening, periodDebit, periodCredit, closing };
}

export function buildArifBusinessHistoryStatementRows(
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
    journal_entry_id: 'arif-pilot-opening',
    journal_line_id: null,
    document_type: 'Opening Balance',
    gl_account_code: '',
    notes: 'arif_pilot:opening',
  };

  let run = opening;
  const body = periodRows.map((r) => {
    run += Number(r.credit || 0) - Number(r.debit || 0);
    return { ...r, running_balance: run };
  });

  return [openingRow, ...body];
}

/**
 * Load ARIF Business History with opening-balance safety:
 * underlying attributed read omits startDate (through endDate only),
 * then wrapper splits opening vs period.
 */
export async function loadArifBusinessHistory(params: {
  companyId: string;
  contactId: string;
  branchId?: string | null;
  startDate: string;
  endDate: string;
}): Promise<ArifBusinessHistoryResult | null> {
  if (!isArifSupplierBusinessPilot(params.companyId, params.contactId)) {
    return null;
  }

  const { loadPartyAttributedGlLedger } = await import(
    '@/app/services/partyAttributedGlLedgerService'
  );

  // MANDATORY: do not pass startDate — service drops entry_date < startDate when set.
  const attributed = await loadPartyAttributedGlLedger({
    companyId: params.companyId,
    contactId: params.contactId,
    branchId: params.branchId,
    startDate: null,
    endDate: params.endDate,
  });

  const { openingRows, periodRows } = splitArifBusinessHistoryRows(
    attributed.attributedRows,
    params.startDate,
    params.endDate,
  );
  const totals = computeArifBusinessHistoryTotals(openingRows, periodRows);
  const statementRows = buildArifBusinessHistoryStatementRows(
    totals.opening,
    periodRows,
    params.startDate,
  );

  return {
    attributed,
    openingRows,
    periodRows,
    totals,
    statementRows,
  };
}

/** Map ARIF Business History statement rows into Ledger Statement V2 table rows. */
export function mapArifBusinessHistoryToV2Rows(
  statementRows: AccountLedgerEntry[],
): Array<{
  id: string;
  date: string;
  referenceNo: string;
  transactionType: string;
  description: string;
  branch: string;
  debit: number;
  credit: number;
  runningBalance: number;
  paymentMethod: string;
  createdBy: string;
  hasAttachments: boolean;
  sourceKind: 'opening' | 'journal';
  journalEntryId?: string;
  paymentId?: string;
  glEntry: AccountLedgerEntry;
  sourceAccountCode: string;
}> {
  return statementRows.map((e, i) => {
    const isOpening =
      String(e.document_type || '').toLowerCase().includes('opening') ||
      String(e.description || '').toLowerCase().includes('opening balance');
    return {
      id: String(e.journal_line_id || e.journal_entry_id || `arif-bh-${i}`),
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
