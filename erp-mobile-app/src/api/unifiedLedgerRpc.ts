/**
 * Read-only unified ledger RPC layer for mobile.
 * Mirrors web unifiedLedgerService.ts — no mutations.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { isFeatureFlagEnabled } from './featureFlags';
import { isUnifiedLedgerKillSwitchActive } from '../lib/unifiedLedgerEngineState';
import { UNIFIED_LEDGER_FLAG_KEYS } from '../lib/unifiedLedgerFlagKeys';
import type { UnifiedLedgerBasis, UnifiedLedgerRow } from '../types/unifiedReports';

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

async function shouldUseUnifiedRpc(companyId: string): Promise<boolean> {
  if (!isSupabaseConfigured || !companyId) return false;
  if (await isUnifiedLedgerKillSwitchActive(companyId)) return false;
  return isFeatureFlagEnabled(companyId, UNIFIED_LEDGER_FLAG_KEYS.ENGINE);
}

type RpcLedgerRow = Record<string, unknown>;

function mapRpcRow(r: RpcLedgerRow, defaultOpening: number): UnifiedLedgerRow {
  return {
    journalEntryLineId: String(r.journal_entry_line_id || r.journal_entry_id || ''),
    journalEntryId: String(r.journal_entry_id || ''),
    entryDate: String(r.entry_date || '').slice(0, 10),
    entryNo: (r.entry_no as string) ?? null,
    referenceType: (r.reference_type as string) ?? null,
    description: String(r.description || ''),
    debit: round2(Number(r.debit) || 0),
    credit: round2(Number(r.credit) || 0),
    runningBalance: round2(Number(r.running_balance) ?? defaultOpening),
    paymentId: (r.payment_id as string) ?? null,
    accountCode: (r.account_code as string) ?? null,
    accountName: (r.account_name as string) ?? null,
    partyResolved: (r.party_resolved as string) ?? null,
  };
}

export type UnifiedTrialBalanceAccount = {
  accountId: string;
  accountCode: string | null;
  accountName: string | null;
  accountType: string | null;
  totalDebit: number;
  totalCredit: number;
  netBalance: number;
};

export async function rpcGetUnifiedTrialBalance(params: {
  companyId: string;
  branchId?: string | null;
  asOfDate: string;
  basis: UnifiedLedgerBasis;
}): Promise<{
  totalDebit: number;
  totalCredit: number;
  difference: number;
  accounts: UnifiedTrialBalanceAccount[];
  error: string | null;
}> {
  if (!(await shouldUseUnifiedRpc(params.companyId))) {
    return { totalDebit: 0, totalCredit: 0, difference: 0, accounts: [], error: 'Unified engine not enabled' };
  }
  const { data: rpcRaw, error } = await supabase.rpc('get_unified_trial_balance', {
    p_company_id: params.companyId,
    p_branch_id: params.branchId ?? null,
    p_as_of_date: params.asOfDate,
    p_basis: params.basis,
  });
  if (error) {
    return { totalDebit: 0, totalCredit: 0, difference: 0, accounts: [], error: error.message };
  }
  const payload = (rpcRaw || {}) as {
    total_debit?: number;
    total_credit?: number;
    difference?: number;
    accounts?: Array<Record<string, unknown>>;
  };
  const accounts = (payload.accounts || []).map((a) => ({
    accountId: String(a.account_id || ''),
    accountCode: (a.account_code as string) ?? null,
    accountName: (a.account_name as string) ?? null,
    accountType: (a.account_type as string) ?? null,
    totalDebit: round2(Number(a.total_debit) || 0),
    totalCredit: round2(Number(a.total_credit) || 0),
    netBalance: round2(Number(a.net_balance) || 0),
  }));
  return {
    totalDebit: round2(Number(payload.total_debit) || 0),
    totalCredit: round2(Number(payload.total_credit) || 0),
    difference: round2(Number(payload.difference) || 0),
    accounts,
    error: null,
  };
}

export async function rpcGetUnifiedCashBankLedger(params: {
  companyId: string;
  branchId?: string | null;
  dateFrom: string;
  dateTo: string;
  basis: UnifiedLedgerBasis;
  liquidity?: 'cash' | 'bank' | 'wallet' | 'all';
}): Promise<{ rows: UnifiedLedgerRow[]; openingBalance: number; closingBalance: number; error: string | null }> {
  if (!(await shouldUseUnifiedRpc(params.companyId))) {
    return { rows: [], openingBalance: 0, closingBalance: 0, error: 'Unified engine not enabled' };
  }
  const { data: rpcRaw, error } = await supabase.rpc('get_unified_cash_bank_ledger', {
    p_company_id: params.companyId,
    p_branch_id: params.branchId ?? null,
    p_start_date: params.dateFrom,
    p_end_date: params.dateTo,
    p_basis: params.basis,
    p_liquidity: params.liquidity ?? 'all',
  });
  if (error) return { rows: [], openingBalance: 0, closingBalance: 0, error: error.message };
  const payload = (rpcRaw || {}) as {
    rows?: RpcLedgerRow[];
    period_opening_balance?: number;
  };
  const opening = round2(Number(payload.period_opening_balance) || 0);
  const rows = (payload.rows || []).map((r) => mapRpcRow(r, opening));
  const closing = rows.length ? rows[rows.length - 1].runningBalance : opening;
  return { rows, openingBalance: opening, closingBalance: closing, error: null };
}

function rpcDateOrNull(value: string | null | undefined): string | null {
  const s = value != null ? String(value).trim() : '';
  return s ? s.slice(0, 10) : null;
}

export async function rpcGetUnifiedAccountLedger(params: {
  companyId: string;
  accountId: string;
  branchId?: string | null;
  dateFrom: string;
  dateTo: string;
  basis: UnifiedLedgerBasis;
}): Promise<{
  rows: UnifiedLedgerRow[];
  openingBalance: number;
  closingBalance: number;
  error: string | null;
}> {
  if (!(await shouldUseUnifiedRpc(params.companyId))) {
    return { rows: [], openingBalance: 0, closingBalance: 0, error: 'Unified engine not enabled' };
  }
  const { data: rpcRaw, error } = await supabase.rpc('get_unified_account_ledger', {
    p_company_id: params.companyId,
    p_account_id: params.accountId,
    p_branch_id: params.branchId ?? null,
    p_start_date: rpcDateOrNull(params.dateFrom),
    p_end_date: rpcDateOrNull(params.dateTo),
    p_basis: params.basis,
  });
  if (error) return { rows: [], openingBalance: 0, closingBalance: 0, error: error.message };
  const payload = (rpcRaw || {}) as { rows?: RpcLedgerRow[]; period_opening_balance?: number };
  const opening = round2(Number(payload.period_opening_balance) || 0);
  const rows = (payload.rows || []).map((r) => mapRpcRow(r, opening));
  const closing = rows.length ? rows[rows.length - 1].runningBalance : opening;
  return { rows, openingBalance: opening, closingBalance: closing, error: null };
}

export async function rpcGetUnifiedPartyLedger(params: {
  companyId: string;
  partyType: 'customer' | 'supplier' | 'worker';
  partyId: string;
  branchId?: string | null;
  dateFrom: string;
  dateTo: string;
  basis: UnifiedLedgerBasis;
}): Promise<{ rows: UnifiedLedgerRow[]; closingBalance: number; error: string | null }> {
  if (!(await shouldUseUnifiedRpc(params.companyId))) {
    return { rows: [], closingBalance: 0, error: 'Unified engine not enabled' };
  }
  const { data: rpcRaw, error } = await supabase.rpc('get_unified_party_ledger', {
    p_company_id: params.companyId,
    p_party_type: params.partyType,
    p_party_id: params.partyId,
    p_branch_id: params.branchId ?? null,
    p_start_date: params.dateFrom,
    p_end_date: params.dateTo,
    p_basis: params.basis,
  });
  if (error) return { rows: [], closingBalance: 0, error: error.message };
  const payload = (rpcRaw || {}) as { rows?: RpcLedgerRow[]; period_opening_balance?: number };
  const opening = round2(Number(payload.period_opening_balance) || 0);
  const rows = (payload.rows || []).map((r) => mapRpcRow(r, opening));
  const closing = rows.length ? rows[rows.length - 1].runningBalance : opening;
  return { rows, closingBalance: closing, error: null };
}

export async function fetchActiveAccountsForBsPl(companyId: string) {
  if (!isSupabaseConfigured) return [];
  let { data: accounts, error } = await supabase
    .from('accounts')
    .select('id, code, name, type, parent_id, is_group')
    .eq('company_id', companyId)
    .eq('is_active', true);
  if (error && String(error.message || '').includes('parent_id')) {
    const retry = await supabase
      .from('accounts')
      .select('id, code, name, type')
      .eq('company_id', companyId)
      .eq('is_active', true);
    accounts = (retry.data || []).map((a) => ({ ...a, parent_id: null, is_group: false }));
  }
  return (accounts || []) as import('../lib/unifiedReportMappers').BsPlAccountMeta[];
}
