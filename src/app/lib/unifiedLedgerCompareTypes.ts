/**
 * Shared types for admin unified ledger compare (Phase 2.2).
 */

import type { UnifiedLedgerBasis } from '@/app/lib/unifiedLedgerBasisFilter';

export const DEFAULT_COMPARE_TOLERANCE = 0.01;

export type LedgerCompareScope = {
  companyId: string;
  branchId: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  asOfDate?: string | null;
  basis: UnifiedLedgerBasis;
};

export type LedgerCompareMeta = {
  oldEngineName: string;
  newEngineName: string;
  oldQueryMs: number;
  newQueryMs: number;
  shadowForce: true;
  killSwitchActive: boolean;
  rpcError?: string;
};

export type CompareRowSummary = {
  journalEntryId: string;
  entryNo: string | null;
  entryDate: string;
  referenceType: string | null;
  debit: number;
  credit: number;
  description: string;
};

export type CompareRowMismatch = {
  key: string;
  old: CompareRowSummary;
  new: CompareRowSummary;
};

export type LedgerCompareBalance = {
  oldBalance: number;
  newBalance: number;
  difference: number;
  pass: boolean;
};

export type LedgerRowCompareResult = LedgerCompareBalance &
  LedgerCompareMeta & {
    kind: 'party' | 'account' | 'cash_bank';
    oldRowCount: number;
    newRowCount: number;
    missingInNew: CompareRowSummary[];
    extraInNew: CompareRowSummary[];
    amountMismatches: CompareRowMismatch[];
    basis: UnifiedLedgerBasis;
    scope: LedgerCompareScope;
  };

export type TrialBalanceAccountDiff = {
  accountId: string;
  accountCode: string;
  accountName: string;
  oldNetBalance: number;
  newNetBalance: number;
  difference: number;
  kind: 'missing_in_new' | 'extra_in_new' | 'net_mismatch';
};

export type TrialBalanceCompareResult = LedgerCompareBalance &
  LedgerCompareMeta & {
    kind: 'trial_balance';
    oldTotalDebit: number;
    newTotalDebit: number;
    oldTotalCredit: number;
    newTotalCredit: number;
    oldAccountCount: number;
    newAccountCount: number;
    accountDiffs: TrialBalanceAccountDiff[];
    basis: UnifiedLedgerBasis;
    scope: LedgerCompareScope;
  };

export type UnifiedLedgerCompareTabId =
  | 'party'
  | 'pilot_batch'
  | 'account'
  | 'trial_balance'
  | 'cash_bank';
