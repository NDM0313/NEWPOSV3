/**
 * Unified Core Ledger Engine — shadow service (Phase 1).
 * Feature flag defaults OFF. Production screens must NOT call this until Phase 4 enablement.
 * Tie-out UI may pass shadowForce: true to compare old vs new without enabling flag globally.
 */

import { supabase } from '@/lib/supabase';
import { accountingService, type AccountLedgerEntry } from '@/app/services/accountingService';
import {
  isUnifiedLedgerEngineEnabled,
  UNIFIED_LEDGER_ENGINE_DEFAULT,
} from '@/app/lib/unifiedLedgerFeatureFlag';
import { isUnifiedLedgerKillSwitchActive } from '@/app/lib/unifiedLedgerEngineState';
import {
  unifiedLedgerBasisIncludesRow,
  type UnifiedLedgerBasis,
  UNIFIED_LEDGER_BASIS_LABELS,
} from '@/app/lib/unifiedLedgerBasisFilter';

export type { UnifiedLedgerBasis };

export type UnifiedPartyType = 'customer' | 'supplier' | 'worker';

export type UnifiedLedgerRow = {
  journalEntryLineId: string;
  journalEntryId: string;
  entryDate: string;
  entryNo: string | null;
  referenceType: string | null;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
  periodOpeningBalance: number;
  paymentId: string | null;
  branchId: string | null;
  branchName: string | null;
  accountCode: string | null;
  accountName: string | null;
  partyResolved: string | null;
};

export type UnifiedLedgerMeta = {
  engine: 'unified_shadow' | 'legacy_fallback' | 'disabled';
  basis: UnifiedLedgerBasis;
  featureFlagEnabled: boolean;
  shadowForce: boolean;
  queryDurationMs: number;
  rowCount: number;
  periodOpeningBalance: number;
  rpcError?: string;
  message?: string;
};

export type UnifiedLedgerResult = {
  rows: UnifiedLedgerRow[];
  closingBalance: number;
  meta: UnifiedLedgerMeta;
};

export type UnifiedPartyLedgerParams = {
  companyId: string;
  partyType: UnifiedPartyType;
  contactId: string;
  branchId?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  basis: UnifiedLedgerBasis;
  /** Tie-out only: call new RPC even when feature flag is OFF */
  shadowForce?: boolean;
};

export type UnifiedAccountLedgerParams = {
  companyId: string;
  accountId: string;
  branchId?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  basis: UnifiedLedgerBasis;
  shadowForce?: boolean;
};

export type UnifiedCashBankLedgerParams = {
  companyId: string;
  branchId?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  basis: UnifiedLedgerBasis;
  /** 'cash' | 'bank' | 'wallet' | 'all' */
  liquidity?: 'cash' | 'bank' | 'wallet' | 'all';
  shadowForce?: boolean;
};

type RpcPartyRow = {
  journal_entry_line_id?: string;
  journal_entry_id?: string;
  entry_date?: string;
  entry_no?: string | null;
  reference_type?: string | null;
  description?: string;
  debit?: number;
  credit?: number;
  running_balance?: number;
  period_opening_balance?: number;
  payment_id?: string | null;
  branch_id?: string | null;
  branch_name?: string | null;
  account_code?: string | null;
  account_name?: string | null;
  party_resolved?: string | null;
};

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function mapRpcRow(r: RpcPartyRow, defaultOpening: number): UnifiedLedgerRow {
  return {
    journalEntryLineId: String(r.journal_entry_line_id || ''),
    journalEntryId: String(r.journal_entry_id || ''),
    entryDate: String(r.entry_date || ''),
    entryNo: r.entry_no ?? null,
    referenceType: r.reference_type ?? null,
    description: String(r.description || '—'),
    debit: round2(Number(r.debit) || 0),
    credit: round2(Number(r.credit) || 0),
    runningBalance: round2(Number(r.running_balance) || 0),
    periodOpeningBalance: round2(Number(r.period_opening_balance) ?? defaultOpening),
    paymentId: r.payment_id ? String(r.payment_id) : null,
    branchId: r.branch_id ? String(r.branch_id) : null,
    branchName: r.branch_name ?? null,
    accountCode: r.account_code ?? null,
    accountName: r.account_name ?? null,
    partyResolved: r.party_resolved ? String(r.party_resolved) : null,
  };
}

