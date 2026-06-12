/**
 * CF-1 — Cash Flow report pure logic (read-only, no GL mutations).
 */

import {
  isCorrectionReversalReferenceType,
  shouldIncludeInNormalCashMovement,
} from '@/app/lib/reportVisibilityContract';

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
