/**
 * Roznamcha — legacy shadow preview loader (Phase 2.14).
 * Used when main table is unified; preview panel loads legacy for side-by-side compare.
 *
 * R8-R2 rehearsal: thin LegacyMain wrapper deleted; shadow calls getRoznamcha directly.
 */

import {
  getRoznamcha,
  type AccountFilter,
  type RoznamchaResult,
} from '@/app/services/roznamchaService';

export type RoznamchaLegacyMainParams = {
  companyId: string;
  branchId: string | null;
  dateFrom: string;
  dateTo: string;
  accountFilter: AccountFilter;
  includeVoidedReversed: boolean;
  paymentLedgerAccountId: string | null;
};

export type RoznamchaLegacyShadowPreviewResult = {
  legacy: RoznamchaResult;
  closingBalance: number;
  openingBalance: number;
  compareSource: 'legacy_shadow';
};

export async function loadRoznamchaLegacyShadowPreview(
  params: RoznamchaLegacyMainParams,
): Promise<RoznamchaLegacyShadowPreviewResult> {
  const legacy = await getRoznamcha(
    params.companyId,
    params.branchId,
    params.dateFrom,
    params.dateTo,
    params.accountFilter,
    params.includeVoidedReversed,
    params.paymentLedgerAccountId,
  );
  return {
    legacy,
    closingBalance: legacy.summary.closingBalance,
    openingBalance: legacy.summary.openingBalance,
    compareSource: 'legacy_shadow',
  };
}