async function shouldUseUnifiedRpc(
  companyId: string,
  shadowForce?: boolean
): Promise<{ useRpc: boolean; flagEnabled: boolean }> {
  const killSwitchActive = await isUnifiedLedgerKillSwitchActive(companyId);
  if (killSwitchActive) {
    return { useRpc: shadowForce === true, flagEnabled: false };
  }
  const flagEnabled = await isUnifiedLedgerEngineEnabled(companyId);
  const useRpc = shadowForce === true || flagEnabled;
  return { useRpc, flagEnabled };
}

function disabledResult(basis: UnifiedLedgerBasis, flagEnabled: boolean): UnifiedLedgerResult {
  return {
    rows: [],
    closingBalance: 0,
    meta: {
      engine: 'disabled',
      basis,
      featureFlagEnabled: flagEnabled,
      shadowForce: false,
      queryDurationMs: 0,
      rowCount: 0,
      periodOpeningBalance: 0,
      message:
        'Unified ledger engine is disabled (feature flag OFF). Use shadowForce: true in tie-out UI only.',
    },
  };
}

/**
 * Party ledger — customer | supplier | worker.
 * When flag OFF and shadowForce false, returns empty shadow result (production unchanged).
 */
export async function getUnifiedPartyLedger(
  params: UnifiedPartyLedgerParams
): Promise<UnifiedLedgerResult> {
  const t0 = performance.now();
  const { useRpc, flagEnabled } = await shouldUseUnifiedRpc(params.companyId, params.shadowForce);

  if (!useRpc) {
    return disabledResult(params.basis, flagEnabled);
  }

  const { data: rpcRaw, error: rpcError } = await supabase.rpc('get_unified_party_ledger', {
    p_company_id: params.companyId,
    p_party_type: params.partyType,
    p_party_id: params.contactId,
    p_branch_id: params.branchId ?? null,
    p_start_date: params.dateFrom ?? null,
    p_end_date: params.dateTo ?? null,
    p_basis: params.basis,
  });

  const duration = performance.now() - t0;

  if (rpcError) {
    return {
      rows: [],
      closingBalance: 0,
      meta: {
        engine: 'unified_shadow',
        basis: params.basis,
        featureFlagEnabled: flagEnabled,
        shadowForce: params.shadowForce === true,
        queryDurationMs: duration,
        rowCount: 0,
        periodOpeningBalance: 0,
        rpcError: rpcError.message,
        message: 'RPC get_unified_party_ledger failed — apply migration 20260620140000 on database.',
      },
    };
  }

  const payload = (rpcRaw || {}) as {
    rows?: RpcPartyRow[];
    period_opening_balance?: number;
    row_count?: number;
  };
  const opening = round2(Number(payload.period_opening_balance) || 0);
  const rows = (payload.rows || []).map((r) => mapRpcRow(r, opening));
  const closing = rows.length ? rows[rows.length - 1].runningBalance : opening;

  return {
    rows,
    closingBalance: closing,
    meta: {
      engine: 'unified_shadow',
      basis: params.basis,
      featureFlagEnabled: flagEnabled,
      shadowForce: params.shadowForce === true,
      queryDurationMs: duration,
      rowCount: rows.length,
      periodOpeningBalance: opening,
    },
  };
}

/**
 * Single COA account ledger.
 */
export async function getUnifiedAccountLedger(
  params: UnifiedAccountLedgerParams
): Promise<UnifiedLedgerResult> {
  const t0 = performance.now();
  const { useRpc, flagEnabled } = await shouldUseUnifiedRpc(params.companyId, params.shadowForce);

  if (!useRpc) {
    return disabledResult(params.basis, flagEnabled);
  }

  const { data: rpcRaw, error: rpcError } = await supabase.rpc('get_unified_account_ledger', {
    p_company_id: params.companyId,
    p_account_id: params.accountId,
    p_branch_id: params.branchId ?? null,
    p_start_date: params.dateFrom ?? null,
    p_end_date: params.dateTo ?? null,
    p_basis: params.basis,
  });

  const duration = performance.now() - t0;

  if (rpcError) {
    return {
      rows: [],
      closingBalance: 0,
      meta: {
        engine: 'unified_shadow',
        basis: params.basis,
        featureFlagEnabled: flagEnabled,
        shadowForce: params.shadowForce === true,
        queryDurationMs: duration,
        rowCount: 0,
        periodOpeningBalance: 0,
        rpcError: rpcError.message,
      },
    };
  }

  const payload = (rpcRaw || {}) as { rows?: RpcPartyRow[]; period_opening_balance?: number };
  const opening = round2(Number(payload.period_opening_balance) || 0);
  const rows = (payload.rows || []).map((r) => mapRpcRow(r, opening));
  const closing = rows.length ? rows[rows.length - 1].runningBalance : opening;

  return {
    rows,
    closingBalance: closing,
    meta: {
      engine: 'unified_shadow',
      basis: params.basis,
      featureFlagEnabled: flagEnabled,
      shadowForce: params.shadowForce === true,
      queryDurationMs: duration,
      rowCount: rows.length,
      periodOpeningBalance: opening,
    },
  };
}

