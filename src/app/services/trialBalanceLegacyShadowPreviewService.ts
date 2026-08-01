/**
 * Trial Balance — legacy shadow preview loader (Phase 2.12).
 *
 * R8-R2 rehearsal: thin LegacyMain wrapper deleted; shadow calls getTrialBalance directly.
 */

import {
  accountingReportsService,
  type TrialBalanceArApMode,
  type TrialBalanceResult,
} from '@/app/services/accountingReportsService';

export type TrialBalanceLegacyShadowPreviewResult = TrialBalanceResult & {
  compareSource: 'legacy_shadow';
};

export async function loadTrialBalanceLegacyShadowPreview(params: {
  companyId: string;
  startDate: string;
  endDate: string;
  branchId?: string;
  arApMode: TrialBalanceArApMode;
}): Promise<TrialBalanceLegacyShadowPreviewResult> {
  const data = await accountingReportsService.getTrialBalance(
    params.companyId,
    params.startDate,
    params.endDate,
    params.branchId,
    { arApMode: params.arApMode },
  );
  return { ...data, compareSource: 'legacy_shadow' };
}
