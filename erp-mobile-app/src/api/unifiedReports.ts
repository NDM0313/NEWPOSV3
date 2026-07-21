/**
 * Unified financial report loaders for mobile — read-only, mirrors web main loaders.
 */

import { getRoznamcha } from './roznamcha';
import { enrichRowsWithTransactionAttachments } from '../lib/roznamchaAttachments';
import {
  effectiveReportLoaderSource,
  resolveReportMainLoaderSource,
} from '../lib/reportLoaderSource';
import {
  fetchActiveAccountsForBsPl,
  rpcGetUnifiedCashBankLedger,
  rpcGetUnifiedTrialBalance,
} from './unifiedLedgerRpc';
import {
  mapUnifiedAccountsToTrialBalanceRows,
  mapUnifiedTrialBalanceToBalanceSheetMain,
  mapUnifiedTrialBalanceToProfitLossMain,
} from '../lib/unifiedReportMappers';
import { isUnifiedLedgerKillSwitchActive } from '../lib/unifiedLedgerEngineState';
import type {
  BalanceSheetResult,
  CashFlowResult,
  ProfitLossResult,
  TrialBalanceResult,
  UnifiedLedgerBasis,
} from '../types/unifiedReports';

const BS_LIFETIME_START = '1900-01-01';

function normalizeBranch(branchId?: string | null): string | null {
  if (!branchId || branchId === 'all') return null;
  return branchId;
}

export type LoadResult<T> = {
  data: T | null;
  loaderSource: 'legacy' | 'unified' | 'unavailable';
  error: string | null;
};

async function loadTrialBalanceUnified(params: {
  companyId: string;
  startDate: string;
  endDate: string;
  branchId?: string | null;
  basis?: UnifiedLedgerBasis;
}): Promise<TrialBalanceResult & { error?: string }> {
  const basis = params.basis ?? ('official_gl' as UnifiedLedgerBasis);
  const asOfDate = params.endDate.slice(0, 10);
  const unified = await rpcGetUnifiedTrialBalance({
    companyId: params.companyId,
    branchId: normalizeBranch(params.branchId),
    asOfDate,
    basis,
  });
  if (unified.error) throw new Error(unified.error);
  const rows = mapUnifiedAccountsToTrialBalanceRows(unified.accounts);
  return {
    rows,
    totalDebit: unified.totalDebit,
    totalCredit: unified.totalCredit,
    difference: unified.difference,
  };
}

export async function loadMobileBalanceSheet(params: {
  companyId: string;
  asOfDate: string;
  branchId?: string | null;
  basis?: UnifiedLedgerBasis;
}): Promise<LoadResult<BalanceSheetResult>> {
  const resolved = await resolveReportMainLoaderSource(params.companyId, 'balance_sheet', {
    legacyAvailable: false,
  });
  const source = effectiveReportLoaderSource(resolved);
  if (source !== 'unified') {
    return {
      data: null,
      loaderSource: resolved.source === 'unavailable' ? 'unavailable' : 'legacy',
      error: 'Balance Sheet requires unified ledger flags. Enable on web for this company.',
    };
  }
  if (await isUnifiedLedgerKillSwitchActive(params.companyId)) {
    return { data: null, loaderSource: 'legacy', error: 'Unified loader blocked by kill switch.' };
  }
  try {
    const asOf = params.asOfDate.slice(0, 10);
    const tb = await loadTrialBalanceUnified({
      companyId: params.companyId,
      startDate: BS_LIFETIME_START,
      endDate: asOf,
      branchId: params.branchId,
      basis: params.basis,
    });
    const accounts = await fetchActiveAccountsForBsPl(params.companyId);
    const data = mapUnifiedTrialBalanceToBalanceSheetMain({ tb, accounts, asOfDate: asOf });
    return { data, loaderSource: 'unified', error: null };
  } catch (e) {
    return { data: null, loaderSource: 'legacy', error: (e as Error).message };
  }
}

export async function loadMobileProfitLoss(params: {
  companyId: string;
  startDate: string;
  endDate: string;
  branchId?: string | null;
  basis?: UnifiedLedgerBasis;
}): Promise<LoadResult<ProfitLossResult>> {
  const resolved = await resolveReportMainLoaderSource(params.companyId, 'profit_loss', {
    legacyAvailable: false,
  });
  const source = effectiveReportLoaderSource(resolved);
  if (source !== 'unified') {
    return {
      data: null,
      loaderSource: resolved.source === 'unavailable' ? 'unavailable' : 'legacy',
      error: 'P&L requires unified ledger flags.',
    };
  }
  if (await isUnifiedLedgerKillSwitchActive(params.companyId)) {
    return { data: null, loaderSource: 'legacy', error: 'Unified loader blocked by kill switch.' };
  }
  try {
    const tb = await loadTrialBalanceUnified({
      companyId: params.companyId,
      startDate: params.startDate,
      endDate: params.endDate,
      branchId: params.branchId,
      basis: params.basis,
    });
    const data = mapUnifiedTrialBalanceToProfitLossMain({
      rows: tb.rows,
      startDate: params.startDate,
      endDate: params.endDate,
    });
    return { data, loaderSource: 'unified', error: null };
  } catch (e) {
    return { data: null, loaderSource: 'legacy', error: (e as Error).message };
  }
}

