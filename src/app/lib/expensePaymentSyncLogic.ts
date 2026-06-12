/** Pure expense/payment amount sync logic (no Supabase). */

export const EXPENSE_PAYMENT_MONEY_EPS = 0.02;

export function amountsClose(a: number, b: number, eps = EXPENSE_PAYMENT_MONEY_EPS): boolean {
  return Math.abs(Number(a) - Number(b)) <= eps;
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
