/**
 * Expense payment sync repair (Phase 2A) — stale payments.amount when JE matches expense.
 */

import { computeDryRunHash } from '@/app/lib/developerRepairHash';
import type { ApplyResult, DeveloperRepairAction, DeveloperRepairContext, DryRunResult } from '@/app/lib/developerRepairTypes';
import {
  applyExpensePaymentAmountRepair,
  dryRunExpensePaymentAmountRepair,
} from '@/app/services/expensePaymentSyncService';

async function dryRunSyncExpensePayment(
  params: Record<string, unknown>,
  ctx: DeveloperRepairContext
): Promise<DryRunResult> {
  const expenseId = String(params.expenseId || params.expenseNo || '');
  if (!expenseId) {
    return {
      ok: false,
      dryRunHash: '',
      before: {},
      afterPreview: {},
      blockedReason: 'expenseId or expenseNo required',
    };
  }

  const dry = await dryRunExpensePaymentAmountRepair(ctx.companyId, expenseId);
  if (!dry.snapshot || !dry.mismatch) {
    return {
      ok: false,
      dryRunHash: '',
      before: {},
      afterPreview: {},
      blockedReason: 'Expense not found',
    };
  }

  const before = {
    expenseNo: dry.snapshot.expenseNo,
    expenseAmount: dry.mismatch.expenseAmount,
    paymentRef: dry.snapshot.paymentRef,
    paymentAmount: dry.mismatch.paymentAmount,
    jeLiquidityAmount: dry.mismatch.jeLiquidityAmount,
    roznamchaAmount: dry.mismatch.roznamchaAmount,
  };
  const afterPreview = {
    ...before,
    paymentAmount: dry.mismatch.proposedAfterAmount,
    roznamchaAmount: dry.mismatch.proposedAfterAmount,
  };

  return {
    ok: dry.ok,
    dryRunHash: dry.dryRunHash,
    before,
    afterPreview,
    blockedReason: dry.ok ? undefined : dry.mismatch.blockReason,
    targetTable: 'payments',
    targetId: dry.snapshot.paymentId ?? undefined,
    title: `Sync expense payment amount — ${dry.snapshot.expenseNo}`,
    impactSummary: dry.ok
      ? `Update payment to Rs ${dry.mismatch.proposedAfterAmount.toLocaleString()} (JE already correct)`
      : dry.mismatch.blockReason,
  };
}

async function applySyncExpensePayment(
  params: Record<string, unknown>,
  ctx: DeveloperRepairContext,
  dryRunHash: string
): Promise<ApplyResult> {
  const expenseId = String(params.expenseId || params.expenseNo || '');
  const fresh = await dryRunSyncExpensePayment(params, ctx);
  if (fresh.dryRunHash !== dryRunHash) return { ok: false, error: 'Dry-run hash mismatch' };
  if (!fresh.ok) return { ok: false, error: fresh.blockedReason };

  const result = await applyExpensePaymentAmountRepair(
    ctx.companyId,
    expenseId,
    dryRunHash,
    ctx.userId
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, after: fresh.afterPreview, message: 'Linked payment amount synced to expense/JE' };
}

export const expenseSyncLinkedPaymentAmountAction: DeveloperRepairAction = {
  id: 'expense.sync_linked_payment_amount',
  title: 'Sync expense linked payment amount',
  description:
    'Updates payments.amount when expense and JE liquidity leg already match but Roznamcha/payment metadata is stale.',
  riskLevel: 'low',
  requiredRole: 'super-admin',
  confirmPhrase: (p) => `SYNC-EXPENSE-PAY-${String(p.expenseId || p.expenseNo || '').slice(0, 8)}`,
  whatItChanges: ['payments.amount', 'payments.payment_account_id when drifted'],
  whatItNeverChanges: ['journal_entry_lines debit/credit amounts', 'Expense row amount', 'GL balances'],
  dryRun: dryRunSyncExpensePayment,
  apply: applySyncExpensePayment,
  auditPayload: (b, a) => ({ before: b, after: a }),
  rollbackNote: 'Restore payments.amount from before_json.paymentAmount',
};

export const EXPENSE_REPAIR_ACTIONS = [expenseSyncLinkedPaymentAmountAction];
