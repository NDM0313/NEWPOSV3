/**
 * Sync engine: when online, push unsynced records from offline store to Supabase.
 * Modules register handlers per type (sale, expense, etc.).
 */

import * as offlineStore from './offlineStore';
import type { PendingRecord, PendingType } from './offlineStore';
import { syncDebugLog } from './syncDebug';

export type SyncHandler = (
  record: PendingRecord
) => Promise<{ serverId: string } | { error: string }>;

const handlers = new Map<PendingType, SyncHandler>();

export function registerSyncHandler(type: PendingType, handler: SyncHandler): void {
  handlers.set(type, handler);
}

export async function runSync(): Promise<{ synced: number; errors: number }> {
  const list = await offlineStore.getUnsynced();
  let synced = 0;
  let errors = 0;
  for (const record of list) {
    syncDebugLog('record', { type: record.type, id: record.id });
    const handler = handlers.get(record.type);
    if (!handler) {
      syncDebugLog('no handler', { type: record.type, id: record.id });
      await offlineStore.markSyncError(record.id, `No handler for ${record.type}`);
      errors++;
      continue;
    }
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
      const msg = e instanceof Error ? e.message : 'Sync failed';
      syncDebugLog('exception', { type: record.type, id: record.id, message: msg });
      await offlineStore.markSyncError(record.id, msg);
      errors++;
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