export async function loadMobileTrialBalance(params: {
  companyId: string;
  startDate: string;
  endDate: string;
  branchId?: string | null;
  basis?: UnifiedLedgerBasis;
}): Promise<LoadResult<TrialBalanceResult>> {
  const resolved = await resolveReportMainLoaderSource(params.companyId, 'trial_balance', {
    legacyAvailable: false,
  });
  if (effectiveReportLoaderSource(resolved) !== 'unified') {
    return {
      data: null,
      loaderSource: resolved.source === 'unavailable' ? 'unavailable' : 'legacy',
      error: 'Trial Balance requires unified ledger flags.',
    };
  }
  try {
    const data = await loadTrialBalanceUnified(params);
    return { data, loaderSource: 'unified', error: null };
  } catch (e) {
    return { data: null, loaderSource: 'legacy', error: (e as Error).message };
  }
}

export type CashFlowAccountFilter = {
  id: string;
  code?: string | null;
  name?: string | null;
} | null;

function cashFlowAccountLabel(code?: string | null, name?: string | null, fallback?: string | null): string | null {
  const parts = [code, name].map((x) => (x != null ? String(x).trim() : '')).filter(Boolean);
  if (parts.length) return parts.join(' — ');
  return fallback?.trim() || null;
}

export async function loadMobileCashFlow(params: {
  companyId: string;
  startDate: string;
  endDate: string;
  branchId?: string | null;
  basis?: UnifiedLedgerBasis;
  /** When set, only cash/bank/wallet movements for this payment account */
  account?: CashFlowAccountFilter;
}): Promise<LoadResult<CashFlowResult>> {
  const resolved = await resolveReportMainLoaderSource(params.companyId, 'cash_flow', {
    legacyAvailable: true,
  });
  const source = effectiveReportLoaderSource(resolved);
  const basis = params.basis ?? ('official_gl' as UnifiedLedgerBasis);
  const accountFilter = params.account?.id ? params.account : null;
  const paymentLedgerAccountId = accountFilter?.id ?? null;

  // Unfiltered "All": prefer unified cash/bank ledger when enabled.
  // Account-id filter: legacy getRoznamcha (payment_account_id) — unified
  // cash-bank RPC has no account_id column.
  if (source === 'unified' && !paymentLedgerAccountId) {
    try {
      const unified = await rpcGetUnifiedCashBankLedger({
        companyId: params.companyId,
        branchId: normalizeBranch(params.branchId),
        dateFrom: params.startDate,
        dateTo: params.endDate,
        basis,
        liquidity: 'all',
      });
      if (unified.error) throw new Error(unified.error);
      let totalCashIn = 0;
      let totalCashOut = 0;
      const rows = unified.rows.map((r) => {
        totalCashIn += r.debit;
        totalCashOut += r.credit;
        const accountLabel = cashFlowAccountLabel(r.accountCode, r.accountName);
        return {
          id: r.journalEntryLineId,
          date: r.entryDate,
          reference: r.entryNo || '—',
          party: r.partyResolved,
          cashIn: r.debit,
          cashOut: r.credit,
          runningBalance: r.runningBalance,
          details: r.description || '—',
          accountLabel,
          accountName: r.accountName,
          accountCode: r.accountCode,
          sourcePaymentId: r.paymentId,
          sourceJournalEntryId: r.journalEntryId,
          referenceType: r.referenceType,
        };
      });
      await enrichRowsWithTransactionAttachments(params.companyId, rows);
      return {
        data: {
          rows,
          openingBalance: unified.openingBalance,
          closingBalance: unified.closingBalance,
          totalCashIn,
          totalCashOut,
          startDate: params.startDate,
          endDate: params.endDate,
        },
        loaderSource: 'unified',
        error: null,
      };
    } catch (e) {
      /* fall through to legacy roznamcha */
    }
  }

  try {
    const roz = await getRoznamcha(
      params.companyId,
      params.branchId ?? null,
      params.startDate,
      params.endDate,
      'all',
      false,
      paymentLedgerAccountId,
    );
    let totalCashIn = 0;
    let totalCashOut = 0;
    const rows = (roz.rows || []).map((r) => {
      const cashIn = r.cashIn ?? 0;
      const cashOut = r.cashOut ?? 0;
      totalCashIn += cashIn;
      totalCashOut += cashOut;
      return {
        id: r.id,
        date: r.date,
        reference: r.ref || r.journalEntryNo || '—',
        party: r.partyLine ?? null,
        cashIn,
        cashOut,
        runningBalance: r.runningBalance ?? 0,
        details: r.details || '—',
        accountLabel: r.accountLabel || cashFlowAccountLabel(null, r.accountName),
        accountName: r.accountName ?? null,
        paymentAccountId: r.paymentAccountId ?? null,
        attachments: r.attachments,
        sourcePaymentId: r.sourcePaymentId ?? null,
        sourceJournalEntryId: r.sourceJournalEntryId ?? null,
        referenceType: r.type ?? null,
      };
    });
    return {
      data: {
        rows,
        openingBalance: accountFilter ? 0 : roz.summary?.openingBalance ?? 0,
        closingBalance: accountFilter
          ? rows.length
            ? rows[rows.length - 1].runningBalance
            : 0
          : roz.summary?.closingBalance ?? rows[rows.length - 1]?.runningBalance ?? 0,
        totalCashIn,
        totalCashOut,
        startDate: params.startDate,
        endDate: params.endDate,
      },
      loaderSource: 'legacy',
      error: null,
    };
  } catch (e) {
    return { data: null, loaderSource: 'legacy', error: (e as Error).message };
  }
}

export { resolveReportMainLoaderSource, effectiveReportLoaderSource };
