import {
  supabase,
  mobileRealtimeHealth,
  noteMobileRealtimeConnectionFailure,
  resetMobileRealtimeFailureCount,
} from './supabase';

export type MobileRealtimeDomain = 'sales' | 'purchases' | 'accounting' | 'contacts';

const DOMAIN_TABLES: Record<MobileRealtimeDomain, string[]> = {
  sales: ['sales', 'payments'],
  purchases: ['purchases', 'payments'],
  accounting: ['journal_entries', 'journal_entry_lines', 'payments', 'accounts', 'expenses'],
  contacts: ['contacts', 'payments'],
};

const REALTIME_SUBSCRIBE_DEFER_MS = 2000;

export function createDebouncedRunner(task: () => void, waitMs = 240): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return () => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      task();
    }, waitMs);
  };
}

function subscribeMobileRealtimeNow(args: {
  companyId: string;
  branchId?: string | null;
  channelKey: string;
  domains: MobileRealtimeDomain[];
  onChange: (domain: MobileRealtimeDomain, table: string) => void;
}): () => void {
  const branchFilter = args.branchId && args.branchId !== 'all' ? args.branchId : null;
  const channel = supabase.channel(`mobile-live-${args.channelKey}-${args.companyId}-${branchFilter ?? 'all'}`);
  const domains = new Set(args.domains);

  for (const domain of domains) {
    const tables = DOMAIN_TABLES[domain] || [];
    for (const table of tables) {
      const filters = [`company_id=eq.${args.companyId}`];
      if (branchFilter) filters.push(`branch_id=eq.${branchFilter}`);
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: filters.join(',') },
        () => args.onChange(domain, table),
      );
    }
  }

  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      resetMobileRealtimeFailureCount();
      return;
    }
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      noteMobileRealtimeConnectionFailure();
    }
  });

  return () => {
    void supabase.removeChannel(channel);
  };
}

export function subscribeMobileRealtime(args: {
  companyId: string;
  branchId?: string | null;
  channelKey: string;
  domains: MobileRealtimeDomain[];
  onChange: (domain: MobileRealtimeDomain, table: string) => void;
}): (() => void) | null {
  if (!mobileRealtimeHealth.canUseRealtime) return null;

  let cancelled = false;
  let innerCleanup: (() => void) | null = null;
  const timer = setTimeout(() => {
    if (cancelled || !mobileRealtimeHealth.canUseRealtime) return;
    innerCleanup = subscribeMobileRealtimeNow(args);
  }, REALTIME_SUBSCRIBE_DEFER_MS);

  return () => {
    cancelled = true;
    clearTimeout(timer);
    innerCleanup?.();
  };
}
