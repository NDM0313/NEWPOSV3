/**
 * Central Mobile Single Core report adapter.
 * Resolves flags/scope, loads canonical unified RPCs, and normalizes errors
 * without inventing balances or silently converting failures to zeros.
 */

import { DEFAULT_UNIFIED_BASIS, type UnifiedLedgerBasis } from '../../types/unifiedReports';
import {
  effectiveReportLoaderSource,
  resolveReportMainLoaderSource,
  type ResolveReportLoaderResult,
} from '../../lib/reportLoaderSource';
import type { UnifiedReportScreenId } from '../../lib/unifiedLedgerFlagKeys';
import {
  rpcGetUnifiedAccountLedger,
  rpcGetUnifiedCashBankLedger,
  rpcGetUnifiedPartyLedger,
  rpcGetUnifiedTrialBalance,
} from '../unifiedLedgerRpc';
import type { AccountFilter } from '../roznamcha';

export {
  bumpAccountingRefreshEpoch,
  readAccountingRefreshEpoch,
  invalidateCompanyAccountingCaches,
  invalidateAfterAccountingWrite,
  clearAccountingStateOnLogout,
} from './accountingCache';

export {
  resolveSingleCoreScope,
  createLoaderMetadata,
  normalizeSingleCoreError,
  mapUnifiedRowsToLedgerLines,
  mapUnifiedCashBankToRoznamcha,
  toRpcDateOrNull,
  safeSingleCoreBranchId,
  type SingleCoreErrorCode,
  type SingleCoreError,
  type LoaderMetadata,
  type SingleCoreScope,
} from './pure';

import {
  resolveSingleCoreScope,
  createLoaderMetadata,
  normalizeSingleCoreError,
  mapUnifiedRowsToLedgerLines,
  mapUnifiedCashBankToRoznamcha,
  type LoaderMetadata,
  type SingleCoreScope,
  type SingleCoreError,
} from './pure';

export type PartyLedgerLoadResult = {
  lines: import('../reports').LedgerLine[];
  openingBalance: number;
  closingBalance: number;
  error: SingleCoreError | null;
  meta: LoaderMetadata;
};

export type RoznamchaLoadResult = {
  result: import('../roznamcha').RoznamchaResult | null;
  error: SingleCoreError | null;
  meta: LoaderMetadata;
};

export type AccountLedgerLoadResult = {
  lines: import('../reports').LedgerLine[];
  openingBalance: number;
  closingBalance: number;
  error: SingleCoreError | null;
  meta: LoaderMetadata;
};

const EPS = 0.005;

export async function resolveSingleCoreLoader(
  companyId: string,
  screenId: UnifiedReportScreenId,
  options?: { legacyAvailable?: boolean },
): Promise<ResolveReportLoaderResult> {
  return resolveReportMainLoaderSource(companyId, screenId, options);
}

function emptyMeta(
  scope: SingleCoreScope,
  screenId: UnifiedReportScreenId,
  resolved: ResolveReportLoaderResult,
  resultKind: LoaderMetadata['resultKind'],
  rpcName: string | null,
  fallbackReason?: string | null,
): LoaderMetadata {
  return createLoaderMetadata({
    resolved,
    scope,
    screenId,
    rpcName,
    fallbackReason,
    resultKind,
  });
}

/** Unified party ledger when flags ON; otherwise returns flags_off so caller uses legacy path. */
export async function loadPartyLedger(params: {
  companyId: string;
  partyType: 'customer' | 'supplier' | 'worker';
  partyId: string;
  branchId?: string | null;
  dateFrom?: string;
  dateTo?: string;
  basis?: UnifiedLedgerBasis;
}): Promise<PartyLedgerLoadResult> {
  const { scope, error: scopeErr } = resolveSingleCoreScope(params);
  if (!scope || scopeErr) {
    const resolved = await resolveSingleCoreLoader(params.companyId || '', 'party_ledger');
    return {
      lines: [],
      openingBalance: 0,
      closingBalance: 0,
      error: scopeErr ?? { code: 'missing_scope', message: 'Missing scope', retryable: false },
      meta: emptyMeta(
        scope ?? {
          companyId: params.companyId || '',
          branchId: null,
          dateFrom: '',
          dateTo: '',
          basis: DEFAULT_UNIFIED_BASIS,
        },
        'party_ledger',
        resolved,
        'error',
        null,
      ),
    };
  }

  const resolved = await resolveSingleCoreLoader(scope.companyId, 'party_ledger', {
    legacyAvailable: true,
  });
  if (effectiveReportLoaderSource(resolved) !== 'unified') {
    return {
      lines: [],
      openingBalance: 0,
      closingBalance: 0,
      error: {
        code: resolved.killSwitchActive ? 'kill_switch' : 'flags_off',
        message: resolved.killSwitchActive
          ? 'Unified ledger kill switch is active.'
          : 'Unified party ledger flags are off — use legacy loader.',
        retryable: false,
      },
      meta: emptyMeta(scope, 'party_ledger', resolved, 'error', null),
    };
  }

  const uni = await rpcGetUnifiedPartyLedger({
    companyId: scope.companyId,
    partyType: params.partyType,
    partyId: params.partyId,
    branchId: scope.branchId,
    dateFrom: scope.dateFrom,
    dateTo: scope.dateTo,
    basis: scope.basis,
  });

  if (uni.error) {
    return {
      lines: [],
      openingBalance: 0,
      closingBalance: 0,
      error: normalizeSingleCoreError(uni.error),
      meta: emptyMeta(scope, 'party_ledger', resolved, 'error', 'get_unified_party_ledger'),
    };
  }

  // Prefer opening from RPC when available (extended return)
  const opening = uni.openingBalance;
  const lines = mapUnifiedRowsToLedgerLines(uni.rows);
  const closing = lines.length ? lines[lines.length - 1].runningBalance : opening;
  const resultKind = lines.length === 0 && Math.abs(opening) < EPS ? 'empty' : 'ok';

  return {
    lines,
    openingBalance: opening,
    closingBalance: closing,
    error: null,
    meta: emptyMeta(scope, 'party_ledger', resolved, resultKind, 'get_unified_party_ledger'),
  };
}

