export const MOBILE_DATA_INVALIDATED_EVENT = 'erp-mobile:data-invalidated';

export type MobileInvalidationDomain = 'sales' | 'purchases' | 'accounting' | 'contacts';

export interface MobileInvalidationDetail {
  domain: MobileInvalidationDomain;
  companyId?: string | null;
  branchId?: string | null;
  reason?: string;
  ts: number;
}

export function dispatchMobileInvalidated(detail: Omit<MobileInvalidationDetail, 'ts'>): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<MobileInvalidationDetail>(MOBILE_DATA_INVALIDATED_EVENT, {
      detail: { ...detail, ts: Date.now() },
    })
  );
}

export function dispatchMobileAccountingInvalidated(args: {
  companyId?: string | null;
  branchId?: string | null;
  reason?: string;
}): void {
  dispatchMobileInvalidated({
    domain: 'accounting',
    companyId: args.companyId ?? null,
    branchId: args.branchId ?? null,
    reason: args.reason ?? 'accounting-updated',
  });
}

export function shouldAcceptMobileInvalidation(
  detail: MobileInvalidationDetail | undefined,
  opts: {
    domain?: MobileInvalidationDomain | MobileInvalidationDomain[];
    companyId?: string | null;
    branchId?: string | null;
  }
): boolean {
  if (!detail) return false;
  if (opts.domain) {
    const allowed = Array.isArray(opts.domain) ? opts.domain : [opts.domain];
    if (!allowed.includes(detail.domain)) return false;
  }
  if (opts.companyId && detail.companyId && opts.companyId !== detail.companyId) return false;
  if (opts.branchId && opts.branchId !== 'all' && detail.branchId && opts.branchId !== detail.branchId) return false;
  return true;
}
