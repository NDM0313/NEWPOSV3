/**
 * Phase 2.15 — roznamcha unified loader.
 * Default display: unified cash/bank RPC only (1 round-trip).
 * Optional parityCompare: also runs getRoznamcha composite for tie-out UIs.
 */

import {
  buildRoznamchaPreviewRpcScope,
  filterUnifiedRowsByPaymentAccount,
} from '@/app/lib/roznamchaUnifiedPreviewScope';
import { previewBasisFromVoidedToggle } from '@/app/lib/roznamchaUnifiedPreviewDiff';
import { mapUnifiedLedgerToRoznamchaResult } from '@/app/lib/roznamchaUnifiedMapper';
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
  parityEngine: 'unified_cash_bank_rpc' | 'roznamcha_payment_journal_composite';
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
  /** When true, also fetch legacy composite (compare/preview only). */
  parityCompare?: boolean;
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

  const mark = import.meta.env?.DEV ? `roznamchaUnifiedMain:${params.companyId}` : '';
  if (mark) console.time(mark);

  try {
    if (params.parityCompare) {
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

    const unified = await getUnifiedCashBankLedger({
      companyId: params.companyId,
      branchId: rpcScope.branchId,
      dateFrom: rpcScope.dateFrom,
      dateTo: rpcScope.dateTo,
      basis,
      liquidity: rpcScope.liquidity,
      shadowForce: false,
    });

    const unifiedRows = filterUnifiedRowsByPaymentAccount(
      unified.rows,
      params.paymentLedgerAccountId,
      params.paymentAccountOptions,
    );

    const mapped = mapUnifiedLedgerToRoznamchaResult(
      unifiedRows,
      unified.meta.periodOpeningBalance,
      params.accountFilter,
    );

    return {
      ...mapped,
      unifiedRows,
      parityEngine: 'unified_cash_bank_rpc',
    };
  } finally {
    if (mark) console.timeEnd(mark);
  }
}
