/**
 * Pure diff helpers for Trial Balance unified preview compare (Phase 2.5).
 */

import type { TrialBalanceResult } from '@/app/services/accountingReportsService';
import type { UnifiedLedgerBasis } from '@/app/lib/unifiedLedgerBasisFilter';
import {
  balancePasses,
  diffTrialBalanceAccounts,
  round2,
} from '@/app/lib/unifiedLedgerCompareDiff';
import type { TrialBalanceAccountDiff } from '@/app/lib/unifiedLedgerCompareTypes';
import type { UnifiedTrialBalanceAccount } from '@/app/services/unifiedLedgerService';

export type TrialBalanceUnifiedPreviewDiff = {
  oldTotalDebit: number;
  newTotalDebit: number;
  oldTotalCredit: number;
  newTotalCredit: number;
  oldDifference: number;
  newDifference: number;
  debitDelta: number;
  creditDelta: number;
  differenceDelta: number;
  totalsPass: boolean;
  accountDiffs: TrialBalanceAccountDiff[];
  pass: boolean;
  oldAccountCount: number;
  newAccountCount: number;
};

export const DEFAULT_TRIAL_BALANCE_PREVIEW_BASIS: UnifiedLedgerBasis = 'official_gl';

export function compareTrialBalanceUnifiedPreview(args: {
  legacy: TrialBalanceResult;
  unifiedAccounts: UnifiedTrialBalanceAccount[];
  unifiedTotalDebit: number;
  unifiedTotalCredit: number;
  unifiedDifference: number;
}): TrialBalanceUnifiedPreviewDiff {
  const debitDelta = round2(args.legacy.totalDebit - args.unifiedTotalDebit);
  const creditDelta = round2(args.legacy.totalCredit - args.unifiedTotalCredit);
  const differenceDelta = round2(args.legacy.difference - args.unifiedDifference);

  const totalsPass =
    balancePasses(debitDelta) &&
    balancePasses(creditDelta) &&
    balancePasses(differenceDelta);

  const accountDiffs = diffTrialBalanceAccounts(args.legacy.rows, args.unifiedAccounts);

  const pass =
    accountDiffs.length === 0 &&
    totalsPass &&
    balancePasses(args.legacy.difference) &&
    balancePasses(args.unifiedDifference);

  return {
    oldTotalDebit: args.legacy.totalDebit,
    newTotalDebit: args.unifiedTotalDebit,
    oldTotalCredit: args.legacy.totalCredit,
    newTotalCredit: args.unifiedTotalCredit,
    oldDifference: args.legacy.difference,
    newDifference: args.unifiedDifference,
    debitDelta,
    creditDelta,
    differenceDelta,
    totalsPass,
    accountDiffs,
    pass,
    oldAccountCount: args.legacy.rows.length,
    newAccountCount: args.unifiedAccounts.length,
  };
}
