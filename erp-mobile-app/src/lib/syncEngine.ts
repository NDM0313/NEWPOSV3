/**
 * Sync engine: when online, push unsynced records from offline store to Supabase.
 * Modules register handlers per type (sale, expense, etc.).
 */

import * as offlineStore from './offlineStore';
import type { PendingRecord, PendingType } from './offlineStore';
import { syncDebugLog } from './syncDebug';
import { formatApiErrorForDisplay } from './apiErrorUtils';

export type SyncHandler = (
  record: PendingRecord
) => Promise<{ serverId: string } | { error: string }>;

const handlers = new Map<PendingType, SyncHandler>();
const inFlight = new Set<string>();

export function registerSyncHandler(type: PendingType, handler: SyncHandler): void {
  handlers.set(type, handler);
}

export async function runSync(): Promise<{ synced: number; errors: number }> {
  const list = await offlineStore.getUnsynced();
  let synced = 0;
  let errors = 0;
  for (const record of list) {
    if (inFlight.has(record.id)) continue;
    syncDebugLog('record', { type: record.type, id: record.id });
    const handler = handlers.get(record.type);
    if (!handler) {
      syncDebugLog('no handler', { type: record.type, id: record.id });
      await offlineStore.markSyncError(record.id, `No handler for ${record.type}`);
      errors++;
      continue;
    }
    const claimed = await offlineStore.tryMarkSyncing(record.id);
    if (!claimed) {
      syncDebugLog('skip claim', { type: record.type, id: record.id });
      continue;
    }
    inFlight.add(record.id);
    try {
      const result = await handler(record);
      if ('serverId' in result) {
        syncDebugLog('synced', { type: record.type, id: record.id, serverId: result.serverId });
        await offlineStore.markSynced(record.id, result.serverId);
        synced++;
      } else {
        syncDebugLog('handler error', { type: record.type, id: record.id, error: result.error });
        await offlineStore.markSyncError(record.id, result.error);
        errors++;
      }
    } catch (e) {
      const msg = formatApiErrorForDisplay(e, 'Sync failed');
      syncDebugLog('exception', { type: record.type, id: record.id, message: msg });
      await offlineStore.markSyncError(record.id, msg);
      errors++;
    } finally {
      inFlight.delete(record.id);
    }
  }
  return { synced, errors };
}

export async function getUnsyncedCount(): Promise<number> {
  return offlineStore.getUnsyncedCount();
}

export async function hasSyncErrors(): Promise<boolean> {
  return offlineStore.hasSyncErrors();
}
