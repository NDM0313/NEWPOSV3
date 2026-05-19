# Phase 3 — Mobile PIN switching and offline repair

**Scope:** `erp-mobile-app/` client-only. No Postgres migrations, no Supabase URL/key changes ([`docs/infra/MOBILE_APK_LOCKED_PATTERN.md`](docs/infra/MOBILE_APK_LOCKED_PATTERN.md)).

## Implementation status (2026-05-19)

- [x] **offline-idb-v2** — IndexedDB v2 hardening ([`offlineStore.ts`](erp-mobile-app/src/lib/offlineStore.ts), `DB_VERSION = 2`, `PENDING` | `SYNCING` | `SYNCED` | `ERROR`)
- [x] **syncengine-status** — Sync engine transitions ([`syncEngine.ts`](erp-mobile-app/src/lib/syncEngine.ts))
- [x] **network-autosync** — `@capacitor/network` + [`networkBridge.ts`](erp-mobile-app/src/lib/networkBridge.ts); App debounced `runSync` on reconnect
- [x] **devtools-sync-ui** — Developer Tools sync counts ([`DeveloperToolsSection.tsx`](erp-mobile-app/src/components/settings/DeveloperToolsSection.tsx))
- [x] **counter-vault-switch** — Multi-user PIN switching & enrollment ([`counterUserVault.ts`](erp-mobile-app/src/lib/counterUserVault.ts), [`SwitchUserPinOverlay.tsx`](erp-mobile-app/src/components/auth/SwitchUserPinOverlay.tsx))

## Next Polish Targets

- [ ] **Google Pixel 6 Pro & Emulator physical device WebView test** — Reloading / matching debug signatures for [`DebugSslWebViewClient.java`](erp-mobile-app/android/app/src/main/java/com/dincouture/erp/DebugSslWebViewClient.java) (see [`docs/infra/ANDROID_DEBUG_WEBVIEW_SSL.md`](docs/infra/ANDROID_DEBUG_WEBVIEW_SSL.md)). Validate OAuth return, OTP wizard, and offline autosync on real hardware.

## Step 1 — Counter tablet multi-user PIN

- **Secondary vault:** [`erp-mobile-app/src/lib/counterUserVault.ts`](erp-mobile-app/src/lib/counterUserVault.ts) — IndexedDB `erp_mobile_counter_vault`, rows keyed by SHA-256 of 4-digit PIN; payload encrypted with PIN-derived key (same crypto pattern as [`secureStorage.ts`](erp-mobile-app/src/lib/secureStorage.ts)).
- **Session swap:** PIN unlock → decrypt `SecurePayload` → [`refreshSessionFromRefreshToken`](erp-mobile-app/src/api/auth.ts) → `getProfile` → update App `user` / `companyId` / branch.
- **UI:** [`SwitchUserPinOverlay`](erp-mobile-app/src/components/auth/SwitchUserPinOverlay.tsx) on POS + Expense headers; Settings enrollment for admin/owner to save current session under a new 4-digit PIN.
- **Flush:** [`sessionSwitchBus`](erp-mobile-app/src/lib/sessionSwitchBus.ts) event → App invalidates sales/purchases/accounting/contacts and clears document edit intent (primary device PIN vault unchanged).

## Step 2 — Offline queue repair

- **IndexedDB** (already used): bump [`offlineStore.ts`](erp-mobile-app/src/lib/offlineStore.ts) to v2 with explicit `status`: `PENDING` | `SYNCING` | `SYNCED` | `ERROR` (migrated from `is_synced` / `sync_error`).
- **Sync:** [`syncEngine.ts`](erp-mobile-app/src/lib/syncEngine.ts) sets `SYNCING` before handler; `SYNCED` / `ERROR` after; in-memory guard avoids duplicate work on one id.
- **Network:** [`@capacitor/network`](erp-mobile-app/package.json) + [`networkBridge.ts`](erp-mobile-app/src/lib/networkBridge.ts); App debounces `runSync` on reconnect; writes `erp_mobile_last_autosync_at` in localStorage after successful flush.
- **DevTools:** [`DeveloperToolsSection.tsx`](erp-mobile-app/src/components/settings/DeveloperToolsSection.tsx) shows pending / error counts and last auto-sync time.

## Verification

- Enroll counter PIN → switch from POS → `auth` user id changes; permissions reload.
- Offline sale/expense → `PENDING` → online → auto-sync drains queue.
