/**
 * Accounting-scoped cache invalidation for mobile Single Core screens.
 * Does not invent balances; only clears list/session markers.
 */

import { listCacheKeys, listCacheRemove } from '../../lib/listCache';

const ACCOUNTING_EPOCH_KEY = 'erp_mobile_accounting_refresh_epoch';

export function bumpAccountingRefreshEpoch(): number {
  try {
    const next = Date.now();
    sessionStorage.setItem(ACCOUNTING_EPOCH_KEY, String(next));
    window.dispatchEvent(new CustomEvent('erp-mobile-accounting-refresh', { detail: { epoch: next } }));
    return next;
  } catch {
    return Date.now();
  }
}

export function readAccountingRefreshEpoch(): number {
  try {
    return Number(sessionStorage.getItem(ACCOUNTING_EPOCH_KEY) || 0) || 0;
  } catch {
    return 0;
  }
}

/** Clear company-scoped list caches that can show stale balances. */
export async function invalidateCompanyAccountingCaches(companyId: string): Promise<void> {
  if (!companyId) return;
  const keys = [
    listCacheKeys.paymentAccounts(companyId),
    listCacheKeys.workers(companyId),
    listCacheKeys.contacts(companyId, 'customer', ''),
    listCacheKeys.contacts(companyId, 'supplier', ''),
    listCacheKeys.contacts(companyId, 'customer', 'all'),
    listCacheKeys.contacts(companyId, 'supplier', 'all'),
  ];
  await Promise.all(keys.map((k) => listCacheRemove(k)));
  bumpAccountingRefreshEpoch();
}

export async function invalidateAfterAccountingWrite(opts: {
  companyId: string;
  partyKind?: string;
  partyId?: string;
  branchId?: string | null;
  reason?: string;
}): Promise<void> {
  const { companyId, partyKind, partyId, branchId, reason } = opts;
  if (!companyId) return;
  if (partyKind && partyId) {
    // Clear known all-time / common range keys if present; epoch bump covers live reports.
    await listCacheRemove(listCacheKeys.ledger(companyId, partyKind, partyId, 'all'));
  }
  await invalidateCompanyAccountingCaches(companyId);
  try {
    const { dispatchMobileAccountingInvalidated } = await import('../../lib/dataInvalidationBus');
    dispatchMobileAccountingInvalidated({
      companyId,
      branchId: branchId ?? null,
      reason: reason ?? 'accounting-write',
    });
  } catch {
    /* bus optional in non-browser tests */
  }
}

export async function clearAccountingStateOnLogout(): Promise<void> {
  try {
    sessionStorage.removeItem(ACCOUNTING_EPOCH_KEY);
  } catch {
    /* ignore */
  }
  bumpAccountingRefreshEpoch();
}
