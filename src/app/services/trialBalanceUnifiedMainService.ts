/**
 * Trial Balance — unified engine main loader (Phase 2.12).
 */

import type { UnifiedLedgerBasis } from '@/app/lib/unifiedLedgerBasisFilter';
import { isUnifiedLedgerKillSwitchActive } from '@/app/lib/unifiedLedgerEngineState';
import { mapUnifiedAccountsToTrialBalanceRows } from '@/app/lib/trialBalanceUnifiedMapper';
import { buildTrialBalancePreviewRpcScope } from '@/app/lib/trialBalanceUnifiedPreviewScope';
import { DEFAULT_TRIAL_BALANCE_PREVIEW_BASIS } from '@/app/lib/trialBalanceUnifiedPreviewDiff';
import type { TrialBalanceResult } from '@/app/services/accountingReportsService';
import {
  getUnifiedTrialBalance,
  type UnifiedTrialBalanceAccount,
} from '@/app/services/unifiedLedgerService';

export type TrialBalanceUnifiedMainResult = TrialBalanceResult & {
  accounts: UnifiedTrialBalanceAccount[];
};

export async function loadTrialBalanceUnifiedMain(params: {
  companyId: string;
  startDate: string;
  endDate: string;
  branchId?: string;
  basis?: UnifiedLedgerBasis;
}): Promise<TrialBalanceUnifiedMainResult> {
  if (await isUnifiedLedgerKillSwitchActive(params.companyId)) {
    throw new Error('Unified main loader blocked — kill switch active.');
  }

  const basis = params.basis ?? DEFAULT_TRIAL_BALANCE_PREVIEW_BASIS;
  const rpcScope = buildTrialBalancePreviewRpcScope({
    startDate: params.startDate,
    endDate: params.endDate,
    branchId: params.branchId,
  });

  const unified = await getUnifiedTrialBalance({
    companyId: params.companyId,
    branchId: rpcScope.branchId,
    asOfDate: rpcScope.asOfDate,
    basis,
    shadowForce: false,
  });

  return {
    rows: mapUnifiedAccountsToTrialBalanceRows(unified.accounts),
    totalDebit: unified.totalDebit,
    totalCredit: unified.totalCredit,
    difference: unified.difference,
    accounts: unified.accounts,
  };
}
