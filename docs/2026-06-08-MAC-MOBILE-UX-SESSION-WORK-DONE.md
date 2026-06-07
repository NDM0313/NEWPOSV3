# Mac / Mobile UX / Accounting Session — Work Done & Remaining

**Date:** 2026-06-08  
**Branch:** `main`  
**Scope:** Mobile release tooling, shell UX, payment narration fix, ledger UX, performance, browser storage hardening.

---

## Work completed

### 1. Mobile release (Mac)

- Added Mac npm scripts: `android:apk:release:mac`, `ios:ipa:release:mac`, `ios:prep:mac`
- New scripts: `build-ios-release-mac.sh`, `copy-release-ipa.mjs`, `open-ios-workspace.mjs`
- Version bumps: Android `versionCode` **38**, iOS build **13**
- Built locally: `erp-mobile-1.0.5-build38.apk`, `erp-mobile-1.0.5-build13.ipa` (binaries kept local — not in git)
- Documented: open `App.xcworkspace` (not `App.xcodeproj`), run `pod install` before Xcode build

### 2. Mobile shell UX (Phase 1)

- `@capacitor/status-bar` + `nativeShell.ts` for safe-area / status bar
- Global Android back button + `SwipeBackShell` wiring
- App header safe-area CSS vars, `HomeScreen` bottom padding
- `MainActivity` WindowInsets for Android edge-to-edge

### 3. Web logout fix (Phase 2)

- `TopHeader.tsx`: logout uses `DropdownMenuItem onSelect` instead of `onClick` (Radix menu closes correctly)

### 4. Payment narration — real customer name (Phase 3)

- **Migration:** `migrations/20260608120000_payment_narration_contact_name_fix.sql`
  - Updates `format_short_payment_narration_before_insert()` to resolve contact name from `contacts` when sale shows walk-in placeholder
  - Repair block uses subquery form (fixes PostgreSQL `42P01` on target alias in JOIN)
- **Mobile:** `recordCustomerPayment` syncs `customer_id` / sale name before RPC

### 5. Ledger UX (Phase 4)

- `AccountLedgerReportPage.tsx`: banner when parent account **1100** selected (AR control guidance)

### 6. iOS camera / Capacitor verify (Phase 5)

- `verify-dist-for-capacitor.mjs`: ML Kit stub check
- `cap:sync:ios:prod` runs verify before sync

### 7. Performance (Phase 6)

- `AccountingContext`: defers `getAllEntries` until accounting module opens (`ensureEntriesLoaded`)
- Mobile Vite `manualChunks` for non-Capacitor builds

### 8. Browser storage SecurityError fix

**Problem:** `SecurityError: Failed to read 'sessionStorage' property from 'Window'` in strict privacy / Cursor embedded browser.

**Fix:** All web `sessionStorage` / unsafe storage access routed through `src/app/lib/safeBrowserStorage.ts`:

- `AccountingDashboard`, `ExpensesDashboard`, `NotificationsDropdown`, `TransactionDetailModal`
- `AccountingIntegrityLabPage`, `SettingsPageNew`, `SalesPage`, `PurchasesPage`, `ContactsPage`, `RentalDashboard`
- `documentConversionSchema`, `contactsPartyDrilldown`, `developerMode`, `featureFlags`, `permissionEngine`
- `App.tsx`: `ThemeProvider` with `forcedTheme="dark"` (avoids theme storage reads)
- Mobile: `erp-mobile-app/src/lib/safeBrowserStorage.ts`, `pinLock.ts`, `supabase.ts`
- `ErrorBoundary`: clearer message for blocked local/session storage

**Note:** Extension noise (`quillbot`, `read.js`, `content.js`) and `loadAllSettings: 665ms` are not app bugs.

### 9. Mobile rental workflow display

- `RentalWorkflowBadges`, `rentalWorkflowDisplay.ts`, rental API/module updates

### 10. Rental / sales mobile API tweaks

- `erp-mobile-app/src/api/rentals.ts`, `api/sales.ts` (contact sync related)

---

## Remaining tasks

### Database (VPS)

- [ ] Apply migration on production Postgres:
  ```bash
  # On VPS — run forward migration only (additive trigger + repair UPDATE)
  psql ... -f migrations/20260608120000_payment_narration_contact_name_fix.sql
  ```
- [ ] Verify payment notes show real customer name (e.g. AMARJEET) not "Walk-in" after new receipts

### Deploy web

- [ ] Rebuild and deploy ERP web Docker image so production gets storage-hardening bundle
- [ ] Hard refresh or clear SW cache after deploy (`dist/sw.js` PWA)

### Mobile testing

- [ ] Test logout one-click (web TopHeader)
- [ ] Test mobile header / back / swipe-back on Android
- [ ] Test iOS camera after rebuild with `VITE_TARGET=capacitor`
- [ ] Optional: bump to build **39 / 14** and ship new APK/IPA after user sign-off

### User acceptance

- [ ] Payment narration on ledger for recent customer receipts
- [ ] Account ledger banner on 1100 parent selection
- [ ] App loads without crash in Chrome/Safari (avoid Cursor embedded browser for ERP)

### Not in this commit

- IPA/APK release binaries (local `erp-mobile-app/releases/*.ipa` — distribute via Drive/TestFlight, not git)
- `data/` local import folder
- `scripts/admin/clean-products-import-csv.mjs` (local admin tooling)

---

## Key files

| Area | Path |
|------|------|
| Migration | `migrations/20260608120000_payment_narration_contact_name_fix.sql` |
| Safe storage | `src/app/lib/safeBrowserStorage.ts` |
| Mobile shell | `erp-mobile-app/src/lib/nativeShell.ts`, `mobileBackPress.ts` |
| Mac iOS build | `erp-mobile-app/scripts/build-ios-release-mac.sh` |
| Ledger UX | `src/app/components/reports/AccountLedgerReportPage.tsx` |
| Session doc | `docs/2026-06-08-MAC-MOBILE-UX-SESSION-WORK-DONE.md` |

---

## Suggested commit message

```
fix(web+mobile): storage hardening, payment narration, mobile shell UX

Route sessionStorage through safe helpers to avoid SecurityError in strict
browsers; payment narration migration; Mac release scripts; mobile safe-area
and back navigation; ledger 1100 banner; deferred accounting load.
```
