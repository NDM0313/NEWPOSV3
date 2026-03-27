export type AccountingEditPhase =
  | 'start'
  | 'classified'
  | 'db_update'
  | 'header_patch'
  | 'reversal_start'
  | 'reversal_done'
  | 'repost_start'
  | 'repost_done'
  | 'compensating_action'
  | 'done'
  | 'error';

export interface AccountingEditTracePayload {
  traceId: string;
  ts: string;
  module:
    | 'sales'
    | 'purchases'
    | 'customer_payments'
    | 'supplier_payments'
    | 'expenses'
    | 'inventory'
    | 'unknown';
  entityType: string;
  entityId: string;
  companyId: string | null;
  branchId?: string | null;
  phase: AccountingEditPhase;
  data?: Record<string, unknown>;
}

const TRACE_PREFIX = '[ACCOUNTING_EDIT_TRACE]';
const STORE_KEY = 'accounting_edit_trace_log_v1';
const MAX_LOG = 400;

function readStore(): AccountingEditTracePayload[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStore(rows: AccountingEditTracePayload[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(rows.slice(-MAX_LOG)));
  } catch {
    // noop
  }
}

export function createAccountingEditTraceId(entityId: string): string {
  return `${entityId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function pushAccountingEditTrace(payload: AccountingEditTracePayload) {
  const line = `${TRACE_PREFIX} ${payload.module} ${payload.phase}`;
  if (typeof window !== 'undefined') {
    const rows = readStore();
    rows.push(payload);
    writeStore(rows);
    window.dispatchEvent(new CustomEvent('accountingEditTrace', { detail: payload }));
  }
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log(line, payload);
  }
}

export function getAccountingEditTraceLog(): AccountingEditTracePayload[] {
  return readStore();
}

export function clearAccountingEditTraceLog() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORE_KEY);
}

export function exportAccountingEditTraceLog() {
  if (typeof window === 'undefined') return;
  const rows = readStore();
  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `accounting-edit-trace-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

