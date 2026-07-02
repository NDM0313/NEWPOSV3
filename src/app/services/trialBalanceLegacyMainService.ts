/**
 * Trial Balance — legacy main loader (Phase 2.12).
 */

import {
  accountingReportsService,
  type TrialBalanceArApMode,
  type TrialBalanceResult,
} from '@/app/services/accountingReportsService';

export async function loadTrialBalanceLegacyMain(params: {
  companyId: string;
  startDate: string;
  endDate: string;
  branchId?: string;
  arApMode: TrialBalanceArApMode;
}): Promise<TrialBalanceResult> {
  return accountingReportsService.getTrialBalance(
    params.companyId,
    params.startDate,
    params.endDate,
    params.branchId,
    { arApMode: params.arApMode },
  );
}
