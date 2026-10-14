/**
 * CF-1 — Cash Flow report pure logic (read-only, no GL mutations).
 */

import {
  isCorrectionReversalReferenceType,
  shouldIncludeInNormalCashMovement,
} from '@/app/lib/reportVisibilityContract';
import { isGenericRoznamchaPartyLabel } from '@/app/lib/roznamchaCounterpartyLabel';
import { journalDescriptionForDisplay } from '@/app/utils/journalDescriptionDisplay';

export type CashFlowSourceModule =
  | 'sales_receipts'
  | 'purchase_payments'
  | 'expenses'
  | 'rentals'
  | 'transfers'
  | 'manual_je'
  | 'other';

export type CashFlowRowStatus = 'live' | 'voided' | 'reversed';

export const CASH_FLOW_SOURCE_MODULE_LABELS: Record<CashFlowSourceModule, string> = {
  sales_receipts: 'Sales receipts',
  purchase_payments: 'Purchase payments',
  expenses: 'Expenses',
  rentals: 'Rentals',
  transfers: 'Transfers',
  manual_je: 'Manual JE',
  other: 'Other',
};

export interface CashFlowSummary {
  opening: number;
  cashIn: number;
  cashOut: number;
  netMovement: number;
  closing: number;
}

export interface CashFlowEnrichInput {
  id: string;
  details: string;
  rowType: string;
  referenceType?: string | null;
  paymentVoidedAt?: string | null;
  journalIsVoid?: boolean | null;
  sourcePaymentId?: string | null;
  sourceJournalEntryId?: string | null;
}

export function inferCashFlowSourceModule(args: {
  rowType: string;
  referenceType?: string | null;
  rowId: string;
}): CashFlowSourceModule {
  const rt = String(args.referenceType || '').toLowerCase().trim();
  if (rt === 'sale' || rt === 'payment' || rt === 'on_account' || rt === 'manual_receipt') {
    return 'sales_receipts';
  }
  if (rt === 'purchase' || rt === 'manual_payment') return 'purchase_payments';
  if (rt === 'expense') return 'expenses';
  if (rt === 'rental') return 'rentals';
  if (rt === 'transfer') return 'transfers';
  if (rt === 'journal' || rt === 'general') return 'manual_je';

  const t = args.rowType.toLowerCase();
  if (t.includes('expense')) return 'expenses';
  if (t.includes('rental')) return 'rentals';
  if (t.includes('supplier') || t.includes('purchase')) return 'purchase_payments';
  if (t.includes('sale') || t.includes('customer') || t.includes('receipt')) return 'sales_receipts';
  if (t.includes('transfer')) return 'transfers';
  if (args.rowId.startsWith('jel-') || args.rowId.startsWith('orphan-')) return 'manual_je';
  return 'other';
}

export function resolveCashFlowRowStatus(input: CashFlowEnrichInput): CashFlowRowStatus {
  const rt = input.referenceType;
  if (isCorrectionReversalReferenceType(rt) || input.details.includes('Reversal — audit')) {
    return 'reversed';
  }
  if (
    input.paymentVoidedAt ||
    input.journalIsVoid === true ||
    input.details.includes('(voided)')
  ) {
    return 'voided';
  }
  return 'live';
}

export function cashFlowStatusLabel(status: CashFlowRowStatus): string {
  if (status === 'reversed') return 'Reversed';
  if (status === 'voided') return 'Voided';
  return 'Live';
}

/** Primary status + optional Audit tag for void/reversal rows shown in audit mode. */
export function cashFlowStatusBadges(status: CashFlowRowStatus, auditMode: boolean): string[] {
  const badges = [cashFlowStatusLabel(status)];
  if (auditMode && status !== 'live') badges.push('Audit');
  return badges;
}

export function cashFlowStatusBadgesText(status: CashFlowRowStatus, auditMode: boolean): string {
  return cashFlowStatusBadges(status, auditMode).join(' / ');
}

export function firstMeaningfulCashFlowPartyLabel(
  ...labels: Array<string | null | undefined>
): string | null {
  for (const label of labels) {
    const value = String(label ?? '').trim();
    if (value && !isGenericRoznamchaPartyLabel(value)) return value;
  }
  return null;
}

/** Party column: customer / supplier / GL account — never document ref. */
export function resolveCashFlowPartyDisplay(row: {
  party: string | null;
  details: string;
}): string | null {
  return firstMeaningfulCashFlowPartyLabel(
    row.party,
    journalDescriptionForDisplay(row.details, ''),
  );
}

export const CASH_FLOW_CSV_HEADERS = [
  'Date',
  'Reference',
  'Party/contact',
  'Source module',
  'Cash/bank account',
  'In',
  'Out',
  'Running balance',
  'Status',
  'Branch',
] as const;

