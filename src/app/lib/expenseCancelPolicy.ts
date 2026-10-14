/** Posted expense statuses — cancel (soft) instead of hard delete. */
const POSTED_EXPENSE_STATUSES = new Set(['approved', 'paid', 'submitted']);

export function isPostedExpenseStatus(status: string | null | undefined): boolean {
  return POSTED_EXPENSE_STATUSES.has(String(status || '').toLowerCase().trim());
}

export function expenseDeleteOrCancelLabel(status: string | null | undefined): 'Delete Expense' | 'Cancel Expense' {
  return isPostedExpenseStatus(status) ? 'Cancel Expense' : 'Delete Expense';
}
