/**
 * Account ledger admin compare — shadow only (Phase 2.2).
 */

import { isUnifiedLedgerKillSwitchActive } from '@/app/lib/unifiedLedgerEngineState';
import { normalizeCompareDateRange } from '@/app/components/admin/unified-ledger-compare/compareFilters';
import {
  balancePasses,
  closingBalanceFromLegacyRows,
  diffLedgerRows,
  legacyAccountRowKey,
  legacyToCompareSummary,
  round2,
  unifiedLedgerRowKey,
  unifiedToCompareSummary,
} from '@/app/lib/unifiedLedgerCompareDiff';
import type { LedgerCompareScope, LedgerRowCompareResult } from '@/app/lib/unifiedLedgerCompareTypes';
import {
  getUnifiedAccountLedger,
  loadLegacyAccountLedgerForTieOut,
  type UnifiedLedgerBasis,
} from '@/app/services/unifiedLedgerService';

export async function compareAccountLedgerTieOut(params: {
  companyId: string;
  accountId: string;
  branchId?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  basis: UnifiedLedgerBasis;
}): Promise<LedgerRowCompareResult> {
  const dates = normalizeCompareDateRange(params.dateFrom, params.dateTo);
  const scope: LedgerCompareScope = {
    companyId: params.companyId,
    branchId: params.branchId ?? null,
    dateFrom: dates.dateFrom,
    dateTo: dates.dateTo,
    basis: params.basis,
  };

  const killSwitchActive = await isUnifiedLedgerKillSwitchActive(params.companyId);

  const [legacy, unified] = await Promise.all([
    loadLegacyAccountLedgerForTieOut({
      companyId: params.companyId,
      accountId: params.accountId,
      branchId: params.branchId,
      dateFrom: dates.dateFrom,
      dateTo: dates.dateTo,
    }),
    getUnifiedAccountLedger({
      companyId: params.companyId,
      accountId: params.accountId,
      branchId: params.branchId,
      dateFrom: dates.dateFrom,
      dateTo: dates.dateTo,
      basis: params.basis,
      shadowForce: true,
    }),
  ]);

  const { missingInNew, extraInNew, amountMismatches } = diffLedgerRows({
    oldRows: legacy.rows,
    newRows: unified.rows,
    oldKey: legacyAccountRowKey,
    newKey: unifiedLedgerRowKey,
    oldToSummary: legacyToCompareSummary,
    newToSummary: unifiedToCompareSummary,
  });

  const oldBalance = closingBalanceFromLegacyRows(legacy.rows);
  const newBalance = unified.closingBalance;
  const difference = round2(oldBalance - newBalance);

  return {
    kind: 'account',
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
    basis: params.basis,
    oldEngineName: legacy.engineName,
    newEngineName: 'get_unified_account_ledger (shadow RPC)',
    oldQueryMs: legacy.durationMs,
    newQueryMs: unified.meta.queryDurationMs,
    shadowForce: true,
    killSwitchActive,
    rpcError: unified.meta.rpcError,
  };
}