export interface CashFlowCsvRowInput {
  dateTime: string;
  reference: string;
  party: string | null;
  sourceModuleLabel: string;
  cashAccount: string;
  cashIn: number;
  cashOut: number;
  runningBalance: number;
  status: CashFlowRowStatus;
  branchName: string | null;
  auditMode: boolean;
}

export function buildCashFlowCsvRows(rows: CashFlowCsvRowInput[]): (string | number)[][] {
  return rows.map((r) => [
    r.dateTime,
    r.reference,
    r.party || '',
    r.sourceModuleLabel,
    r.cashAccount,
    r.cashIn > 0 ? r.cashIn : '',
    r.cashOut > 0 ? r.cashOut : '',
    r.runningBalance,
    cashFlowStatusBadgesText(r.status, r.auditMode),
    r.branchName || '',
  ]);
}

export function cashFlowFiltersAffectRunningBalance(args: {
  sourceModuleFilter: CashFlowSourceModule | 'all';
  paymentLedgerAccountId: string;
  accountFilter: string;
  searchTerm: string;
}): boolean {
  return (
    args.sourceModuleFilter !== 'all' ||
    Boolean(args.paymentLedgerAccountId.trim()) ||
    args.accountFilter !== 'all' ||
    Boolean(args.searchTerm.trim())
  );
}

/** Inclusive calendar-day span between YYYY-MM-DD bounds (0 if invalid). */
export const CASH_FLOW_SAFE_RANGE_DAYS = 92;

export function cashFlowDateRangeSpanDays(dateFrom: string, dateTo: string): number {
  const from = Date.parse(`${String(dateFrom || '').slice(0, 10)}T00:00:00`);
  const to = Date.parse(`${String(dateTo || '').slice(0, 10)}T00:00:00`);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return 0;
  return Math.floor((to - from) / (24 * 60 * 60 * 1000)) + 1;
}

export function cashFlowHeaderRangeExceedsSafeDays(dateFrom: string, dateTo: string): boolean {
  return cashFlowDateRangeSpanDays(dateFrom, dateTo) > CASH_FLOW_SAFE_RANGE_DAYS;
}

export function cashFlowRunningBalanceNote(filtersActive: boolean): string | null {
  if (!filtersActive) return null;
  return 'Running balance is calculated on the filtered rows.';
}

export function cashFlowAuditModeNote(auditMode: boolean): string | null {
  if (!auditMode) return null;
  return 'Audit mode includes voided/reversed rows for traceability. Normal totals exclude them.';
}

/** Normal mode row gate — mirrors reportVisibilityContract + roznamcha normal stream. */
export function includeCashFlowRowInNormalMode(input: CashFlowEnrichInput): boolean {
  return shouldIncludeInNormalCashMovement({
    referenceType: input.referenceType,
    journalIsVoid: input.journalIsVoid,
    paymentVoidedAt: input.paymentVoidedAt,
  });
}

export function filterCashFlowRowsBySourceModule<T extends { sourceModule: CashFlowSourceModule }>(
  rows: T[],
  moduleFilter: CashFlowSourceModule | 'all'
): T[] {
  if (moduleFilter === 'all') return rows;
  return rows.filter((r) => r.sourceModule === moduleFilter);
}

export function computeCashFlowSummary(
  rows: Array<{ cashIn: number; cashOut: number }>,
  opening: number
): CashFlowSummary {
  const cashIn = rows.reduce((s, r) => s + (Number(r.cashIn) || 0), 0);
  const cashOut = rows.reduce((s, r) => s + (Number(r.cashOut) || 0), 0);
  const netMovement = cashIn - cashOut;
  return {
    opening,
    cashIn,
    cashOut,
    netMovement,
    closing: opening + netMovement,
  };
}

export function recomputeCashFlowRunningBalance<T extends { cashIn: number; cashOut: number; runningBalance: number }>(
  rows: T[],
  opening: number
): T[] {
  let balance = opening;
  return rows.map((row) => {
    balance += (Number(row.cashIn) || 0) - (Number(row.cashOut) || 0);
    return { ...row, runningBalance: balance };
  });
}

/** Display safety: match CF `cashAccount` to a selected `code — name` payment ledger option. */
export function cashFlowRowMatchesSelectedAccount(
  cashAccount: string,
  selectedOption: { id: string; label: string } | undefined,
): boolean {
  if (!selectedOption) return false;
  const label = selectedOption.label.trim();
  if (!label) return false;
  const ca = (cashAccount || '').trim().toLowerCase();
  if (!ca) return false;
  const codePart = label.split(' — ')[0]?.trim().toLowerCase() || '';
  const namePart = label.includes(' — ')
    ? label.split(' — ').slice(1).join(' — ').trim().toLowerCase()
    : label.toLowerCase();
  if (namePart && ca === namePart) return true;
  if (namePart && ca.includes(namePart)) return true;
  if (codePart && ca.includes(codePart)) return true;
  if (label.toLowerCase().includes(ca)) return true;
  return false;
}

