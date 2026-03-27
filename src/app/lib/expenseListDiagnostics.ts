export const EXPENSE_LIST_TRACE = '[EXPENSE_LIST_TRACE]';

export type ExpenseListRowDiagnostic = {
  expenseId: string;
  reference: string;
  status: string;
  expenseDate: string;
  branchOrLocation: string;
  categoryRaw: string;
  categoryNormalized: string;
  includedInOperational: boolean;
  operationalExclusionReason?: string;
  includedInFiltered: boolean;
  filterExclusionReason?: string;
  onCurrentPage: boolean;
};

const diagEnabled = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem('expense_list_fetch_diagnostics') === '1';
  } catch {
    return false;
  }
};

export function setExpenseListDiagnosticsEnabled(on: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (on) window.localStorage.setItem('expense_list_fetch_diagnostics', '1');
    else window.localStorage.removeItem('expense_list_fetch_diagnostics');
  } catch {
    /* noop */
  }
}

export function isExpenseListDiagnosticsEnabled(): boolean {
  return diagEnabled();
}

export function logExpenseListTrace(message: string, data?: Record<string, unknown>): void {
  if (!diagEnabled()) return;
  if (data) console.log(EXPENSE_LIST_TRACE, message, data);
  else console.log(EXPENSE_LIST_TRACE, message);
}