export async function loadAccountLedger(params: {
  companyId: string;
  accountId: string;
  branchId?: string | null;
  dateFrom?: string;
  dateTo?: string;
  basis?: UnifiedLedgerBasis;
}): Promise<AccountLedgerLoadResult> {
  const { scope, error: scopeErr } = resolveSingleCoreScope(params);
  if (!scope || scopeErr) {
    const resolved = await resolveSingleCoreLoader(params.companyId || '', 'account_statement');
    return {
      lines: [],
      openingBalance: 0,
      closingBalance: 0,
      error: scopeErr,
      meta: emptyMeta(
        {
          companyId: params.companyId || '',
          branchId: null,
          dateFrom: '',
          dateTo: '',
          basis: DEFAULT_UNIFIED_BASIS,
        },
        'account_statement',
        resolved,
        'error',
        null,
      ),
    };
  }
  const resolved = await resolveSingleCoreLoader(scope.companyId, 'account_statement', {
    legacyAvailable: true,
  });
  if (effectiveReportLoaderSource(resolved) !== 'unified') {
    return {
      lines: [],
      openingBalance: 0,
      closingBalance: 0,
      error: {
        code: 'flags_off',
        message: 'Unified account ledger flags are off — use legacy loader.',
        retryable: false,
      },
      meta: emptyMeta(scope, 'account_statement', resolved, 'error', null),
    };
  }
  const uni = await rpcGetUnifiedAccountLedger({
    companyId: scope.companyId,
    accountId: params.accountId,
    branchId: scope.branchId,
    dateFrom: scope.dateFrom,
    dateTo: scope.dateTo,
    basis: scope.basis,
  });
  if (uni.error) {
    return {
      lines: [],
      openingBalance: 0,
      closingBalance: 0,
      error: normalizeSingleCoreError(uni.error),
      meta: emptyMeta(scope, 'account_statement', resolved, 'error', 'get_unified_account_ledger'),
    };
  }
  const lines = mapUnifiedRowsToLedgerLines(uni.rows);
  const resultKind = lines.length === 0 && Math.abs(uni.openingBalance) < EPS ? 'empty' : 'ok';
  return {
    lines,
    openingBalance: uni.openingBalance,
    closingBalance: uni.closingBalance,
    error: null,
    meta: emptyMeta(scope, 'account_statement', resolved, resultKind, 'get_unified_account_ledger'),
  };
}

export async function loadTrialBalance(params: {
  companyId: string;
  branchId?: string | null;
  asOfDate: string;
  basis?: UnifiedLedgerBasis;
}) {
  const { scope, error: scopeErr } = resolveSingleCoreScope({
    companyId: params.companyId,
    branchId: params.branchId,
    dateFrom: params.asOfDate,
    dateTo: params.asOfDate,
    basis: params.basis,
  });
  if (!scope || scopeErr) {
    return { data: null, error: scopeErr, meta: null };
  }
  const resolved = await resolveSingleCoreLoader(scope.companyId, 'trial_balance', {
    legacyAvailable: false,
  });
  if (effectiveReportLoaderSource(resolved) !== 'unified') {
    return {
      data: null,
      error: {
        code: 'flags_off' as const,
        message: 'Unified trial balance requires engine + loader + screen flags.',
        retryable: false,
      },
      meta: emptyMeta(scope, 'trial_balance', resolved, 'error', null),
    };
  }
  const tb = await rpcGetUnifiedTrialBalance({
    companyId: scope.companyId,
    branchId: scope.branchId,
    asOfDate: params.asOfDate,
    basis: scope.basis,
  });
  if (tb.error) {
    return {
      data: null,
      error: normalizeSingleCoreError(tb.error),
      meta: emptyMeta(scope, 'trial_balance', resolved, 'error', 'get_unified_trial_balance'),
    };
  }
  return {
    data: tb,
    error: null,
    meta: emptyMeta(scope, 'trial_balance', resolved, 'ok', 'get_unified_trial_balance'),
  };
}

