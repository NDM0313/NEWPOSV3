/** Pure expense/payment amount sync logic (no Supabase). */

export const EXPENSE_PAYMENT_MONEY_EPS = 0.02;

export function amountsClose(a: number, b: number, eps = EXPENSE_PAYMENT_MONEY_EPS): boolean {
  return Math.abs(Number(a) - Number(b)) <= eps;
}

export function expensePaymentMismatchAmount(expenseAmount: number, paymentAmount: number | null): number {
  if (paymentAmount == null) return 0;
  return Math.abs(Number(expenseAmount) - Number(paymentAmount));
}

export interface ExpensePaymentRepairSearchFiltersInput {
  expenseNo?: string;
  paymentRef?: string;
  dateFrom?: string;
  dateTo?: string;
  branchId?: string;
  minMismatchAmount?: number;
}

/** True when user provided explicit search criteria (not default recent scan only). */
export function expensePaymentRepairSearchIsTargeted(
  filters: ExpensePaymentRepairSearchFiltersInput
): boolean {
  return Boolean(
    filters.expenseNo?.trim() ||
      filters.paymentRef?.trim() ||
      filters.dateFrom?.trim() ||
      filters.dateTo?.trim() ||
      filters.branchId?.trim() ||
      (filters.minMismatchAmount != null && filters.minMismatchAmount > 0)
  );
}

export function expensePaymentRepairPassesMinMismatch(
  expenseAmount: number,
  paymentAmount: number | null,
  minMismatchAmount?: number
): boolean {
  if (minMismatchAmount == null || minMismatchAmount <= 0) return true;
  return expensePaymentMismatchAmount(expenseAmount, paymentAmount) >= minMismatchAmount;
}

export interface ExpensePaymentSyncAmounts {
  expenseAmount: number;
  paymentAmount: number | null;
  jeLiquidityAmount: number;
}

export interface ExpensePaymentMismatchResult {
  hasMismatch: boolean;
  expenseAmount: number;
  paymentAmount: number | null;
  jeLiquidityAmount: number;
  roznamchaAmount: number | null;
  proposedAfterAmount: number;
  canApplyRepair: boolean;
  blockReason?: string;
}

export function detectExpensePaymentAmountMismatch(
  amounts: ExpensePaymentSyncAmounts
): ExpensePaymentMismatchResult {
  const expenseAmount = Number(amounts.expenseAmount) || 0;
  const paymentAmount = amounts.paymentAmount != null ? Number(amounts.paymentAmount) : null;
  const jeLiquidityAmount = Number(amounts.jeLiquidityAmount) || 0;
  const roznamchaAmount = paymentAmount;

  const hasPayment = paymentAmount != null;
  const hasMismatch = hasPayment && !amountsClose(expenseAmount, paymentAmount!);
  const jeMatchesExpense = amountsClose(expenseAmount, jeLiquidityAmount);

  let canApplyRepair = false;
  let blockReason: string | undefined;

  if (!hasPayment) {
    blockReason = 'No linked expense payment row found.';
  } else if (!hasMismatch) {
    blockReason = 'Payment amount already matches expense.';
  } else if (!jeMatchesExpense) {
    blockReason =
      'JE liquidity amount differs from expense — repair blocked until GL is reviewed (Phase 2A only fixes stale payment metadata when JE is correct).';
  } else {
    canApplyRepair = true;
  }

  return {
    hasMismatch,
    expenseAmount,
    paymentAmount,
    jeLiquidityAmount,
    roznamchaAmount,
    proposedAfterAmount: expenseAmount,
    canApplyRepair,
    blockReason,
  };
}
