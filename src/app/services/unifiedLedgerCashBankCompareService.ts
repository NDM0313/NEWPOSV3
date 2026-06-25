/**
 * Cash/bank ledger admin compare — shadow only (Phase 2.2).
 */

import { isUnifiedLedgerKillSwitchActive } from '@/app/lib/unifiedLedgerEngineState';
import { normalizeCompareDateRange } from '@/app/components/admin/unified-ledger-compare/compareFilters';
import type { UnifiedLedgerBasis } from '@/app/lib/unifiedLedgerBasisFilter';
import { balancePasses, round2 } from '@/app/lib/unifiedLedgerCompareDiff';
import type { LedgerCompareScope, LedgerRowCompareResult } from '@/app/lib/unifiedLedgerCompareTypes';
import { diffCashBankLedgerRows } from '@/app/lib/roznamchaCashBankCompareMappers';
import {
  getUnifiedCashBankLedger,
  loadLegacyCashBankForTieOut,
} from '@/app/services/unifiedLedgerService';

/** Admin cash/bank compare — roznamcha has no basis lens; match unified official_gl. */
export const CASH_BANK_COMPARE_BASIS: UnifiedLedgerBasis = 'official_gl';

export async function compareCashBankLedgerTieOut(params: {
  companyId: string;
  branchId?: string | null;
  dateFrom: string;
  dateTo: string;
  basis: UnifiedLedgerBasis;
  liquidity?: 'cash' | 'bank' | 'wallet' | 'all';
}): Promise<LedgerRowCompareResult> {
  const dates = normalizeCompareDateRange(params.dateFrom, params.dateTo);
  const compareBasis = CASH_BANK_COMPARE_BASIS;
  const scope: LedgerCompareScope = {
    companyId: params.companyId,
    branchId: params.branchId ?? null,
    dateFrom: dates.dateFrom ?? params.dateFrom,
    dateTo: dates.dateTo ?? params.dateTo,
    basis: compareBasis,
  };

  const killSwitchActive = await isUnifiedLedgerKillSwitchActive(params.companyId);
  const liquidity = params.liquidity ?? 'all';

  const [legacy, unified] = await Promise.all([
    loadLegacyCashBankForTieOut({
      companyId: params.companyId,
      branchId: params.branchId,
      dateFrom: dates.dateFrom ?? params.dateFrom,
      dateTo: dates.dateTo ?? params.dateTo,
      liquidity,
    }),
    getUnifiedCashBankLedger({
      companyId: params.companyId,
      branchId: params.branchId,
      dateFrom: dates.dateFrom,
      dateTo: dates.dateTo,
      basis: compareBasis,
      liquidity,
      shadowForce: true,
    }),
  ]);

  const { missingInNew, extraInNew, amountMismatches } = diffCashBankLedgerRows({
    oldRows: legacy.rows,
    newRows: unified.rows,
  });

  const oldBalance = round2(legacy.closingBalance);
  const newBalance = unified.closingBalance;
  const difference = round2(oldBalance - newBalance);

  return {
    kind: 'cash_bank',
    scope,
    oldBalance,
    newBalance,
    difference,
    pass: balancePasses(difference),
    oldRowCount: legacy.rows.length,
    newRowCount: unified.rows.length,
    missingInNew,
    extraInNew,
    amountMismatches,
    basis: compareBasis,
    oldEngineName: legacy.engineName,
    newEngineName: 'get_unified_cash_bank_ledger (shadow RPC)',
    oldQueryMs: legacy.durationMs,
    newQueryMs: unified.meta.queryDurationMs,
    shadowForce: true,
    killSwitchActive,
    rpcError: unified.meta.rpcError,
  };
}
