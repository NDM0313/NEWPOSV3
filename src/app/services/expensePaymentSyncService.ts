/**
 * Phase 2A — keep expense-linked payments in sync with expense + JE amounts.
 * Roznamcha reads payments.amount; edits must update that row when JE is authoritative.
 */

import {
  amountsClose,
  detectExpensePaymentAmountMismatch,
  expensePaymentRepairPassesMinMismatch,
  type ExpensePaymentMismatchResult,
  type ExpensePaymentSyncAmounts,
} from '@/app/lib/expensePaymentSyncLogic';
import { isLiquidityPaymentAccount } from '@/app/lib/liquidityPaymentAccount';
import { logDocumentEditActivity } from '@/app/lib/documentEditActivityLog';
import { computeDryRunHash } from '@/app/lib/developerRepairHash';
import { supabase } from '@/lib/supabase';

export {
  amountsClose,
  detectExpensePaymentAmountMismatch,
  EXPENSE_PAYMENT_MONEY_EPS,
} from '@/app/lib/expensePaymentSyncLogic';
export type { ExpensePaymentMismatchResult, ExpensePaymentSyncAmounts };

export interface ExpensePaymentSyncSnapshot {
  expenseId: string;
  expenseNo: string;
  expenseAmount: number;
  paymentId: string | null;
  paymentRef: string | null;
  paymentAmount: number | null;
  paymentAccountId: string | null;
  jeId: string | null;
  jeLiquidityAmount: number;
}

export async function loadExpensePaymentSyncSnapshot(
  companyId: string,
  expenseIdOrNo: string
): Promise<ExpensePaymentSyncSnapshot | null> {
  const isUuid = /^[0-9a-f-]{36}$/i.test(expenseIdOrNo);
  let expQ = supabase
    .from('expenses')
    .select('id, expense_no, amount, payment_account_id, status')
    .eq('company_id', companyId);
  expQ = isUuid ? expQ.eq('id', expenseIdOrNo) : expQ.eq('expense_no', expenseIdOrNo);
  const { data: exp } = await expQ.maybeSingle();
  if (!exp) return null;

  const expenseId = String((exp as { id: string }).id);
  const expenseNo = String((exp as { expense_no?: string }).expense_no || '');
  const expenseAmount = Number((exp as { amount?: number }).amount) || 0;
  const paymentAccountId = (exp as { payment_account_id?: string | null }).payment_account_id ?? null;

  const { data: payRows } = await supabase
    .from('payments')
    .select('id, amount, reference_number, payment_account_id, voided_at')
    .eq('company_id', companyId)
    .eq('reference_type', 'expense')
    .eq('reference_id', expenseId)
    .is('voided_at', null)
    .order('created_at', { ascending: false })
    .limit(1);

  const pay = (payRows as Array<Record<string, unknown>> | null)?.[0];
  const paymentId = pay ? String(pay.id) : null;
  const paymentRef = pay ? String(pay.reference_number || '') : null;
  const paymentAmount = pay ? Number(pay.amount) || 0 : null;
  const payAccountId = pay ? ((pay.payment_account_id as string | null) ?? null) : null;

  const { data: jeRows } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('company_id', companyId)
    .eq('reference_type', 'expense')
    .eq('reference_id', expenseId)
    .or('is_void.is.null,is_void.eq.false')
    .order('created_at', { ascending: false })
    .limit(1);

  const jeId = (jeRows as { id: string }[] | null)?.[0]?.id ?? null;
  let jeLiquidityAmount = 0;

  if (jeId) {
    const { data: lines } = await supabase
      .from('journal_entry_lines')
      .select('debit, credit, account:accounts(code, name, type)')
      .eq('journal_entry_id', jeId);

    for (const line of lines || []) {
      const rawAcc = (line as { account?: unknown }).account;
      const acc = (Array.isArray(rawAcc) ? rawAcc[0] : rawAcc) as {
        code?: string;
        name?: string;
        type?: string;
      } | null;
      const credit = Number((line as { credit?: number }).credit) || 0;
      if (credit > 0 && isLiquidityPaymentAccount(acc)) {
        jeLiquidityAmount += credit;
      }
    }
    if (jeLiquidityAmount <= 0) {
      for (const line of lines || []) {
        jeLiquidityAmount = Math.max(
          jeLiquidityAmount,
          Number((line as { debit?: number }).debit) || 0,
          Number((line as { credit?: number }).credit) || 0
        );
      }
    }
  }

  return {
    expenseId,
    expenseNo,
    expenseAmount,
    paymentId,
    paymentRef,
    paymentAmount,
    paymentAccountId: payAccountId ?? paymentAccountId,
    jeId,
    jeLiquidityAmount,
  };
}

