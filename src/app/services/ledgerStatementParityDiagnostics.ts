/**
 * Read-only parity helpers — compare Account Statement vs Ledger V2 loaders/rows.
 * No DB access; safe for unit tests and developer diagnostics.
 */

/** Minimal row shape for diffing (matches AccountLedgerEntry fields used here). */
export interface ParityLedgerEntry {
  date?: string;
  reference_number?: string | null;
  entry_no?: string | null;
  description?: string | null;
  debit?: number | null;
  credit?: number | null;
  running_balance?: number | null;
  journal_entry_id?: string | null;
  document_type?: string | null;
  je_reference_type?: string | null;
}

export type PartyStatementBasis = 'effective_party' | 'audit_full';

/** Matches `STATEMENT_ALL_BRANCHES_SCOPE` in ledgerStatementCenterV2Service (all branches). */
export const PARITY_ALL_BRANCHES_SCOPE = undefined;

export interface AccountStatementCustomerRequest {
  loader: 'accountingService.getCustomerLedger';
  contactId: string;
  companyId: string;
  branchId: typeof PARITY_ALL_BRANCHES_SCOPE;
  startDate: string;
  endDate: string;
  searchTerm?: string;
  basis: PartyStatementBasis;
  includeAdjustments: boolean;
  includeReversals: boolean;
}

export interface LedgerV2CustomerRequest {
  loader: 'accountingService.getCustomerLedger';
  contactId: string;
  companyId: string;
  branchId: typeof PARITY_ALL_BRANCHES_SCOPE;
  fromDate: string;
  toDate: string;
  basis: 'official_gl';
}

export interface ParityRowSnapshot {
  key: string;
  date: string;
  reference: string;
  debit: number;
  credit: number;
  runningBalance: number;
  description: string;
  isOpening: boolean;
  isSynthetic: boolean;
  sourceKind: string;
}

export interface LedgerStatementParityDiff {
  balanceA: number;
  balanceB: number;
  difference: number;
  rowCountA: number;
  rowCountB: number;
  onlyInA: ParityRowSnapshot[];
  onlyInB: ParityRowSnapshot[];
  amountMismatches: Array<{
    key: string;
    a: ParityRowSnapshot;
    b: ParityRowSnapshot;
  }>;
  openingRowsA: ParityRowSnapshot[];
  openingRowsB: ParityRowSnapshot[];
  syntheticRowsA: ParityRowSnapshot[];
  syntheticRowsB: ParityRowSnapshot[];
}

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function partyStatementBasisFromFlags(
  includeAdjustments: boolean,
  includeReversals: boolean,
): PartyStatementBasis {
  return !includeAdjustments && !includeReversals ? 'effective_party' : 'audit_full';
}

/** Matches AccountLedgerReportPage customer load (all branches). */
export function buildAccountStatementCustomerRequest(params: {
  contactId: string;
  companyId: string;
  startDate: string;
  endDate: string;
  includeAdjustments?: boolean;
  includeReversals?: boolean;
  searchTerm?: string;
}): AccountStatementCustomerRequest {
  const includeAdjustments = params.includeAdjustments ?? true;
  const includeReversals = params.includeReversals ?? false;
  return {
    loader: 'accountingService.getCustomerLedger',
    contactId: params.contactId,
    companyId: params.companyId,
    branchId: PARITY_ALL_BRANCHES_SCOPE,
    startDate: params.startDate,
    endDate: params.endDate,
    searchTerm: params.searchTerm,
    includeAdjustments,
    includeReversals,
    basis: partyStatementBasisFromFlags(includeAdjustments, includeReversals),
  };
}

/** Matches ledgerStatementCenterV2Service.loadGlEntries for customer. */
export function buildLedgerV2CustomerRequest(params: {
  contactId: string;
  companyId: string;
  fromDate: string;
  toDate: string;
}): LedgerV2CustomerRequest {
  return {
    loader: 'accountingService.getCustomerLedger',
    contactId: params.contactId,
    companyId: params.companyId,
    branchId: PARITY_ALL_BRANCHES_SCOPE,
    fromDate: params.fromDate,
    toDate: params.toDate,
    basis: 'official_gl',
  };
}

