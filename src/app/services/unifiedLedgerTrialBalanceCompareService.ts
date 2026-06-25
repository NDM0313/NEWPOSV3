/**
 * Trial balance admin compare — shadow only (Phase 2.2).
 */

import { isUnifiedLedgerKillSwitchActive } from '@/app/lib/unifiedLedgerEngineState';
import { normalizeCompareDateRange } from '@/app/components/admin/unified-ledger-compare/compareFilters';
import {
  balancePasses,
  diffTrialBalanceAccounts,
  round2,
  compareTrialBalancePayloads,
} from '@/app/lib/unifiedLedgerCompareDiff';
import type { LedgerCompareScope, TrialBalanceCompareResult } from '@/app/lib/unifiedLedgerCompareTypes';
import {
  getUnifiedTrialBalance,
  loadLegacyTrialBalanceForTieOut,
  type UnifiedLedgerBasis,
} from '@/app/services/unifiedLedgerService';

export async function compareTrialBalanceTieOut(params: {
  companyId: string;
  branchId?: string | null;
  dateFrom: string;
  dateTo: string;
  basis: UnifiedLedgerBasis;
}): Promise<TrialBalanceCompareResult> {
  const dates = normalizeCompareDateRange(params.dateFrom, params.dateTo);
  const scope: LedgerCompareScope = {
    companyId: params.companyId,
    branchId: params.branchId ?? null,
    dateFrom: dates.dateFrom,
    dateTo: dates.dateTo,
    asOfDate: dates.dateTo ?? params.dateTo,
    basis: params.basis,
  };

  const killSwitchActive = await isUnifiedLedgerKillSwitchActive(params.companyId);

  const [legacy, unified] = await Promise.all([
    loadLegacyTrialBalanceForTieOut({
      companyId: params.companyId,
      branchId: params.branchId,
      dateFrom: dates.dateFrom ?? params.dateFrom,
      dateTo: dates.dateTo ?? params.dateTo,
    }),
    getUnifiedTrialBalance({
      companyId: params.companyId,
      branchId: params.branchId,
      asOfDate: dates.dateTo ?? params.dateTo,
      basis: params.basis,
      shadowForce: true,
    }),
  ]);

  const accountDiffs = diffTrialBalanceAccounts(legacy.result.rows, unified.accounts);
  const debitDiff = round2(legacy.result.totalDebit - unified.totalDebit);
  const creditDiff = round2(legacy.result.totalCredit - unified.totalCredit);
  const difference = round2(debitDiff);

  const pass =
    accountDiffs.length === 0 &&
    balancePasses(legacy.result.difference) &&
    balancePasses(unified.difference) &&
    balancePasses(debitDiff) &&
    balancePasses(creditDiff);

  return {
    kind: 'trial_balance',
    scope,
    oldBalance: legacy.result.totalDebit - legacy.result.totalCredit,
    newBalance: unified.totalDebit - unified.totalCredit,
    difference,
    pass,
    oldTotalDebit: legacy.result.totalDebit,
    newTotalDebit: unified.totalDebit,
    oldTotalCredit: legacy.result.totalCredit,
    newTotalCredit: unified.totalCredit,
    oldAccountCount: legacy.result.rows.length,
    newAccountCount: unified.accountCount,
    accountDiffs,
    basis: params.basis,
    oldEngineName: legacy.engineName,
    newEngineName: 'get_unified_trial_balance (shadow RPC)',
    oldQueryMs: legacy.durationMs,
    newQueryMs: unified.meta.queryDurationMs,
    shadowForce: true,
    killSwitchActive,
    rpcError: unified.meta.rpcError,
  };
}

export { compareTrialBalancePayloads };