/** One roznamcha entity key per movement — payment, rental payment, or journal header. */
export function cashFlowSourceDedupeKey(row: {
  id: string;
  sourcePaymentId?: string | null;
  sourceJournalEntryId?: string | null;
  sourceRentalPaymentId?: string | null;
}): string {
  if (row.sourcePaymentId) return `pay:${row.sourcePaymentId}`;
  if (row.sourceRentalPaymentId) return `rp:${row.sourceRentalPaymentId}`;
  if (row.sourceJournalEntryId) return `je:${row.sourceJournalEntryId}`;
  return `row:${row.id}`;
}

export function assertUniqueCashFlowSourceKeys(
  rows: Array<{
    id: string;
    sourcePaymentId?: string | null;
    sourceJournalEntryId?: string | null;
    sourceRentalPaymentId?: string | null;
  }>
): boolean {
  const seen = new Set<string>();
  for (const row of rows) {
    const key = cashFlowSourceDedupeKey(row);
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return true;
}

/** CF-2 — GL cash flow statement bucket (journal-classified). */
export interface GlCashFlowBucket {
  in: number;
  out: number;
  net: number;
}

export interface GlCashFlowStatementSummary {
  operating: GlCashFlowBucket;
  investing: GlCashFlowBucket;
  financing: GlCashFlowBucket;
  netChange: number;
}

/** GL cash flow entry filter by basis. Official Posted GL includes correction_reversal. */
export function shouldIncludeInGlCashFlowEntry(
  referenceType: string | null | undefined,
  auditModeOrBasis: boolean | 'official_gl' | 'effective_party' = false
): boolean {
  if (auditModeOrBasis === true || auditModeOrBasis === 'official_gl') return true;
  return !isCorrectionReversalReferenceType(referenceType);
}

export function glCashFlowModeNote(auditMode: boolean, basis?: 'official_gl' | 'effective_party'): string {
  if (basis === 'official_gl' || auditMode) {
    return 'Official Posted GL — includes all non-void journal entries (correction/reversal included).';
  }
  return 'Effective operational — excludes correction/reversal entries (audit-only class).';
}

export const CASH_FLOW_TIEOUT_EXPLANATION =
  'Operational grid is based on cash/bank movement rows. GL summary groups journal activity by accounting class. ' +
  'Differences can occur due to classification, opening entries, manual JEs, or unclassified accounts.';

export interface CashFlowTieOutResult {
  operationalNetMovement: number;
  glNetMovement: number;
  difference: number;
}

export function computeCashFlowTieOut(
  operationalNetMovement: number,
  glNetMovement: number
): CashFlowTieOutResult {
  const op = Number(operationalNetMovement) || 0;
  const gl = Number(glNetMovement) || 0;
  return {
    operationalNetMovement: op,
    glNetMovement: gl,
    difference: Math.round((op - gl) * 100) / 100,
  };
}

export type CashFlowTieOutHintCode =
  | 'unclassified_je'
  | 'manual_cash_je'
  | 'reversal_audit'
  | 'missing_source_module'
  | 'missing_party_or_branch';

export interface CashFlowTieOutDiagnosticHint {
  code: CashFlowTieOutHintCode;
  label: string;
  count: number;
}

export interface CashFlowTieOutRowInput {
  sourceModule: CashFlowSourceModule;
  status: CashFlowRowStatus;
  referenceType?: string | null;
  party?: string | null;
  branchName?: string | null;
}

export function buildCashFlowTieOutDiagnosticHints(
  rows: CashFlowTieOutRowInput[]
): CashFlowTieOutDiagnosticHint[] {
  const counts: Record<CashFlowTieOutHintCode, number> = {
    unclassified_je: 0,
    manual_cash_je: 0,
    reversal_audit: 0,
    missing_source_module: 0,
    missing_party_or_branch: 0,
  };

  for (const row of rows) {
    if (row.sourceModule === 'other') counts.unclassified_je += 1;
    if (row.sourceModule === 'manual_je') counts.manual_cash_je += 1;
    if (row.status === 'reversed' || row.status === 'voided') counts.reversal_audit += 1;
    if (row.sourceModule === 'other' && !row.referenceType) counts.missing_source_module += 1;
    if (!row.party?.trim() || !row.branchName?.trim()) counts.missing_party_or_branch += 1;
  }

  const labels: Record<CashFlowTieOutHintCode, string> = {
    unclassified_je: 'Unclassified JE / other module rows',
    manual_cash_je: 'Manual cash/bank JE rows',
    reversal_audit: 'Reversal or voided audit rows',
    missing_source_module: 'Rows with missing source module mapping',
    missing_party_or_branch: 'Rows missing party or branch metadata',
  };

  return (Object.keys(counts) as CashFlowTieOutHintCode[])
    .filter((code) => counts[code] > 0)
    .map((code) => ({ code, label: labels[code], count: counts[code] }));
}
