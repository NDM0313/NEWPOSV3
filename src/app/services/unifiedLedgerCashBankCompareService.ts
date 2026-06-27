/**
 * Cash/bank ledger admin compare — shadow only (Phase 2.2).
 */

import { isUnifiedLedgerKillSwitchActive } from '@/app/lib/unifiedLedgerEngineState';
import { APP_BUILD_COMMIT } from '@/app/lib/developerMode';
import { normalizeCompareDateRange } from '@/app/components/admin/unified-ledger-compare/compareFilters';
import type { UnifiedLedgerBasis } from '@/app/lib/unifiedLedgerBasisFilter';
import type { LedgerCompareScope, LedgerRowCompareResult } from '@/app/lib/unifiedLedgerCompareTypes';
import { evaluateCashBankComparePass } from '@/app/lib/roznamchaCashBankCompareMappers';
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

  const evaluated = evaluateCashBankComparePass({
    legacyRows: legacy.rows,
    unifiedRows: unified.rows,
    legacyClosing: legacy.closingBalance,
    unifiedClosing: unified.closingBalance,
  });

  return {
    kind: 'cash_bank',
    scope,
    oldBalance: evaluated.oldBalance,
    newBalance: evaluated.newBalance,
    difference: evaluated.difference,
    pass: evaluated.pass,
    oldRowCount: legacy.rows.length,
    newRowCount: unified.rows.length,
    missingInNew: evaluated.missingInNew,
    extraInNew: evaluated.extraInNew,
    amountMismatches: evaluated.amountMismatches,
    basis: compareBasis,
    oldEngineName:
      evaluated.manualReceiptSupplementCount > 0
        ? `${legacy.engineName} + ${evaluated.manualReceiptSupplementCount} manual_receipt GL supplement`
        : legacy.engineName,
    newEngineName:
      'Raw GL diagnostic — get_unified_cash_bank_ledger (shadow; not Roznamcha parity)',
    oldQueryMs: legacy.durationMs,
    newQueryMs: unified.meta.queryDurationMs,
    shadowForce: true,
    killSwitchActive,
    rpcError: unified.meta.rpcError,
    buildCommit: APP_BUILD_COMMIT,
    cashBankDiagnostic: {
      rowParityPass: evaluated.rowParityPass,
      periodMovementPass: evaluated.periodMovementPass,
      manualReceiptSupplementCount: evaluated.manualReceiptSupplementCount,
      compareSemantics: 'legacy_roznamcha_vs_raw_unified_gl_diagnostic',
    },
  };
}
