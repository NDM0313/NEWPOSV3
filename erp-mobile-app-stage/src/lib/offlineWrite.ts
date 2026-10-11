/**
 * Uniform offline enqueue vs online API execution for mutations.
 */
import { isBrowserOffline } from './listCache';
import { addPending, type PendingType } from './offlineStore';

export type EnqueueOrRunResult<T> =
  | { mode: 'online'; result: T }
  | { mode: 'offline'; localId: string };

export async function enqueueOrRun<T>(opts: {
  type: PendingType;
  payload: Record<string, unknown>;
  companyId: string;
  branchId: string;
  onlineTask: () => Promise<T>;
}): Promise<EnqueueOrRunResult<T>> {
  if (isBrowserOffline()) {
    const localId = await addPending(opts.type, opts.payload, opts.companyId, opts.branchId);
    return { mode: 'offline', localId };
  }
  const result = await opts.onlineTask();
  return { mode: 'online', result };
}

export function isOfflineMode(): boolean {
  return isBrowserOffline();
}
