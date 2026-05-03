import { useEffect } from 'react';
import { useSupabase } from '@/app/context/SupabaseContext';
import { dispatchDataInvalidated } from '@/app/lib/dataInvalidationBus';
import { createDebouncedCallback, subscribeRealtimeDomains, type RealtimeDomain } from '@/app/lib/realtimeSubscriptions';
import { webRealtimeHealth } from '@/lib/supabase';

export function WebRealtimeBridge() {
  const { companyId, branchId } = useSupabase();

  useEffect(() => {
    if (!companyId) return;
    const debouncedByDomain = new Map<RealtimeDomain, () => void>();
    const queueFor = (domain: RealtimeDomain) => {
      let queue = debouncedByDomain.get(domain);
      if (!queue) {
        queue = createDebouncedCallback(() => {
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
      domains: ['sales', 'purchases', 'accounting', 'contacts', 'inventory', 'rentals', 'studio'],
      channelKey: 'global',
      onChange: (domain) => queueFor(domain),
    });
    if (!cleanup || !webRealtimeHealth.canUseRealtime) {
      const fallback = setInterval(() => {
        (
          [
            'sales',
            'purchases',
            'accounting',
            'contacts',
            'inventory',
            'rentals',
            'studio',
          ] as RealtimeDomain[]
        ).forEach((domain) =>
          dispatchDataInvalidated({
            domain,
            companyId,
            branchId: branchId ?? null,
            reason: 'fallback-poll',
          })
        );
      }, 45000);
      return () => clearInterval(fallback);
    }
    return () => {
      if (cleanup) cleanup();
    };
  }, [companyId, branchId]);

  return null;
}
