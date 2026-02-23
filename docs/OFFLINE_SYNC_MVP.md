# Offline Sync MVP

## Supported Types

| Type | Description |
|------|-------------|
| `sale` | Sales draft |
| `journal_entry` | Manual entry |
| `expense` | Expense |
| `payment` | Payment (future) |

## Flow

1. **Offline** — user creates transaction → saved to IndexedDB queue
2. **Online** — auto sync every 60s + on `online` event
3. **UI** — SyncStatusBar: "Offline" | "X pending" | "Syncing..." | "Sync Error"

## Storage

- **PWA / WebView:** IndexedDB (`erp_mobile_offline`, store `pending`)
- **APK/iOS:** Same (WebView IndexedDB)

## Files

- `erp-mobile-app/src/lib/offlineStore.ts` — queue (add, getUnsynced, markSynced)
- `erp-mobile-app/src/lib/syncEngine.ts` — runSync, registerSyncHandler
- `erp-mobile-app/src/lib/registerSyncHandlers.ts` — handlers for sale, expense, journal_entry
- `erp-mobile-app/src/components/SyncStatusBar.tsx` — status indicator

## Adding New Types

1. Add type to `PendingType` in `offlineStore.ts`
2. Register handler in `registerSyncHandlers.ts`
3. Module: call `addPending()` when offline, then sync when online
