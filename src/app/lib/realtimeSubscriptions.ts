import { supabase, webRealtimeHealth } from '@/lib/supabase';

export type RealtimeDomain =
  | 'sales'
  | 'purchases'
  | 'accounting'
  | 'contacts'
  | 'inventory'
  | 'rentals'
  | 'studio';

/** Tables per domain. `branchScoped: false` = filter company_id only (column may lack branch_id). */
const DOMAIN_TABLE_CONFIG: Record<RealtimeDomain, { table: string; branchScoped: boolean }[]> = {
  sales: [
    { table: 'sales', branchScoped: true },
    { table: 'payments', branchScoped: true },
  ],
  purchases: [
    { table: 'purchases', branchScoped: true },
    { table: 'payments', branchScoped: true },
  ],
  accounting: [
    { table: 'journal_entries', branchScoped: true },
    { table: 'payments', branchScoped: true },
  ],
  contacts: [
    { table: 'contacts', branchScoped: false },
    { table: 'payments', branchScoped: true },
  ],
  inventory: [
    { table: 'products', branchScoped: false },
    { table: 'stock_movements', branchScoped: true },
  ],
  rentals: [{ table: 'rentals', branchScoped: true }],
  studio: [
    { table: 'studio_production_orders_v2', branchScoped: true },
    { table: 'studio_production_orders_v3', branchScoped: true },
    { table: 'studio_productions', branchScoped: true },
  ],
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
    const configs = DOMAIN_TABLE_CONFIG[domain] || [];
    for (const { table, branchScoped } of configs) {
      const filters = [`company_id=eq.${scope.companyId}`];
      if (branchFilter && branchScoped) filters.push(`branch_id=eq.${branchFilter}`);
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
