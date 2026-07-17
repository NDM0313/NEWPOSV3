/**
 * Pure Single Core helpers (no Supabase / Capacitor imports).
 * Safe for node:test without installing native mobile deps.
 */

import type { UnifiedLedgerBasis, UnifiedLedgerRow } from '../../types/unifiedReports';
import { DEFAULT_UNIFIED_BASIS } from '../../types/unifiedReports';
import type { ReportLoaderSource, ResolveReportLoaderResult } from '../../lib/reportLoaderSource';
import type { UnifiedReportScreenId } from '../../lib/unifiedLedgerFlagKeys';
import type { LedgerLine } from '../reports';
import type { RoznamchaResult, RoznamchaRowWithBalance } from '../roznamcha';

export type SingleCoreErrorCode =
  | 'not_configured'
  | 'missing_scope'
  | 'engine_disabled'
  | 'kill_switch'
  | 'flags_off'
  | 'rpc_error'
  | 'invalid_payload'
  | 'permission_denied'
  | 'unavailable';

export type SingleCoreError = {
  code: SingleCoreErrorCode;
  message: string;
  retryable: boolean;
};

export type LoaderMetadata = {
  source: ReportLoaderSource;
  basis: UnifiedLedgerBasis;
  companyId: string;
  branchId: string | null;
  dateFrom: string;
  dateTo: string;
  rpcName: string | null;
  screenId: UnifiedReportScreenId;
  lastRefreshIso: string;
  fallbackReason: string | null;
  killSwitchActive: boolean;
  loaderFlagEnabled: boolean;
  companyEngineEnabled: boolean;
  screenFlagEnabled: boolean;
  resultKind: 'ok' | 'empty' | 'error' | 'fallback';
};

export type SingleCoreScope = {
  companyId: string;
  branchId: string | null;
  dateFrom: string;
  dateTo: string;
  basis: UnifiedLedgerBasis;
};

/** UUID / empty / sentinel → null for company-wide RPC branch scope. */
export function safeSingleCoreBranchId(branchId: string | null | undefined): string | null {
  if (branchId == null) return null;
  const s = String(branchId).trim();
  if (!s || s === 'all' || s === 'null' || s === 'undefined') return null;
  return s;
}

export function resolveSingleCoreScope(input: {
  companyId: string | null | undefined;
  branchId?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  basis?: UnifiedLedgerBasis | null;
}): { scope: SingleCoreScope | null; error: SingleCoreError | null } {
  const companyId = (input.companyId ?? '').trim();
  if (!companyId) {
    return {
      scope: null,
      error: { code: 'missing_scope', message: 'Company is required.', retryable: false },
    };
  }
  return {
    scope: {
      companyId,
      branchId: safeSingleCoreBranchId(input.branchId),
      dateFrom: (input.dateFrom ?? '').trim().slice(0, 10),
      dateTo: (input.dateTo ?? '').trim().slice(0, 10),
      basis: input.basis ?? DEFAULT_UNIFIED_BASIS,
    },
    error: null,
  };
}

export function createLoaderMetadata(params: {
  resolved: ResolveReportLoaderResult;
  scope: SingleCoreScope;
  screenId: UnifiedReportScreenId;
  rpcName: string | null;
  fallbackReason?: string | null;
  resultKind: LoaderMetadata['resultKind'];
}): LoaderMetadata {
  return {
    source: params.resolved.source,
    basis: params.scope.basis,
    companyId: params.scope.companyId,
    branchId: params.scope.branchId,
    dateFrom: params.scope.dateFrom,
    dateTo: params.scope.dateTo,
    rpcName: params.rpcName,
    screenId: params.screenId,
    lastRefreshIso: new Date().toISOString(),
    fallbackReason: params.fallbackReason ?? null,
    killSwitchActive: params.resolved.killSwitchActive,
    loaderFlagEnabled: params.resolved.loaderFlagEnabled,
    companyEngineEnabled: params.resolved.companyEngineEnabled,
    screenFlagEnabled: params.resolved.screenFlagEnabled,
    resultKind: params.resultKind,
  };
}

export function normalizeSingleCoreError(
  err: unknown,
  fallbackCode: SingleCoreErrorCode = 'rpc_error',
): SingleCoreError {
  if (err && typeof err === 'object' && 'code' in err && 'message' in err) {
    const e = err as SingleCoreError;
    return {
      code: e.code,
      message: e.message,
      retryable: e.retryable ?? true,
    };
  }
  const message = err instanceof Error ? err.message : String(err || 'Unknown error');
  const lower = message.toLowerCase();
  if (lower.includes('permission') || lower.includes('rls') || lower.includes('not authorized')) {
    return { code: 'permission_denied', message, retryable: false };
  }
  if (lower.includes('kill') || lower.includes('engine not enabled')) {
    return { code: 'engine_disabled', message, retryable: false };
  }
  return { code: fallbackCode, message, retryable: true };
}

export function mapUnifiedRowsToLedgerLines(rows: UnifiedLedgerRow[]): LedgerLine[] {
  return rows.map((r) => ({
    id: r.journalEntryLineId || r.journalEntryId,
    journalEntryId: r.journalEntryId,
    sourceReferenceId: null,
    date: r.entryDate,
    createdAt: r.entryDate,
    entryNo: r.entryNo || '',
    description: r.description,
    reference: r.entryNo || '',
    referenceType: r.referenceType || '',
    debit: r.debit,
    credit: r.credit,
    runningBalance: r.runningBalance,
    paymentId: r.paymentId,
    partyName: r.partyResolved,
    counterAccountCode: r.accountCode,
    counterAccountName: r.accountName,
  }));
}

export function mapUnifiedCashBankToRoznamcha(
  rows: UnifiedLedgerRow[],
  openingBalance: number,
  closingBalance: number,
): RoznamchaResult {
  const mapped: RoznamchaRowWithBalance[] = rows.map((r) => {
    const cashIn = r.debit > 0 ? r.debit : 0;
    const cashOut = r.credit > 0 ? r.credit : 0;
    const direction: 'IN' | 'OUT' = cashIn > 0 ? 'IN' : 'OUT';
    return {
      id: r.journalEntryLineId || r.journalEntryId,
      date: r.entryDate,
      time: '',
      ref: r.entryNo || r.journalEntryId.slice(0, 8) || '—',
      details: r.description || '—',
      referenceDisplay: r.entryNo || '',
      createdBy: null,
      partyLine: r.partyResolved,
      journalEntryNo: r.entryNo,
      cashIn,
      cashOut,
      direction,
      amount: cashIn || cashOut,
      accountType: null,
      accountLabel: r.accountName || r.accountCode || 'Cash/Bank',
      accountName: r.accountName,
      sourcePaymentId: r.paymentId,
      sourceJournalEntryId: r.journalEntryId,
      branchId: null,
      type: (r.referenceType || 'journal').replace(/_/g, ' '),
      runningBalance: r.runningBalance,
    };
  });
  const cashIn = mapped.reduce((s, r) => s + r.cashIn, 0);
  const cashOut = mapped.reduce((s, r) => s + r.cashOut, 0);
  return {
    rows: mapped,
    summary: { openingBalance, cashIn, cashOut, closingBalance },
    cashSplit: { cash: closingBalance, bank: 0, wallet: 0, total: closingBalance },
  };
}

/** Empty date → null for all-time unified RPC params (Asia/Karachi calendar dates are YYYY-MM-DD). */
export function toRpcDateOrNull(value: string | null | undefined): string | null {
  const s = value != null ? String(value).trim() : '';
  return s ? s.slice(0, 10) : null;
}
