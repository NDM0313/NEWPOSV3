export const DATA_INVALIDATED_EVENT = 'erp:dataInvalidated';

/** Fired once when the user requests a full app data refresh. */
export const GLOBAL_REFRESH_EVENT = 'erp:globalRefresh';

export type GlobalRefreshReason = 'user-refresh' | 'focus-refresh';

export interface GlobalRefreshDetail {
  companyId?: string | null;
  branchId?: string | null;
  reason: GlobalRefreshReason;
  ts: number;
}

export type InvalidationDomain =
  | 'contacts'
  | 'inventory'
  | 'accounting'
  | 'sales'
  | 'purchases'
  | 'rentals'
  | 'studio';

const ALL_INVALIDATION_DOMAINS: InvalidationDomain[] = [
  'accounting',
  'sales',
  'purchases',
  'contacts',
  'inventory',
  'rentals',
  'studio',
];

/** Manual refresh — one header control refreshes every module that listens to the invalidation bus. */
export function dispatchGlobalRefresh(opts?: {
  companyId?: string | null;
  branchId?: string | null;
  reason?: GlobalRefreshReason;
}): void {
  if (typeof window === 'undefined') return;
  const reason = opts?.reason ?? 'user-refresh';
  window.dispatchEvent(
    new CustomEvent<GlobalRefreshDetail>(GLOBAL_REFRESH_EVENT, {
      detail: {
        companyId: opts?.companyId ?? null,
        branchId: opts?.branchId ?? null,
        reason,
        ts: Date.now(),
      },
    })
  );
  for (const domain of ALL_INVALIDATION_DOMAINS) {
    dispatchDataInvalidated({
      domain,
      companyId: opts?.companyId ?? null,
      branchId: opts?.branchId ?? null,
      reason,
    });
  }
}

export function isGlobalRefreshReason(reason?: string | null): boolean {
  const r = String(reason ?? '').toLowerCase();
  return r === 'user-refresh' || r === 'focus-refresh';
}

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

/** Single accounting-domain invalidation (prefer over `accountingEntriesChanged` + `paymentAdded` + `ledgerUpdated`). */
/** Accounting-only invalidations that must not reload full inventory overview. */
export function shouldSkipInventoryReloadForReason(reason?: string): boolean {
  if (!reason) return false;
  const r = reason.toLowerCase();
  return (
    r.includes('sale-payment') ||
    r.includes('saledocumentjournalcreated') ||
    r.includes('accounting-entries-changed') ||
    r.includes('sales-context-payment') ||
    r.includes('manualreceipt') ||
    r.includes('manualsupplier') ||
    r.includes('product-csv-import')
  );
}

export function dispatchAccountingInvalidated(opts: {
  companyId: string;
  branchId?: string | null;
  entityId?: string | null;
  reason: string;
}): void {
  dispatchDataInvalidated({
    domain: 'accounting',
    companyId: opts.companyId,
    branchId: opts.branchId ?? null,
    entityId: opts.entityId ?? null,
    reason: opts.reason,
  });
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
