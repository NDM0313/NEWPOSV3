export const DATA_INVALIDATED_EVENT = 'erp:dataInvalidated';

export type InvalidationDomain =
  | 'contacts'
  | 'inventory'
  | 'accounting'
  | 'sales'
  | 'purchases';

export interface DataInvalidationDetail {
  domain: InvalidationDomain;
  companyId?: string | null;
  branchId?: string | null;
  entityId?: string | null;
  reason?: string;
  ts: number;
}

export function dispatchDataInvalidated(detail: Omit<DataInvalidationDetail, 'ts'>): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<DataInvalidationDetail>(DATA_INVALIDATED_EVENT, {
      detail: {
        ...detail,
        ts: Date.now(),
      },
    })
  );
}

export function shouldAcceptInvalidation(
  detail: DataInvalidationDetail | undefined,
  opts: {
    domain?: InvalidationDomain | InvalidationDomain[];
    companyId?: string | null;
    branchId?: string | null;
  }
): boolean {
  if (!detail) return false;
  if (opts.domain) {
    const domains = Array.isArray(opts.domain) ? opts.domain : [opts.domain];
    if (!domains.includes(detail.domain)) return false;
  }
  if (opts.companyId && detail.companyId && opts.companyId !== detail.companyId) return false;
  if (opts.branchId && opts.branchId !== 'all' && detail.branchId && opts.branchId !== detail.branchId) return false;
  return true;
}
