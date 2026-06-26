/**
 * Phase 2.15 — roznamcha unified loader parity assembler.
 * Uses roznamcha payment+journal composite engine (getRoznamcha) for totals/rows;
 * attaches filtered unified RPC rows for preview/compare metadata.
 */

import {
  buildRoznamchaPreviewRpcScope,
  filterUnifiedRowsByPaymentAccount,
} from '@/app/lib/roznamchaUnifiedPreviewScope';
import { previewBasisFromVoidedToggle } from '@/app/lib/roznamchaUnifiedPreviewDiff';
import { isUnifiedLedgerKillSwitchActive } from '@/app/lib/unifiedLedgerEngineState';
import type { UnifiedLedgerBasis } from '@/app/lib/unifiedLedgerBasisFilter';
import type { AccountFilter } from '@/app/services/roznamchaService';
import { getRoznamcha, type RoznamchaResult } from '@/app/services/roznamchaService';
import {
  getUnifiedCashBankLedger,
  type UnifiedLedgerRow,
} from '@/app/services/unifiedLedgerService';

export type RoznamchaUnifiedParityResult = RoznamchaResult & {
  unifiedRows: UnifiedLedgerRow[];
  parityEngine: 'roznamcha_payment_journal_composite';
};

export async function assembleRoznamchaUnifiedParityMain(params: {
  companyId: string;
  branchId: string | null;
  dateFrom: string;
  dateTo: string;
  accountFilter: AccountFilter;
  includeVoidedReversed: boolean;
  paymentLedgerAccountId: string | null;
  paymentAccountOptions: Array<{ id: string; label: string }>;
  basis?: UnifiedLedgerBasis;
}): Promise<RoznamchaUnifiedParityResult> {
  if (await isUnifiedLedgerKillSwitchActive(params.companyId)) {
    throw new Error('Unified main loader blocked — kill switch active.');
  }

  const rpcScope = buildRoznamchaPreviewRpcScope({
    branchId: params.branchId,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    accountFilter: params.accountFilter,
    includeVoidedReversed: params.includeVoidedReversed,
  });
  const basis = previewBasisFromVoidedToggle(params.includeVoidedReversed, params.basis);

  const [roz, unified] = await Promise.all([
    getRoznamcha(
      params.companyId,
      params.branchId,
      params.dateFrom,
      params.dateTo,
      params.accountFilter,
      params.includeVoidedReversed,
      params.paymentLedgerAccountId,
    ),
    getUnifiedCashBankLedger({
      companyId: params.companyId,
      branchId: rpcScope.branchId,
      dateFrom: rpcScope.dateFrom,
      dateTo: rpcScope.dateTo,
      basis,
      liquidity: rpcScope.liquidity,
      shadowForce: false,
    }),
  ]);

  const unifiedRows = filterUnifiedRowsByPaymentAccount(
    unified.rows,
    params.paymentLedgerAccountId,
    params.paymentAccountOptions,
  );

  return {
    ...roz,
    unifiedRows,
    parityEngine: 'roznamcha_payment_journal_composite',
  };
}