export function accountStatementAndLedgerV2RequestsMatch(
  a: AccountStatementCustomerRequest,
  b: LedgerV2CustomerRequest,
): boolean {
  return (
    a.loader === b.loader &&
    a.contactId === b.contactId &&
    a.companyId === b.companyId &&
    a.branchId === b.branchId &&
    a.startDate === b.fromDate &&
    a.endDate === b.toDate
  );
}

function isOpeningRow(e: ParityLedgerEntry): boolean {
  const d = String(e.description || '').toLowerCase();
  const t = String(e.document_type || '').toLowerCase();
  return d.includes('opening balance') || t.includes('opening balance');
}

function isSyntheticRow(e: ParityLedgerEntry): boolean {
  return !String(e.journal_entry_id || '').trim();
}

function rowRef(e: ParityLedgerEntry): string {
  return String(e.reference_number || e.entry_no || e.journal_entry_id || '').trim();
}

function sourceKind(e: ParityLedgerEntry): string {
  if (isOpeningRow(e)) return 'opening';
  if (isSyntheticRow(e)) return 'synthetic';
  return String(e.je_reference_type || e.document_type || 'journal').toLowerCase();
}

export function snapshotLedgerEntry(e: ParityLedgerEntry, idx: number): ParityRowSnapshot {
  return {
    key: `${e.date}|${rowRef(e)}|${round2(Number(e.debit) || 0)}|${round2(Number(e.credit) || 0)}|${idx}`,
    date: String(e.date || '').slice(0, 10),
    reference: rowRef(e) || '—',
    debit: round2(Number(e.debit) || 0),
    credit: round2(Number(e.credit) || 0),
    runningBalance: round2(Number(e.running_balance) || 0),
    description: String(e.description || ''),
    isOpening: isOpeningRow(e),
    isSynthetic: isSyntheticRow(e),
    sourceKind: sourceKind(e),
  };
}

export function deriveClosingBalanceFromEntries(rows: ParityLedgerEntry[]): number {
  if (!rows.length) return 0;
  const data = rows.filter((r) => !isOpeningRow(r));
  const last = data.length ? data[data.length - 1] : rows[rows.length - 1];
  return round2(Number(last.running_balance) || 0);
}

export function countOpeningRows(rows: ParityLedgerEntry[]): number {
  return rows.filter(isOpeningRow).length;
}

/** Pure row diff for same loader output (or A vs B snapshots). */
export function diffLedgerStatementRows(
  rowsA: ParityLedgerEntry[],
  rowsB: ParityLedgerEntry[],
): LedgerStatementParityDiff {
  const snapsA = rowsA.map(snapshotLedgerEntry);
  const snapsB = rowsB.map(snapshotLedgerEntry);

  const mapA = new Map<string, ParityRowSnapshot>();
  const mapB = new Map<string, ParityRowSnapshot>();
  snapsA.forEach((s) => mapA.set(`${s.date}|${s.reference}|${s.debit}|${s.credit}`, s));
  snapsB.forEach((s) => mapB.set(`${s.date}|${s.reference}|${s.debit}|${s.credit}`, s));

  const onlyInA: ParityRowSnapshot[] = [];
  const onlyInB: ParityRowSnapshot[] = [];
  const amountMismatches: LedgerStatementParityDiff['amountMismatches'] = [];

  mapA.forEach((a, k) => {
    const b = mapB.get(k);
    if (!b) {
      onlyInA.push(a);
      return;
    }
    if (a.runningBalance !== b.runningBalance) {
      amountMismatches.push({ key: k, a, b });
    }
  });
  mapB.forEach((b, k) => {
    if (!mapA.has(k)) onlyInB.push(b);
  });

  const balanceA = deriveClosingBalanceFromEntries(rowsA);
  const balanceB = deriveClosingBalanceFromEntries(rowsB);

  return {
    balanceA,
    balanceB,
    difference: round2(balanceA - balanceB),
    rowCountA: rowsA.length,
    rowCountB: rowsB.length,
    onlyInA,
    onlyInB,
    amountMismatches,
    openingRowsA: snapsA.filter((s) => s.isOpening),
    openingRowsB: snapsB.filter((s) => s.isOpening),
    syntheticRowsA: snapsA.filter((s) => s.isSynthetic && !s.isOpening),
    syntheticRowsB: snapsB.filter((s) => s.isSynthetic && !s.isOpening),
  };
}