async function recomputeJeHeaderTotals(jeId: string, companyId: string): Promise<void> {
  const { data: lines } = await supabase
    .from('journal_entry_lines')
    .select('debit, credit')
    .eq('journal_entry_id', jeId);

  let totalDebit = 0;
  let totalCredit = 0;
  for (const line of lines || []) {
    totalDebit += Number((line as { debit?: number }).debit) || 0;
    totalCredit += Number((line as { credit?: number }).credit) || 0;
  }

  await supabase
    .from('journal_entries')
    .update({ total_debit: totalDebit, total_credit: totalCredit })
    .eq('id', jeId)
    .eq('company_id', companyId);
}

export async function syncExpenseLinkedPayment(params: {
  companyId: string;
  expenseId: string;
  expenseNo?: string;
  amount: number;
  paymentAccountId?: string | null;
  jeId?: string | null;
  performedBy?: string | null;
  /** When true, only update payment row if JE already matches amount (repair path). */
  repairMode?: boolean;
}): Promise<{ ok: boolean; error?: string; paymentId?: string; updated?: boolean }> {
  const snapshot = await loadExpensePaymentSyncSnapshot(params.companyId, params.expenseId);
  if (!snapshot) return { ok: false, error: 'Expense not found' };

  const targetAmount = Number(params.amount) || 0;
  const jeId = params.jeId ?? snapshot.jeId;

  if (params.repairMode) {
    const check = detectExpensePaymentAmountMismatch({
      expenseAmount: snapshot.expenseAmount,
      paymentAmount: snapshot.paymentAmount,
      jeLiquidityAmount: snapshot.jeLiquidityAmount,
    });
    if (!check.canApplyRepair) {
      return { ok: false, error: check.blockReason || 'Repair not allowed' };
    }
  }

  const { data: payRows } = await supabase
    .from('payments')
    .select('id, amount, payment_account_id, reference_number')
    .eq('company_id', params.companyId)
    .eq('reference_type', 'expense')
    .eq('reference_id', params.expenseId)
    .is('voided_at', null)
    .order('created_at', { ascending: false })
    .limit(1);

  const pay = (payRows as Array<Record<string, unknown>> | null)?.[0];
  if (!pay) return { ok: false, error: 'No linked expense payment row' };

  const paymentId = String(pay.id);
  const oldAmount = Number(pay.amount) || 0;
  const oldPayAcc = (pay.payment_account_id as string | null) ?? null;
  const newPayAcc = params.paymentAccountId !== undefined ? params.paymentAccountId : oldPayAcc;

  const payPatch: Record<string, unknown> = {};
  if (!amountsClose(oldAmount, targetAmount)) payPatch.amount = targetAmount;
  if (newPayAcc && newPayAcc !== oldPayAcc) payPatch.payment_account_id = newPayAcc;

  if (Object.keys(payPatch).length > 0) {
    const { error } = await supabase
      .from('payments')
      .update(payPatch)
      .eq('id', paymentId)
      .eq('company_id', params.companyId);
    if (error) return { ok: false, error: error.message };
  }

  if (jeId && newPayAcc && newPayAcc !== oldPayAcc) {
    const { data: creditLines } = await supabase
      .from('journal_entry_lines')
      .select('id, credit, account:accounts(code, name, type)')
      .eq('journal_entry_id', jeId)
      .gt('credit', 0);

    for (const line of creditLines || []) {
      const rawAcc = (line as { account?: unknown }).account;
      const acc = (Array.isArray(rawAcc) ? rawAcc[0] : rawAcc) as {
        code?: string;
        name?: string;
        type?: string;
      } | null;
      if (isLiquidityPaymentAccount(acc)) {
        await supabase
          .from('journal_entry_lines')
          .update({ account_id: newPayAcc })
          .eq('id', (line as { id: string }).id);
        break;
      }
    }
  }

  if (jeId) {
    await recomputeJeHeaderTotals(jeId, params.companyId);
  }

  if (params.performedBy && Object.keys(payPatch).length > 0) {
    const ref = String(pay.reference_number || snapshot.paymentRef || paymentId);
    const lines: string[] = [];
    if (payPatch.amount != null) {
      lines.push(`Payment amount changed from ${oldAmount.toLocaleString()} to ${targetAmount.toLocaleString()}`);
    }
    if (payPatch.payment_account_id) {
      lines.push('Paid-from payment account updated to match expense');
    }
    await logDocumentEditActivity({
      companyId: params.companyId,
      module: 'expense',
      entityId: params.expenseId,
      entityReference: params.expenseNo || snapshot.expenseNo,
      action: params.repairMode ? 'expense_payment_amount_repaired' : 'expense_payment_synced',
      lines: lines.length ? lines : [`Payment ${ref} synced to expense amount`],
      performedBy: params.performedBy,
    });
  }

  return { ok: true, paymentId, updated: Object.keys(payPatch).length > 0 };
}