export async function loadCashBankLedger(params: {
  companyId: string;
  branchId?: string | null;
  dateFrom?: string;
  dateTo?: string;
  basis?: UnifiedLedgerBasis;
  liquidity?: 'cash' | 'bank' | 'wallet' | 'all';
}) {
  const { scope, error: scopeErr } = resolveSingleCoreScope(params);
  if (!scope || scopeErr) {
    return { rows: [], openingBalance: 0, closingBalance: 0, error: scopeErr, meta: null };
  }
  const resolved = await resolveSingleCoreLoader(scope.companyId, 'cash_flow', {
    legacyAvailable: true,
  });
  if (effectiveReportLoaderSource(resolved) !== 'unified') {
    return {
      rows: [],
      openingBalance: 0,
      closingBalance: 0,
      error: {
        code: 'flags_off' as const,
        message: 'Unified cash/bank flags are off.',
        retryable: false,
      },
      meta: emptyMeta(scope, 'cash_flow', resolved, 'error', null),
    };
  }
  const uni = await rpcGetUnifiedCashBankLedger({
    companyId: scope.companyId,
    branchId: scope.branchId,
    dateFrom: scope.dateFrom,
    dateTo: scope.dateTo,
    basis: scope.basis,
    liquidity: params.liquidity ?? 'all',
  });
  if (uni.error) {
    return {
      rows: [],
      openingBalance: 0,
      closingBalance: 0,
      error: normalizeSingleCoreError(uni.error),
      meta: emptyMeta(scope, 'cash_flow', resolved, 'error', 'get_unified_cash_bank_ledger'),
    };
  }
  return {
    rows: uni.rows,
    openingBalance: uni.openingBalance,
    closingBalance: uni.closingBalance,
    error: null,
    meta: emptyMeta(
      scope,
      'cash_flow',
      resolved,
      uni.rows.length === 0 ? 'empty' : 'ok',
      'get_unified_cash_bank_ledger',
    ),
  };
}

/** Roznamcha uses screen id `roznamcha` + cash/bank unified RPC. */
export async function loadRoznamcha(params: {
  companyId: string;
  branchId?: string | null;
  dateFrom?: string;
  dateTo?: string;
  basis?: UnifiedLedgerBasis;
  liquidity?: AccountFilter;
}): Promise<RoznamchaLoadResult> {
  const { scope, error: scopeErr } = resolveSingleCoreScope(params);
  if (!scope || scopeErr) {
    const resolved = await resolveSingleCoreLoader(params.companyId || '', 'roznamcha');
    return {
      result: null,
      error: scopeErr,
      meta: emptyMeta(
        {
          companyId: params.companyId || '',
          branchId: null,
          dateFrom: '',
          dateTo: '',
          basis: DEFAULT_UNIFIED_BASIS,
        },
        'roznamcha',
        resolved,
        'error',
        null,
      ),
    };
  }

  const resolved = await resolveSingleCoreLoader(scope.companyId, 'roznamcha', {
    legacyAvailable: true,
  });
  if (effectiveReportLoaderSource(resolved) !== 'unified') {
    return {
      result: null,
      error: {
        code: resolved.killSwitchActive ? 'kill_switch' : 'flags_off',
        message: resolved.killSwitchActive
          ? 'Unified ledger kill switch is active.'
          : 'Unified Roznamcha flags are off — use legacy loader.',
        retryable: false,
      },
      meta: emptyMeta(scope, 'roznamcha', resolved, 'error', null),
    };
  }

  const liq =
    params.liquidity === 'cash' || params.liquidity === 'bank' || params.liquidity === 'wallet'
      ? params.liquidity
      : 'all';

  const uni = await rpcGetUnifiedCashBankLedger({
    companyId: scope.companyId,
    branchId: scope.branchId,
    dateFrom: scope.dateFrom,
    dateTo: scope.dateTo,
    basis: scope.basis,
    liquidity: liq,
  });

  if (uni.error) {
    return {
      result: null,
      error: normalizeSingleCoreError(uni.error),
      meta: emptyMeta(scope, 'roznamcha', resolved, 'error', 'get_unified_cash_bank_ledger'),
    };
  }

  const result = mapUnifiedCashBankToRoznamcha(uni.rows, uni.openingBalance, uni.closingBalance);
  return {
    result,
    error: null,
    meta: emptyMeta(
      scope,
      'roznamcha',
      resolved,
      uni.rows.length === 0 ? 'empty' : 'ok',
      'get_unified_cash_bank_ledger',
    ),
  };
}

export { effectiveReportLoaderSource };
