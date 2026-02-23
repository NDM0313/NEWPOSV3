/**
 * Sync engine: when online, push unsynced records from offline store to Supabase.
 * Modules register handlers per type (sale, expense, etc.).
 */

import * as offlineStore from './offlineStore';
import type { PendingRecord, PendingType } from './offlineStore';

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
    const handler = handlers.get(record.type);
    if (!handler) {
      await offlineStore.markSyncError(record.id, `No handler for ${record.type}`);
      errors++;
      continue;
    }
    try {
      const result = await handler(record);
      if ('serverId' in result) {
        await offlineStore.markSynced(record.id, result.serverId);
        synced++;
      } else {
        await offlineStore.markSyncError(record.id, result.error);
        errors++;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sync failed';
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