export async function dryRunExpensePaymentAmountRepair(
  companyId: string,
  expenseIdOrNo: string
): Promise<{
  ok: boolean;
  snapshot: ExpensePaymentSyncSnapshot | null;
  mismatch: ExpensePaymentMismatchResult | null;
  dryRunHash: string;
}> {
  const snapshot = await loadExpensePaymentSyncSnapshot(companyId, expenseIdOrNo);
  if (!snapshot) {
    return { ok: false, snapshot: null, mismatch: null, dryRunHash: '' };
  }

  const mismatch = detectExpensePaymentAmountMismatch({
    expenseAmount: snapshot.expenseAmount,
    paymentAmount: snapshot.paymentAmount,
    jeLiquidityAmount: snapshot.jeLiquidityAmount,
  });

  const before = {
    expenseNo: snapshot.expenseNo,
    expenseAmount: snapshot.expenseAmount,
    paymentRef: snapshot.paymentRef,
    paymentAmount: snapshot.paymentAmount,
    jeLiquidityAmount: snapshot.jeLiquidityAmount,
    roznamchaAmount: snapshot.paymentAmount,
  };
  const afterPreview = {
    ...before,
    paymentAmount: mismatch.proposedAfterAmount,
    roznamchaAmount: mismatch.proposedAfterAmount,
  };

  return {
    ok: mismatch.canApplyRepair,
    snapshot,
    mismatch,
    dryRunHash: computeDryRunHash('expense.sync_linked_payment_amount', { expenseId: snapshot.expenseId }, before),
  };
}

export async function applyExpensePaymentAmountRepair(
  companyId: string,
  expenseIdOrNo: string,
  dryRunHash: string,
  performedBy?: string | null
): Promise<{ ok: boolean; error?: string }> {
  const dry = await dryRunExpensePaymentAmountRepair(companyId, expenseIdOrNo);
  if (dry.dryRunHash !== dryRunHash) {
    return { ok: false, error: 'Dry-run hash mismatch — re-run dry-run' };
  }
  if (!dry.snapshot || !dry.mismatch?.canApplyRepair) {
    return { ok: false, error: dry.mismatch?.blockReason || 'Repair not allowed' };
  }

  return syncExpenseLinkedPayment({
    companyId,
    expenseId: dry.snapshot.expenseId,
    expenseNo: dry.snapshot.expenseNo,
    amount: dry.mismatch.proposedAfterAmount,
    paymentAccountId: dry.snapshot.paymentAccountId,
    jeId: dry.snapshot.jeId,
    performedBy,
    repairMode: true,
  });
}

export interface ExpensePaymentRepairCandidateRow {
  expenseId: string;
  expenseNo: string;
  expenseAmount: number;
  paymentRef: string | null;
  paymentAmount: number | null;
  jeLiquidityAmount: number;
  canApplyRepair: boolean;
  blockReason?: string;
  proposedAfterAmount: number;
  expenseDate?: string | null;
  branchId?: string | null;
}

export interface ExpensePaymentRepairSearchFilters {
  expenseNo?: string;
  paymentRef?: string;
  dateFrom?: string;
  dateTo?: string;
  branchId?: string;
  minMismatchAmount?: number;
  limit?: number;
}

export const DEFAULT_EXPENSE_REPAIR_SCAN_LIMIT = 80;
export const MAX_EXPENSE_REPAIR_SEARCH_LIMIT = 200;

