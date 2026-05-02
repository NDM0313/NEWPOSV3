import { supabase, webRealtimeHealth } from '@/lib/supabase';

export type RealtimeDomain = 'sales' | 'purchases' | 'accounting' | 'contacts';

const DOMAIN_TABLES: Record<RealtimeDomain, string[]> = {
  sales: ['sales', 'payments'],
  purchases: ['purchases', 'payments'],
  accounting: ['journal_entries', 'payments'],
  contacts: ['contacts', 'payments'],
};

export interface RealtimeScope {
  companyId: string;
  branchId?: string | null;
  domains: RealtimeDomain[];
  onChange: (domain: RealtimeDomain, table: string) => void;
  channelKey: string;
}

export function createDebouncedCallback(cb: () => void, waitMs = 220): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return () => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      cb();
    }, waitMs);
  };
}

export function subscribeRealtimeDomains(scope: RealtimeScope): (() => void) | null {
  if (!webRealtimeHealth.canUseRealtime) return null;
  const branchFilter = scope.branchId && scope.branchId !== 'all' ? scope.branchId : null;
  const channel = supabase.channel(`web-live-${scope.channelKey}-${scope.companyId}-${branchFilter ?? 'all'}`);
  const domainSet = new Set(scope.domains);

  for (const domain of domainSet) {
    const tables = DOMAIN_TABLES[domain] || [];
    for (const table of tables) {
      const filters = [`company_id=eq.${scope.companyId}`];
      if (branchFilter) filters.push(`branch_id=eq.${branchFilter}`);
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: filters.join(',') },
        () => scope.onChange(domain, table)
      );
    }
  }

  channel.subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
