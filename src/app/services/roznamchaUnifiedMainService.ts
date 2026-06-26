/**
 * Roznamcha — unified engine main loader (Phase 2.14).
 */

import type { UnifiedLedgerBasis } from '@/app/lib/unifiedLedgerBasisFilter';
import { isUnifiedLedgerKillSwitchActive } from '@/app/lib/unifiedLedgerEngineState';
import { mapUnifiedToRoznamchaResult } from '@/app/lib/roznamchaUnifiedMainMapper';
import {
  buildRoznamchaPreviewRpcScope,
  filterUnifiedRowsByPaymentAccount,
} from '@/app/lib/roznamchaUnifiedPreviewScope';
import { previewBasisFromVoidedToggle } from '@/app/lib/roznamchaUnifiedPreviewDiff';
import type { AccountFilter } from '@/app/services/roznamchaService';
import {
  getUnifiedCashBankLedger,
  type UnifiedLedgerRow,
} from '@/app/services/unifiedLedgerService';
import type { RoznamchaResult } from '@/app/services/roznamchaService';

export type RoznamchaUnifiedMainResult = RoznamchaResult & {
  unifiedRows: UnifiedLedgerRow[];
};

export async function loadRoznamchaUnifiedMain(params: {
  companyId: string;
  branchId: string | null;
  dateFrom: string;
  dateTo: string;
  accountFilter: AccountFilter;
  includeVoidedReversed: boolean;
  paymentLedgerAccountId: string | null;
  paymentAccountOptions: Array<{ id: string; label: string }>;
  basis?: UnifiedLedgerBasis;
}): Promise<RoznamchaUnifiedMainResult> {
  if (await isUnifiedLedgerKillSwitchActive(params.companyId)) {
    throw new Error('Unified main loader blocked — kill switch active.');
  }

  const basis = previewBasisFromVoidedToggle(params.includeVoidedReversed, params.basis);
  const rpcScope = buildRoznamchaPreviewRpcScope({
    branchId: params.branchId,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    accountFilter: params.accountFilter,
    includeVoidedReversed: params.includeVoidedReversed,
  });

  const unified = await getUnifiedCashBankLedger({
    companyId: params.companyId,
    branchId: rpcScope.branchId,
    dateFrom: rpcScope.dateFrom,
    dateTo: rpcScope.dateTo,
    basis,
    liquidity: rpcScope.liquidity,
    shadowForce: false,
  });

  const filteredRows = filterUnifiedRowsByPaymentAccount(
    unified.rows,
    params.paymentLedgerAccountId,
    params.paymentAccountOptions,
  );

  return mapUnifiedToRoznamchaResult({
    unified: {
      ...unified,
      rows: filteredRows,
      closingBalance:
        filteredRows.length > 0
          ? filteredRows[filteredRows.length - 1].runningBalance
          : unified.closingBalance,
    },
    rows: filteredRows,
  });
}
