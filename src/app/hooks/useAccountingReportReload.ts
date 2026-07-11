import { useEffect, useState } from 'react';
import {
  DATA_INVALIDATED_EVENT,
  GLOBAL_REFRESH_EVENT,
  shouldAcceptInvalidation,
  type DataInvalidationDetail,
} from '@/app/lib/dataInvalidationBus';

const LEGACY_RELOAD_EVENTS = ['accountingEntriesChanged', 'paymentAdded', 'ledgerUpdated'] as const;
const DEFAULT_DEBOUNCE_MS = 200;

export function subscribeAccountingReportReload(
  onReload: () => void,
  opts?: {
    companyId?: string | null;
    branchId?: string | null;
    debounceMs?: number;
  },
): () => void {
  if (typeof window === 'undefined') return () => undefined;

  let timer: ReturnType<typeof setTimeout> | null = null;
  const debounceMs = opts?.debounceMs ?? DEFAULT_DEBOUNCE_MS;

  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      onReload();
    }, debounceMs);
  };

  const onDataInvalidated = (ev: Event) => {
    const detail = (ev as CustomEvent<DataInvalidationDetail>).detail;
    if (
      !shouldAcceptInvalidation(detail, {
        domain: ['accounting', 'reports'],
        companyId: opts?.companyId,
        branchId: opts?.branchId,
      })
    ) {
      return;
    }
    schedule();
  };

  const onGlobalRefresh = () => schedule();
  const onLegacy = () => schedule();

  window.addEventListener(DATA_INVALIDATED_EVENT, onDataInvalidated as EventListener);
  window.addEventListener(GLOBAL_REFRESH_EVENT, onGlobalRefresh);
  for (const name of LEGACY_RELOAD_EVENTS) {
    window.addEventListener(name, onLegacy);
  }

  return () => {
    if (timer) clearTimeout(timer);
    window.removeEventListener(DATA_INVALIDATED_EVENT, onDataInvalidated as EventListener);
    window.removeEventListener(GLOBAL_REFRESH_EVENT, onGlobalRefresh);
    for (const name of LEGACY_RELOAD_EVENTS) {
      window.removeEventListener(name, onLegacy);
    }
  };
}

/** Debounced reload epoch for accounting report pages (Roznamcha, Day Book, Ledger V2). */
export function useAccountingReportReload(opts?: {
  companyId?: string | null;
  branchId?: string | null;
}): number {
  const [reloadEpoch, setReloadEpoch] = useState(0);

  useEffect(() => {
    return subscribeAccountingReportReload(() => setReloadEpoch((n) => n + 1), opts);
  }, [opts?.companyId, opts?.branchId]);

  return reloadEpoch;
}
