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

const isDev =
  typeof import.meta !== 'undefined' &&
  Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV);

const REALTIME_SUBSCRIBE_DEFER_MS = isDev ? 5000 : 2000;
const TEARDOWN_GRACE_MS = isDev ? 800 : 400;

let authReady = false;
let authListenerInstalled = false;
let subscribedDevLogged = false;

function ensureAuthListener(): void {
  if (authListenerInstalled) return;
  authListenerInstalled = true;
  supabase.auth.onAuthStateChange((event, session) => {
    if (
      (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') &&
      session?.access_token
    ) {
      authReady = true;
      void supabase.realtime.setAuth(session.access_token);
      for (const entry of managed.values()) {
        if (entry.refCount > 0) scheduleConnect(entry);
      }
    }
    if (event === 'SIGNED_OUT' && !session) {
      authReady = false;
    }
  });
}

type SubscribeArgs = {
  companyId: string;
  branchId?: string | null;
  channelKey: string;
  domains: MobileRealtimeDomain[];
  onChange: (domain: MobileRealtimeDomain, table: string) => void;
};

type ManagedEntry = {
  key: string;
  refCount: number;
  args: SubscribeArgs;
  deferTimer: ReturnType<typeof setTimeout> | null;
  teardownTimer: ReturnType<typeof setTimeout> | null;
  innerCleanup: (() => void) | null;
  connecting: boolean;
  disposing: boolean;
};

const managed = new Map<string, ManagedEntry>();

function subscriptionKey(args: Pick<SubscribeArgs, 'companyId' | 'branchId' | 'channelKey'>): string {
  const branch = args.branchId && args.branchId !== 'all' ? args.branchId : 'all';
  return `${args.channelKey}:${args.companyId}:${branch}`;
}

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

async function subscribeMobileRealtimeNow(entry: ManagedEntry): Promise<() => void> {
  const args = entry.args;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token || !mobileRealtimeHealth.canUseRealtime) return () => {};

  entry.connecting = true;
  await supabase.realtime.setAuth(session.access_token);

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

  entry.disposing = false;

  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      entry.connecting = false;
      resetMobileRealtimeFailureCount();
      if (isDev && !subscribedDevLogged) {
        subscribedDevLogged = true;
        console.info('[ERP Mobile] Realtime SUBSCRIBED (dev)');
      }
      return;
    }
    if (entry.disposing) return;
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      entry.connecting = false;
      noteMobileRealtimeConnectionFailure();
    }
  });

  return () => {
    entry.disposing = true;
    entry.connecting = false;
    void supabase.removeChannel(channel);
  };
}

function scheduleConnect(entry: ManagedEntry): void {
  if (!mobileRealtimeHealth.canUseRealtime || !authReady) return;
  if (entry.innerCleanup || entry.deferTimer) return;

  entry.deferTimer = setTimeout(() => {
    entry.deferTimer = null;
    if (entry.refCount <= 0 || !mobileRealtimeHealth.canUseRealtime || !authReady) return;
    void (async () => {
      if (entry.innerCleanup || entry.refCount <= 0) return;
      entry.innerCleanup = await subscribeMobileRealtimeNow(entry);
    })();
  }, REALTIME_SUBSCRIBE_DEFER_MS);
}

function teardownEntry(entry: ManagedEntry): void {
  if (entry.deferTimer) {
    clearTimeout(entry.deferTimer);
    entry.deferTimer = null;
  }
  entry.disposing = true;
  entry.innerCleanup?.();
  entry.innerCleanup = null;
  entry.connecting = false;
  managed.delete(entry.key);
}

function releaseEntry(key: string): void {
  const entry = managed.get(key);
  if (!entry) return;
  entry.refCount -= 1;
  if (entry.refCount > 0) return;

  if (entry.teardownTimer) clearTimeout(entry.teardownTimer);
  entry.teardownTimer = setTimeout(() => {
    entry.teardownTimer = null;
    const current = managed.get(key);
    if (!current || current.refCount > 0) return;
    teardownEntry(current);
  }, TEARDOWN_GRACE_MS);
}

export function subscribeMobileRealtime(args: SubscribeArgs): (() => void) | null {
  if (!mobileRealtimeHealth.canUseRealtime) return null;

  ensureAuthListener();

  const key = subscriptionKey(args);
  let entry = managed.get(key);
  if (!entry) {
    entry = {
      key,
      refCount: 0,
      args,
      deferTimer: null,
      teardownTimer: null,
      innerCleanup: null,
      connecting: false,
      disposing: false,
    };
    managed.set(key, entry);
  } else {
    entry.args = args;
  }

  if (entry.teardownTimer) {
    clearTimeout(entry.teardownTimer);
    entry.teardownTimer = null;
  }

  entry.refCount += 1;

  void (async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) {
      authReady = true;
      await supabase.realtime.setAuth(data.session.access_token);
    }
    if (entry!.refCount > 0) scheduleConnect(entry!);
  })();

  return () => releaseEntry(key);
}
