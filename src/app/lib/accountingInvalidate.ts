import { dispatchDataInvalidated } from '@/app/lib/dataInvalidationBus';

/** Single event so AccountingContext, statements, party maps, and related UIs stay in sync after any JE write path. */
export function notifyAccountingEntriesChanged(args?: {
  companyId?: string | null;
  branchId?: string | null;
  entityId?: string | null;
  reason?: string;
}): void {
  if (typeof window === 'undefined') return;
  dispatchDataInvalidated({
    domain: 'accounting',
    companyId: args?.companyId ?? null,
    branchId: args?.branchId ?? null,
    entityId: args?.entityId ?? null,
    reason: args?.reason ?? 'accounting-entries-changed',
  });
  window.dispatchEvent(new CustomEvent('accountingEntriesChanged'));
}
