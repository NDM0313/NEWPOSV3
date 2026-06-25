/**
 * Cash/bank ledger admin compare — shadow only (Phase 2.2).
 */

import { isUnifiedLedgerKillSwitchActive } from '@/app/lib/unifiedLedgerEngineState';
import {
  balancePasses,
  diffLedgerRows,
  round2,
} from '@/app/lib/unifiedLedgerCompareDiff';
import type { CompareRowSummary, LedgerCompareScope, LedgerRowCompareResult } from '@/app/lib/unifiedLedgerCompareTypes';
import type { RoznamchaRowWithBalance } from '@/app/services/roznamchaService';
import {
  getUnifiedCashBankLedger,
  loadLegacyCashBankForTieOut,
  type UnifiedLedgerBasis,
  type UnifiedLedgerRow,
} from '@/app/services/unifiedLedgerService';

function roznamchaRowKey(r: RoznamchaRowWithBalance): string {
  return r.id;
}

function roznamchaToSummary(r: RoznamchaRowWithBalance): CompareRowSummary {
  const debit = round2(r.cashIn || 0);
  const credit = round2(r.cashOut || 0);
  return {
    journalEntryId: r.sourceJournalEntryId || r.id,
    entryNo: r.ref || null,
    entryDate: r.date,
    referenceType: r.type || null,
    debit,
    credit,
    description: r.details || r.referenceDisplay || '—',
  };
}

function unifiedRowKey(r: UnifiedLedgerRow): string {
  return r.journalEntryLineId || r.journalEntryId;
}

function unifiedToSummary(r: UnifiedLedgerRow): CompareRowSummary {
  return {
    journalEntryId: r.journalEntryId,
    entryNo: r.entryNo,
    entryDate: r.entryDate,
    referenceType: r.referenceType,
    debit: r.debit,
    credit: r.credit,
    description: r.description,
  };
}

export async function compareCashBankLedgerTieOut(params: {
  companyId: string;
  branchId?: string | null;
  dateFrom: string;
  dateTo: string;
  basis: UnifiedLedgerBasis;
  liquidity?: 'cash' | 'bank' | 'wallet' | 'all';
}): Promise<LedgerRowCompareResult> {
  const scope: LedgerCompareScope = {
    companyId: params.companyId,
    branchId: params.branchId ?? null,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    basis: params.basis,
  };

  const killSwitchActive = await isUnifiedLedgerKillSwitchActive(params.companyId);
  const liquidity = params.liquidity ?? 'all';

  const [legacy, unified] = await Promise.all([
    loadLegacyCashBankForTieOut({
      companyId: params.companyId,
      branchId: params.branchId,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      liquidity,
    }),
    getUnifiedCashBankLedger({
      companyId: params.companyId,
      branchId: params.branchId,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      basis: params.basis,
      liquidity,
      shadowForce: true,
    }),
  ]);

  const { missingInNew, extraInNew, amountMismatches } = diffLedgerRows({
    oldRows: legacy.rows,
    newRows: unified.rows,
    oldKey: roznamchaRowKey,
    newKey: unifiedRowKey,
    oldToSummary: roznamchaToSummary,
    newToSummary: unifiedToSummary,
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
    basis: params.basis,
    oldEngineName: legacy.engineName,
    newEngineName: 'get_unified_cash_bank_ledger (shadow RPC)',
    oldQueryMs: legacy.durationMs,
    newQueryMs: unified.meta.queryDurationMs,
    shadowForce: true,
    killSwitchActive,
    rpcError: unified.meta.rpcError,
  };
}
