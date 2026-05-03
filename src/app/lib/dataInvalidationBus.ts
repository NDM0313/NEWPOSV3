export const DATA_INVALIDATED_EVENT = 'erp:dataInvalidated';

export type InvalidationDomain =
  | 'contacts'
  | 'inventory'
  | 'accounting'
  | 'sales'
  | 'purchases'
  | 'rentals'
  | 'studio';

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

/** Use when a sale row is created/updated outside SalesContext so lists + GL + stock + AR refresh without full reload. */
export function dispatchSaleLifecycleInvalidated(opts: {
  companyId: string;
  branchId?: string | null;
  customerId?: string | null;
  saleId?: string | null;
  reason: string;
}): void {
  const { companyId, branchId, customerId, saleId, reason } = opts;
  const bid = branchId ?? null;
  dispatchDataInvalidated({
    domain: 'sales',
    companyId,
    branchId: bid,
    entityId: saleId ?? null,
    reason,
  });
  dispatchDataInvalidated({
    domain: 'accounting',
    companyId,
    branchId: bid,
    entityId: saleId ?? null,
    reason: `sale:${reason}`,
  });
  dispatchDataInvalidated({
    domain: 'inventory',
    companyId,
    branchId: bid,
    reason: `sale:${reason}`,
  });
  if (customerId) {
    dispatchDataInvalidated({
      domain: 'contacts',
      companyId,
      branchId: bid,
      entityId: customerId,
      reason: `sale:${reason}`,
    });
  }
}

/** Rental bookings / payments / stock — refresh rental lists and related GL/stock views. */
export function dispatchRentalLifecycleInvalidated(opts: {
  companyId: string;
  branchId?: string | null;
  customerId?: string | null;
  rentalId?: string | null;
  reason: string;
}): void {
  const bid = opts.branchId ?? null;
  dispatchDataInvalidated({
    domain: 'rentals',
    companyId: opts.companyId,
    branchId: bid,
    entityId: opts.rentalId ?? null,
    reason: opts.reason,
  });
  dispatchDataInvalidated({
    domain: 'accounting',
    companyId: opts.companyId,
    branchId: bid,
    entityId: opts.rentalId ?? null,
    reason: `rental:${opts.reason}`,
  });
  dispatchDataInvalidated({
    domain: 'inventory',
    companyId: opts.companyId,
    branchId: bid,
    reason: `rental:${opts.reason}`,
  });
  if (opts.customerId) {
    dispatchDataInvalidated({
      domain: 'contacts',
      companyId: opts.companyId,
      branchId: bid,
      entityId: opts.customerId,
      reason: `rental:${opts.reason}`,
    });
  }
}

export function dispatchStudioDataInvalidated(opts: {
  companyId: string;
  branchId?: string | null;
  reason: string;
}): void {
  dispatchDataInvalidated({
    domain: 'studio',
    companyId: opts.companyId,
    branchId: opts.branchId ?? null,
    reason: opts.reason,
  });
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
