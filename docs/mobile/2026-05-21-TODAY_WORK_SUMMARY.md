# ERP Mobile — Today's work summary

**Date:** 2026-05-21  
**Repo:** NEWPOSV3 (`main`)  
**VPS baseline:** `2a5dad94` (deployed)  
**Mobile target:** build **1.0.5 (6)** + uncommitted fixes below (office rebuild → build **7** recommended)

---

## 1. VPS & database (production)

| Item | Status |
|------|--------|
| SSH host `dincouture-vps` | Deploy + migrations OK |
| Migration `20260526120000_courier_shipments_dates_and_shipment_journal.sql` | Applied |
| `post_sale_shipment_journal` / shipment GL path | Live after migration |
| `deploy.sh` full deploy | OK |
| GoTrue auth audit | PASS (4 checks, 0 WARN) — no `.env` auth changes |

---

## 2. Mobile bug fix — `invalid input syntax for type uuid: "all"`

**Symptom:** Red toast on payment / RPC when branch picker is **All Branches** (`id: 'all'`).

**Fix:**

- New [`erp-mobile-app/src/utils/branchId.ts`](../../erp-mobile-app/src/utils/branchId.ts) — `resolveBranchUuidForWrite`, `isBranchSentinel`, `safeRpcBranchId`, `isRealBranchUuid`
- Wired into API writes: `sales.ts`, `purchases.ts`, `expenses.ts`, `rentals.ts`, `accounts.ts` (supplier/worker payments)
- UI guards: [`ExpenseEntryFlow.tsx`](../../erp-mobile-app/src/components/accounts/ExpenseEntryFlow.tsx), [`MobilePaymentSheet.tsx`](../../erp-mobile-app/src/components/shared/MobilePaymentSheet.tsx)

---

## 3. Mobile feature — Barcode scan on iOS/APK (Add Products)

**Symptom:** Sales → Add Items → **Scan** showed *"Camera scan not supported in this browser"* on Capacitor WebView.

**Cause:** [`AddProducts.tsx`](../../erp-mobile-app/src/components/sales/AddProducts.tsx) used [`BarcodeCameraModal.tsx`](../../erp-mobile-app/src/components/sales/BarcodeCameraModal.tsx) (`window.BarcodeDetector` only). iOS/Android WebView does not expose that API.

**Fix (matches POS / Inventory):**

- [`AddProducts.tsx`](../../erp-mobile-app/src/components/sales/AddProducts.tsx): `useBarcodeScanner` from [`features/barcode`](../../erp-mobile-app/src/features/barcode)
- Native ML Kit first → `barcode.startScan(processBarcode)`; web dev fallback → `BarcodeCameraModal`
- Scan button spinner when `barcode.loading`; permission errors via existing toast
- Prod sync: `npm run cap:sync:ios:prod` / `cap:sync:android:prod` (`VITE_TARGET=capacitor`, `@capacitor-mlkit/barcode-scanning@8.0.1`)

---

## 4. Mobile UX — Settings page compression

**Problem:** [`SettingsModule.tsx`](../../erp-mobile-app/src/components/settings/SettingsModule.tsx) ~1400 lines, long scroll.

**Fix:**

| File | Role |
|------|------|
| [`settingsUi.tsx`](../../erp-mobile-app/src/components/settings/settingsUi.tsx) | `SettingsRow`, `SettingsCollapsible` |
| [`SettingsCounterSection.tsx`](../../erp-mobile-app/src/components/settings/SettingsCounterSection.tsx) | Counter PIN, policy, shared mode — short help + **Details** |
| [`SettingsPrinterSection.tsx`](../../erp-mobile-app/src/components/settings/SettingsPrinterSection.tsx) | Printer, receipt toggles, barcode method, labels |
| [`SettingsModule.tsx`](../../erp-mobile-app/src/components/settings/SettingsModule.tsx) | Orchestrator with accordions |

**Sections (default collapsed except Account & branch):**

Account & branch (open) → Company (admin) → Security → Counter & lock screen → Printer & barcode → Data & sync → App (includes `ConnectionDebug`) → Logout (always visible).

---

## 5. Mobile builds (local artifacts)

| Platform | Artifact | Notes |
|----------|----------|--------|
| Android | `erp-mobile-app/releases/erp-mobile-1.0.5-build6-debug.apk` | Debug; ~31 MB; **does not include** barcode/settings fixes until rebuild |
| iOS | `erp-mobile-app/releases/erp-mobile-1.0.5-build6.ipa` | Development signing; local only (not in git) |
| Mac build fix | `android/gradle.properties` | Commented Windows-only `org.gradle.java.home` for Mac `gradlew` |

Log: [`erp-mobile-app/releases/APK_UPDATE.md`](../../erp-mobile-app/releases/APK_UPDATE.md) (build 6 entry).

---

## 6. Verification done in dev

| Check | Result |
|-------|--------|
| `npm run typecheck` (erp-mobile-app) | Pass |
| `npm run cap:sync:ios:prod` | Pass |
| `npm run cap:sync:android:prod` | Pass |
| On-device Scan + Settings layout | **Pending office** (see remaining tasks doc) |

---

## 7. Files touched (code — for commit)

```
erp-mobile-app/src/utils/branchId.ts                          (new)
erp-mobile-app/src/components/sales/AddProducts.tsx
erp-mobile-app/src/components/settings/settingsUi.tsx         (new)
erp-mobile-app/src/components/settings/SettingsCounterSection.tsx (new)
erp-mobile-app/src/components/settings/SettingsPrinterSection.tsx (new)
erp-mobile-app/src/components/settings/SettingsModule.tsx
erp-mobile-app/src/components/accounts/ExpenseEntryFlow.tsx
erp-mobile-app/src/components/shared/MobilePaymentSheet.tsx
erp-mobile-app/src/api/accounts.ts, expenses.ts, purchases.ts, rentals.ts, sales.ts
erp-mobile-app/android/gradle.properties
erp-mobile-app/releases/APK_UPDATE.md
```

---

## 8. Out of scope today

- UIScene / `SceneDelegate` Xcode warning (cosmetic)
- `BarcodeCameraModal` auto-native on open (optional hardening; low priority)
- Signed **release** APK upload to GitHub Releases (office task)

---

**Handoff:** [`2026-05-21-REMAINING_TASKS.md`](2026-05-21-REMAINING_TASKS.md)