/**
 * Cash/bank/wallet liquidity ledger — Phase 1.5 single RPC get_unified_cash_bank_ledger.
 */
export async function getUnifiedCashBankLedger(
  params: UnifiedCashBankLedgerParams
): Promise<UnifiedLedgerResult> {
  const t0 = performance.now();
  const { useRpc, flagEnabled } = await shouldUseUnifiedRpc(params.companyId, params.shadowForce);

  if (!useRpc) {
    return disabledResult(params.basis, flagEnabled);
  }

  const liquidity = params.liquidity ?? 'all';
  const { data: rpcRaw, error: rpcError } = await supabase.rpc('get_unified_cash_bank_ledger', {
    p_company_id: params.companyId,
    p_branch_id: params.branchId ?? null,
    p_start_date: params.dateFrom ?? null,
    p_end_date: params.dateTo ?? null,
    p_basis: params.basis,
    p_liquidity: liquidity,
  });

  const duration = performance.now() - t0;

  if (rpcError) {
    return {
      rows: [],
      closingBalance: 0,
      meta: {
        engine: 'unified_shadow',
        basis: params.basis,
        featureFlagEnabled: flagEnabled,
        shadowForce: params.shadowForce === true,
        queryDurationMs: duration,
        rowCount: 0,
        periodOpeningBalance: 0,
        rpcError: rpcError.message,
        message: 'RPC get_unified_cash_bank_ledger failed — apply migration 20260621150000 on database.',
      },
    };
  }

  const payload = (rpcRaw || {}) as {
    rows?: RpcPartyRow[];
    period_opening_balance?: number;
    liquidity_account_count?: number;
  };
  const opening = round2(Number(payload.period_opening_balance) || 0);
  const rows = (payload.rows || []).map((r) => mapRpcRow(r, opening));
  const closing = rows.length ? rows[rows.length - 1].runningBalance : opening;

  return {
    rows,
    closingBalance: closing,
    meta: {
      engine: 'unified_shadow',
      basis: params.basis,
      featureFlagEnabled: flagEnabled,
      shadowForce: params.shadowForce === true,
      queryDurationMs: duration,
      rowCount: rows.length,
      periodOpeningBalance: opening,
      message: `Liquidity RPC (${liquidity}), accounts=${payload.liquidity_account_count ?? '?'}`,
    },
  };
}

export type UnifiedTrialBalanceParams = {
  companyId: string;
  branchId?: string | null;
  asOfDate?: string | null;
  basis: UnifiedLedgerBasis;
  shadowForce?: boolean;
};

export type UnifiedTrialBalanceAccount = {
  accountId: string;
  accountCode: string | null;
  accountName: string | null;
  accountType: string | null;
  totalDebit: number;
  totalCredit: number;
  netBalance: number;
};

export type UnifiedTrialBalanceResult = {
  totalDebit: number;
  totalCredit: number;
  difference: number;
  accountCount: number;
  accounts: UnifiedTrialBalanceAccount[];
  meta: UnifiedLedgerMeta;
};

/**
 * Trial balance from unified journal lines (Phase 1.5 RPC).
 */
