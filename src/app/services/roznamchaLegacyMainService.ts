/**
 * Roznamcha — legacy main loader (Phase 2.14).
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

export async function loadRoznamchaLegacyMain(
  params: RoznamchaLegacyMainParams,
): Promise<RoznamchaResult> {
  return getRoznamcha(
    params.companyId,
    params.branchId,
    params.dateFrom,
    params.dateTo,
    params.accountFilter,
    params.includeVoidedReversed,
    params.paymentLedgerAccountId,
  );
}
