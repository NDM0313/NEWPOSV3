# Mac / Mobile UX / Accounting Session — Work Done & Remaining

**Date:** 2026-06-08  
**Branch:** `main`  
**GitHub:** https://github.com/NDM0313/NEWPOSV3  
**Commits:** `92cc7854` → `2717212e` → `1fb3fff8` (storage, build 39/14, deploy finish docs)  
**Scope:** Mobile release tooling, shell UX, payment narration fix, ledger UX, performance, browser storage hardening, VPS deploy.

---

## Work completed

### 1. Mobile release (Mac) — build 39 / 14

- Mac scripts: `android:apk:release:mac`, `ios:ipa:release:mac`, `build-ios-release-mac.sh`
- **Android `versionCode` 39** → `releases/erp-mobile-1.0.5-build39.apk` (31 MB, built 2026-06-08)
- **iOS build 14** → `releases/erp-mobile-1.0.5-build14.ipa` (9.8 MB, built 2026-06-08)
- Docs: [`IOS_DEVELOPMENT_IPA_BUILD14.md`](../erp-mobile-app/releases/IOS_DEVELOPMENT_IPA_BUILD14.md), [`APK_UPDATE.md`](../erp-mobile-app/releases/APK_UPDATE.md)
- iOS export auto-seeds `ExportOptions.plist` from prior `ios-export-build*` folder when missing

### 2. Mobile shell UX

- `@capacitor/status-bar` + `nativeShell.ts` safe-area CSS vars
- **HomeScreen** top bar: `flow-screen-header` (status bar / notch clearance)
- Global Android back button + `SwipeBackShell` + `mobileBackPress.ts`
- `MainActivity` WindowInsets

### 3. Web logout + storage hardening (deployed)

- `TopHeader.tsx`: logout via `DropdownMenuItem onSelect`
- All web `sessionStorage` via `safeBrowserStorage.ts`
- **VPS deploy completed** 2026-06-08 — `https://erp.dincouture.pk` HTTP 200, fresh nginx bundle

### 4. Payment narration migration (VPS — user applied)

- [`migrations/20260608120000_payment_narration_contact_name_fix.sql`](../migrations/20260608120000_payment_narration_contact_name_fix.sql)
- Mobile `recordCustomerPayment` syncs contact before RPC

### 5. iOS camera release gates

- `VITE_TARGET=capacitor` **required** — `verify-mobile-build-env.mjs` fails if missing
- `verify-dist-for-capacitor.mjs` blocks mlkit-stub in `dist/` (verified on build 39/14)
- CocoaPods: `CapacitorMlkitBarcodeScanning` in Podfile

### 6. Ledger UX, performance, rental workflow

- Account ledger banner on parent **1100**
- Deferred `AccountingContext` entries load
- Rental workflow badges + salesman display

---

## Remaining (manual sign-off on device / browser)

### User acceptance checklist

| # | Test | Where | Status |
|---|------|--------|--------|
| 1 | Login, no `sessionStorage` crash | Chrome/Safari → `erp.dincouture.pk` | **You verify** (hard refresh / clear SW once) |
| 2 | TopHeader logout one click | Web user menu | **You verify** |
| 3 | Payment note shows real name (not Walk-in) | New receipt after migration | **You verify** |
| 4 | Ledger banner on account 1100 | Reports → Account ledger | **You verify** |
| 5 | Home header clears status bar | Mobile build 39/14 | **You verify** |
| 6 | Back: module → home | Android back / iOS swipe | **You verify** |
| 7 | ML Kit barcode scan | Sales → Add products → Scan | **You verify on iPhone** |
| 8 | Camera photo attach | Expense/sale attachment | **You verify** |

### Install commands

```bash
# Android (USB debugging)
adb install -r erp-mobile-app/releases/erp-mobile-1.0.5-build39.apk

# iOS — Xcode → Devices → drag:
# erp-mobile-app/releases/erp-mobile-1.0.5-build14.ipa
```

---

## Key files

| Area | Path |
|------|------|
| Migration | `migrations/20260608120000_payment_narration_contact_name_fix.sql` |
| Safe storage | `src/app/lib/safeBrowserStorage.ts` |
| Mobile shell | `erp-mobile-app/src/lib/nativeShell.ts`, `mobileBackPress.ts` |
| Home header | `erp-mobile-app/src/components/HomeScreen.tsx` |
| Mac iOS build | `erp-mobile-app/scripts/build-ios-release-mac.sh` |
| VPS deploy | `deploy/deploy.sh` |

---

## Automated verification (2026-06-08)

- VPS `deploy/deploy.sh` — **ERP running**
- `verify-mobile-build-env` — `VITE_TARGET=capacitor` OK
- `verify-dist-for-capacitor` — no mlkit-stub in dist
- APK 39 + IPA 14 — **BUILD SUCCESSFUL**
