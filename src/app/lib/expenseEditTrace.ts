import {
  createAccountingEditTraceId,
  pushAccountingEditTrace,
  getAccountingEditTraceLog,
  clearAccountingEditTraceLog,
} from '@/app/lib/accountingEditTrace';

export interface ExpenseEditTracePayload {
  traceId: string;
  ts: string;
  expenseId: string;
  companyId: string | null;
  phase:
    | 'start'
    | 'classified'
    | 'db_update'
    | 'header_patch'
    | 'reversal_start'
    | 'reversal_done'
    | 'repost_start'
    | 'repost_done'
    | 'compensating_void'
    | 'done'
    | 'error';
  data?: Record<string, unknown>;
}

export function createExpenseEditTraceId(expenseId: string): string {
  return createAccountingEditTraceId(expenseId);
}

export function pushExpenseEditTrace(payload: ExpenseEditTracePayload) {
  pushAccountingEditTrace({
    traceId: payload.traceId,
    ts: payload.ts,
    module: 'expenses',
    entityType: 'expense',
    entityId: payload.expenseId,
    companyId: payload.companyId,
    phase: payload.phase,
    data: payload.data,
  });
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('expenseEditTrace', { detail: payload }));
}

export function getExpenseEditTraceLog(): ExpenseEditTracePayload[] {
  return getAccountingEditTraceLog()
    .filter((r) => r.module === 'expenses')
    .map((r) => ({
      traceId: r.traceId,
      ts: r.ts,
      expenseId: r.entityId,
      companyId: r.companyId,
      phase: r.phase as ExpenseEditTracePayload['phase'],
      data: r.data,
    }));
}

export function clearExpenseEditTraceLog() {
  clearAccountingEditTraceLog();
}