export async function getUnifiedTrialBalance(
  params: UnifiedTrialBalanceParams
): Promise<UnifiedTrialBalanceResult> {
  const t0 = performance.now();
  const { useRpc, flagEnabled } = await shouldUseUnifiedRpc(params.companyId, params.shadowForce);

  if (!useRpc) {
    return {
      totalDebit: 0,
      totalCredit: 0,
      difference: 0,
      accountCount: 0,
      accounts: [],
      meta: disabledResult(params.basis, flagEnabled).meta,
    };
  }

  const { data: rpcRaw, error: rpcError } = await supabase.rpc('get_unified_trial_balance', {
    p_company_id: params.companyId,
    p_branch_id: params.branchId ?? null,
    p_as_of_date: params.asOfDate ?? null,
    p_basis: params.basis,
  });

  const duration = performance.now() - t0;
  const emptyMeta: UnifiedLedgerMeta = {
    engine: 'unified_shadow',
    basis: params.basis,
    featureFlagEnabled: flagEnabled,
    shadowForce: params.shadowForce === true,
    queryDurationMs: duration,
    rowCount: 0,
    periodOpeningBalance: 0,
  };

  if (rpcError) {
    return {
      totalDebit: 0,
      totalCredit: 0,
      difference: 0,
      accountCount: 0,
      accounts: [],
      meta: { ...emptyMeta, rpcError: rpcError.message },
    };
  }

  const payload = (rpcRaw || {}) as {
    total_debit?: number;
    total_credit?: number;
    difference?: number;
    account_count?: number;
    accounts?: Array<{
      account_id?: string;
      account_code?: string | null;
      account_name?: string | null;
      account_type?: string | null;
      total_debit?: number;
      total_credit?: number;
      net_balance?: number;
    }>;
  };

  const accounts: UnifiedTrialBalanceAccount[] = (payload.accounts || []).map((a) => ({
    accountId: String(a.account_id || ''),
    accountCode: a.account_code ?? null,
    accountName: a.account_name ?? null,
    accountType: a.account_type ?? null,
    totalDebit: round2(Number(a.total_debit) || 0),
    totalCredit: round2(Number(a.total_credit) || 0),
    netBalance: round2(Number(a.net_balance) || 0),
  }));

  return {
    totalDebit: round2(Number(payload.total_debit) || 0),
    totalCredit: round2(Number(payload.total_credit) || 0),
    difference: round2(Number(payload.difference) || 0),
    accountCount: Number(payload.account_count) || accounts.length,
    accounts,
    meta: { ...emptyMeta, rowCount: accounts.length },
  };
}

/** Load legacy engine rows for tie-out comparison (does not change production paths). */
export async function loadLegacyPartyLedgerForTieOut(params: {
  companyId: string;
  partyType: UnifiedPartyType;
  contactId: string;
  branchId?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  useHybridCustomerLedger?: boolean;
}): Promise<{ rows: AccountLedgerEntry[]; engineName: string; durationMs: number }> {
  const t0 = performance.now();
  const branch = params.branchId ?? undefined;
  const from = params.dateFrom ?? undefined;
  const to = params.dateTo ?? undefined;

  if (params.partyType === 'customer') {
    const engineName = params.useHybridCustomerLedger
      ? 'getCustomerLedger (hybrid)'
      : 'getCustomerArGlJournalLedger (RPC)';
    const rows = params.useHybridCustomerLedger
      ? await accountingService.getCustomerLedger(params.contactId, params.companyId, branch, from, to)
      : await accountingService.getCustomerArGlJournalLedger(
          params.contactId,
          params.companyId,
          branch,
          from,
          to
        );
    return { rows, engineName, durationMs: performance.now() - t0 };
  }
  if (params.partyType === 'supplier') {
    const rows = await accountingService.getSupplierApGlJournalLedger(
      params.contactId,
      params.companyId,
      branch,
      from,
      to
    );
    return { rows, engineName: 'getSupplierApGlJournalLedger', durationMs: performance.now() - t0 };
  }
  const rows = await accountingService.getWorkerPartyGlJournalLedger(
    params.contactId,
    params.companyId,
    branch,
    from,
    to
  );
  return { rows, engineName: 'getWorkerPartyGlJournalLedger', durationMs: performance.now() - t0 };
}

export function unifiedBasisLabel(basis: UnifiedLedgerBasis): string {
  return UNIFIED_LEDGER_BASIS_LABELS[basis];
}

export { UNIFIED_LEDGER_ENGINE_DEFAULT, unifiedLedgerBasisIncludesRow };