function snapshotToCandidateRow(
  snapshot: ExpensePaymentSyncSnapshot,
  mismatch: ReturnType<typeof detectExpensePaymentAmountMismatch>,
  meta?: { expenseDate?: string | null; branchId?: string | null }
): ExpensePaymentRepairCandidateRow {
  return {
    expenseId: snapshot.expenseId,
    expenseNo: snapshot.expenseNo,
    expenseAmount: mismatch.expenseAmount,
    paymentRef: snapshot.paymentRef,
    paymentAmount: mismatch.paymentAmount,
    jeLiquidityAmount: mismatch.jeLiquidityAmount,
    canApplyRepair: mismatch.canApplyRepair,
    blockReason: mismatch.blockReason,
    proposedAfterAmount: mismatch.proposedAfterAmount,
    expenseDate: meta?.expenseDate ?? null,
    branchId: meta?.branchId ?? null,
  };
}

function passesMismatchAmountFilter(
  mismatch: ReturnType<typeof detectExpensePaymentAmountMismatch>,
  minMismatchAmount?: number
): boolean {
  return expensePaymentRepairPassesMinMismatch(
    mismatch.expenseAmount,
    mismatch.paymentAmount,
    minMismatchAmount
  );
}

/** Search paid expenses for expense.amount vs payments.amount drift (on-demand, filterable). */
export async function searchExpensePaymentRepairCandidates(
  companyId: string,
  filters: ExpensePaymentRepairSearchFilters = {}
): Promise<ExpensePaymentRepairCandidateRow[]> {
  const limit = Math.min(filters.limit ?? DEFAULT_EXPENSE_REPAIR_SCAN_LIMIT, MAX_EXPENSE_REPAIR_SEARCH_LIMIT);

  let expenseIdsFromPayment: string[] | null = null;
  if (filters.paymentRef?.trim()) {
    const { data: pays } = await supabase
      .from('payments')
      .select('reference_id')
      .eq('company_id', companyId)
      .eq('reference_type', 'expense')
      .ilike('reference_number', `%${filters.paymentRef.trim()}%`)
      .is('voided_at', null)
      .limit(100);
    expenseIdsFromPayment = [
      ...new Set(
        (pays || [])
          .map((p) => (p as { reference_id?: string }).reference_id)
          .filter(Boolean)
          .map(String)
      ),
    ];
    if (!expenseIdsFromPayment.length) return [];
  }

  let query = supabase
    .from('expenses')
    .select('id, expense_no, amount, expense_date, branch_id')
    .eq('company_id', companyId)
    .eq('status', 'paid');

  if (filters.expenseNo?.trim()) {
    query = query.ilike('expense_no', `%${filters.expenseNo.trim()}%`);
  }
  if (filters.branchId?.trim()) {
    query = query.eq('branch_id', filters.branchId.trim());
  }
  if (filters.dateFrom) {
    query = query.gte('expense_date', filters.dateFrom.slice(0, 10));
  }
  if (filters.dateTo) {
    query = query.lte('expense_date', filters.dateTo.slice(0, 10));
  }
  if (expenseIdsFromPayment) {
    query = query.in('id', expenseIdsFromPayment);
  }

  const { data: expenses } = await query.order('expense_date', { ascending: false }).limit(limit);

  const rows: ExpensePaymentRepairCandidateRow[] = [];
  for (const exp of expenses || []) {
    const expenseId = String((exp as { id: string }).id);
    const snapshot = await loadExpensePaymentSyncSnapshot(companyId, expenseId);
    if (!snapshot) continue;
    const mismatch = detectExpensePaymentAmountMismatch({
      expenseAmount: snapshot.expenseAmount,
      paymentAmount: snapshot.paymentAmount,
      jeLiquidityAmount: snapshot.jeLiquidityAmount,
    });
    if (!mismatch.hasMismatch) continue;
    if (!passesMismatchAmountFilter(mismatch, filters.minMismatchAmount)) continue;
    rows.push(
      snapshotToCandidateRow(snapshot, mismatch, {
        expenseDate: (exp as { expense_date?: string }).expense_date ?? null,
        branchId: (exp as { branch_id?: string | null }).branch_id ?? null,
      })
    );
  }
  return rows;
}

/** Lightweight default scan — recent paid expenses only (not full-table). */
export async function listExpensePaymentRepairCandidates(
  companyId: string,
  limit = DEFAULT_EXPENSE_REPAIR_SCAN_LIMIT
): Promise<ExpensePaymentRepairCandidateRow[]> {
  return searchExpensePaymentRepairCandidates(companyId, { limit });
}
