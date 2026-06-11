import { dispatchDataInvalidated } from '@/app/lib/dataInvalidationBus';
import { markLocalMutation } from '@/app/lib/localMutationSuppression';

/** Accounting invalidation via bus only — AccountingContext coalesces DATA_INVALIDATED (no duplicate legacy reload). */
export function notifyAccountingEntriesChanged(args?: {
  companyId?: string | null;
  branchId?: string | null;
  entityId?: string | null;
  reason?: string;
}): void {
  if (typeof window === 'undefined') return;
  markLocalMutation();
  dispatchDataInvalidated({
    domain: 'accounting',
    companyId: args?.companyId ?? null,
    branchId: args?.branchId ?? null,
    entityId: args?.entityId ?? null,
    reason: args?.reason ?? 'accounting-entries-changed',
  });
}
