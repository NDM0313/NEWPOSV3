/**
 * Roznamcha — unified engine shadow preview loader (Phase 2.6).
 * Parallel fetch only — never imported by RoznamchaReport legacy load.
 */

import type { UnifiedLedgerBasis } from '@/app/lib/unifiedLedgerBasisFilter';
import { isUnifiedLedgerKillSwitchActive } from '@/app/lib/unifiedLedgerEngineState';
import { mapUnifiedRowsToRoznamchaPreview } from '@/app/lib/roznamchaUnifiedMapper';
import {
  buildRoznamchaPreviewRpcScope,
  filterUnifiedRowsByPaymentAccount,
} from '@/app/lib/roznamchaUnifiedPreviewScope';
import { previewBasisFromVoidedToggle } from '@/app/lib/roznamchaUnifiedPreviewDiff';
import type { RoznamchaPreviewRow } from '@/app/lib/roznamchaUnifiedMapper';
import type { AccountFilter } from '@/app/services/roznamchaService';
import {
  getUnifiedCashBankLedger,
  type UnifiedLedgerMeta,
  type UnifiedLedgerRow,
} from '@/app/services/unifiedLedgerService';

export type RoznamchaUnifiedPreviewResult = {
  rows: RoznamchaPreviewRow[];
  unifiedRows: UnifiedLedgerRow[];
  closingBalance: number;
  openingBalance: number;
  meta: UnifiedLedgerMeta;
  basis: UnifiedLedgerBasis;
  rpcScope: ReturnType<typeof buildRoznamchaPreviewRpcScope>;
  paymentAccountFilterApplied: boolean;
  blockedByKillSwitch?: boolean;
  blockReason?: string;
};

function blockedResult(
  basis: UnifiedLedgerBasis,
  message: string,
  rpcScope: ReturnType<typeof buildRoznamchaPreviewRpcScope>
): RoznamchaUnifiedPreviewResult {
  return {
    rows: [],
    unifiedRows: [],
    closingBalance: 0,
    openingBalance: 0,
    basis,
    rpcScope,
    paymentAccountFilterApplied: false,
    blockedByKillSwitch: true,
    blockReason: message,
    meta: {
      engine: 'disabled',
      basis,
      featureFlagEnabled: false,
      shadowForce: false,
      queryDurationMs: 0,
      rowCount: 0,
      periodOpeningBalance: 0,
      message,
    },
  };
}

export async function loadRoznamchaUnifiedPreview(params: {
  companyId: string;
  branchId: string | null;
  dateFrom: string;
  dateTo: string;
  accountFilter: AccountFilter;
  includeVoidedReversed: boolean;
  paymentLedgerAccountId: string | null;
  paymentAccountOptions: Array<{ id: string; label: string }>;
  basis?: UnifiedLedgerBasis;
}): Promise<RoznamchaUnifiedPreviewResult> {
  const rpcScope = buildRoznamchaPreviewRpcScope({
    branchId: params.branchId,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    accountFilter: params.accountFilter,
    includeVoidedReversed: params.includeVoidedReversed,
  });
  const basis = previewBasisFromVoidedToggle(params.includeVoidedReversed, params.basis);

  const killSwitchActive = await isUnifiedLedgerKillSwitchActive(params.companyId);
  if (killSwitchActive) {
    return blockedResult(
      basis,
      'Unified preview blocked — kill switch active on Roznamcha.',
      rpcScope
    );
  }

  const unified = await getUnifiedCashBankLedger({
    companyId: params.companyId,
    branchId: rpcScope.branchId,
    dateFrom: rpcScope.dateFrom,
    dateTo: rpcScope.dateTo,
    basis,
    liquidity: rpcScope.liquidity,
    shadowForce: true,
  });

  const filteredRows = filterUnifiedRowsByPaymentAccount(
    unified.rows,
    params.paymentLedgerAccountId,
    params.paymentAccountOptions
  );
  const paymentAccountFilterApplied = Boolean(params.paymentLedgerAccountId?.trim());

  return {
    rows: mapUnifiedRowsToRoznamchaPreview(filteredRows),
    unifiedRows: filteredRows,
    closingBalance: unified.closingBalance,
    openingBalance: unified.meta.periodOpeningBalance,
    meta: unified.meta,
    basis,
    rpcScope,
    paymentAccountFilterApplied,
  };
}
