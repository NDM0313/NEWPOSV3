/**
 * Trial Balance — legacy shadow preview loader (Phase 2.12).
 */

import type { TrialBalanceArApMode, TrialBalanceResult } from '@/app/services/accountingReportsService';
import { loadTrialBalanceLegacyMain } from '@/app/services/trialBalanceLegacyMainService';

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
  const data = await loadTrialBalanceLegacyMain(params);
  return { ...data, compareSource: 'legacy_shadow' };
}
