import { useEffect } from 'react';
import { useSupabase } from '@/app/context/SupabaseContext';
import { dispatchDataInvalidated, dispatchGlobalRefresh } from '@/app/lib/dataInvalidationBus';
import { createDebouncedCallback, subscribeRealtimeDomains, type RealtimeDomain } from '@/app/lib/realtimeSubscriptions';
import { webRealtimeHealth } from '@/lib/supabase';
import { shouldSuppressRealtimeInvalidation } from '@/app/lib/localMutationSuppression';

const FALLBACK_POLL_MS = 120_000;
const FALLBACK_GRACE_MS = 120_000;
const FOCUS_REFRESH_MIN_MS = 45_000;

const FALLBACK_DOMAINS: RealtimeDomain[] = [
  'sales',
  'purchases',
  'accounting',
  'contacts',
  'inventory',
  'rentals',
  'studio',
];

export function WebRealtimeBridge() {
  const { companyId, branchId } = useSupabase();

  useEffect(() => {
    if (!companyId) return;
    let lastFocusRefreshAt = 0;
    const maybeFocusRefresh = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      const now = Date.now();
      if (now - lastFocusRefreshAt < FOCUS_REFRESH_MIN_MS) return;
      lastFocusRefreshAt = now;
      dispatchGlobalRefresh({ companyId, branchId: branchId ?? null, reason: 'focus-refresh' });
    };
    document.addEventListener('visibilitychange', maybeFocusRefresh);
    window.addEventListener('focus', maybeFocusRefresh);
    return () => {
      document.removeEventListener('visibilitychange', maybeFocusRefresh);
      window.removeEventListener('focus', maybeFocusRefresh);
    };
  }, [companyId, branchId]);

  useEffect(() => {
    if (!companyId) return;
    const debouncedByDomain = new Map<RealtimeDomain, () => void>();
    const queueFor = (domain: RealtimeDomain) => {
      let queue = debouncedByDomain.get(domain);
      if (!queue) {
        queue = createDebouncedCallback(() => {
          if (shouldSuppressRealtimeInvalidation()) return;
          dispatchDataInvalidated({
            domain,
            companyId,
            branchId: branchId ?? null,
            reason: 'realtime-change',
          });
        }, 220);
        debouncedByDomain.set(domain, queue);
      }
      queue();
    };

    const cleanup = subscribeRealtimeDomains({
      companyId,
      branchId,
      domains: FALLBACK_DOMAINS,
      channelKey: 'global',
      onChange: (domain) => queueFor(domain),
    });
    if (!cleanup || !webRealtimeHealth.canUseRealtime) {
      const mountedAt = Date.now();
      const runFallbackPoll = () => {
        if (typeof document !== 'undefined' && document.hidden) return;
        if (Date.now() - mountedAt < FALLBACK_GRACE_MS) return;
        for (const domain of FALLBACK_DOMAINS) {
          dispatchDataInvalidated({
            domain,
            companyId,
            branchId: branchId ?? null,
            reason: 'fallback-poll',
          });
        }
      };
      const fallback = setInterval(runFallbackPoll, FALLBACK_POLL_MS);
      return () => clearInterval(fallback);
    }
    return () => {
      if (cleanup) cleanup();
    };
  }, [companyId, branchId]);

  return null;
}
