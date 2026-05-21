# ERP Mobile App — Completed Tasks

Last updated: 2026-05-21  
Latest release APK: `releases/erp-mobile-1.0.4-build5.apk` (version 1.0.4, versionCode 5)

This document lists work completed for the Capacitor Android app (`erp-mobile-app/`) during the blank/blue boot screen and related mobile hardening effort.

---

## 1. Release build pipeline (Windows)

| Task | Status | Notes |
|------|--------|-------|
| JDK 17 pin for Gradle | Done | `scripts/ensure-gradle-jdk17.mjs`, `gradle.properties` |
| Production env sync from local | Done | `scripts/sync-env-production-from-local.mjs` |
| Demo anon key guard | Done | `scripts/verify-mobile-build-env.mjs` |
| Dist integrity check before cap sync | Done | `scripts/verify-dist-for-capacitor.mjs` |
| Release APK copy to `releases/` | Done | `scripts/copy-release-apk.mjs` |
| One-command release build | Done | `npm run android:apk:release:win` |
| Windows APK script | Done | `scripts/build-apk-windows.ps1` (+ env sync on `-Production`) |

---

## 2. Blank / blue boot screen fixes

| Task | Status | Files |
|------|--------|-------|
| Boot React Error Boundary | Done | `src/components/BootErrorBoundary.tsx` |
| Safe `createRoot` + DOM fallback | Done | `src/main.tsx` |
| Service worker disabled on native | Done | `src/main.tsx` |
| Auth bootstrap `try/finally` + 10s timeout | Done | `src/App.tsx` |
| Safe counter vault reads | Done | `src/lib/counterUserVault.ts` |
| `safeShouldActivateCounterLockScreen` | Done | `src/lib/sharedCounterMode.ts` |
| Counter lock boot race fix | Done | `src/App.tsx` |
| Vault list `.catch` on lock/login UI | Done | `POSLockScreen.tsx`, `CounterLoginPanel.tsx` |

---

## 3. Physical device WebView compatibility (build 5)

| Task | Status | Notes |
|------|--------|-------|
| Relative asset base `./` for Capacitor prod | Done | `vite.config.ts` + `VITE_TARGET=capacitor` in `.env.production` |
| `inlineDynamicImports: true` (single JS bundle) | Done | ~2.37 MB main bundle, 2 asset files |
| `modulePreload: false` on Capacitor | Done | Avoids bad chunk prefetch on device |
| WebView transpile targets | Done | `es2015`, `chrome87`, `safari13`, `edge88` |
| ES5-safe pre-React boot watchdog | Done | `index.html` |
| Module script moved after watchdog | Done | Vite `bootScriptOnErrorPlugin` |
| Fail build on absolute `/assets/` paths | Done | `verify-dist-for-capacitor.mjs` |
| Splash auto-hide (2s) | Done | `capacitor.config.ts` |

---

## 4. Counter tablet — company-scoped users

| Task | Status | Notes |
|------|--------|-------|
| `companyId` on counter vault rows | Done | `counterUserVault.ts` |
| Filter lock screen by active company | Done | `POSLockScreen`, `CounterLoginPanel` |
| `setLastCounterCompanyId` cold boot | Done | `sharedCounterMode.ts`, `App.tsx` |
| Wrong-company PIN message | Done | `COUNTER_WRONG_COMPANY_MESSAGE` |
| Deferred network backfill until session | Done | Avoids boot-time vault blocking |

---

## 5. Native printing (Android)

| Task | Status | Notes |
|------|--------|-------|
| `ErpPrinterPlugin.java` (Sunmi + Bluetooth) | Done | Native plugin |
| `erpPrinterNative.ts` bridge | Done | Lazy legacy bridge registration |
| `printService.ts` unified print | Done | Sunmi → Bluetooth → browser |
| Settings printer UI + test print | Done | `SettingsModule.tsx` |
| Auto-print after Sale / POS | Done | `printAfterTransaction.ts` |
| Product barcode labels | Done | `PrintBarcodeLabelModal.tsx`, `barcodeLabelPrint.ts` |
| Register plugin in `MainActivity` | Done | `onCreate` |

---

## 6. Android native config (verified intact)

| Item | Status |
|------|--------|
| `usesCleartextTraffic="true"` | Present |
| `network_security_config.xml` | Present |
| `DebugSslWebViewClient` (debug only) | Present |
| No `server.url` in Capacitor config | Verified |
| Production Supabase URL `https://erp.dincouture.pk` | Baked via `.env.production` |

---

## 7. APK builds shipped locally

| Build | APK | Device result (reported) |
|-------|-----|--------------------------|
| 1.0.1 build 2 | `erp-mobile-1.0.1-build2.apk` | Works on physical device |
| 1.0.3 build 4 | `erp-mobile-1.0.3-build4.apk` | Blank/blue on device; OK on emulator |
| 1.0.4 build 5 | `erp-mobile-1.0.4-build5.apk` | **Pending user retest** after relative paths + single bundle |

---

## 8. Database / auth (not changed — per lockdown)

- No new migrations applied as part of this mobile-only work.
- Mobile anon key / URL pattern unchanged from [`docs/infra/MOBILE_APK_LOCKED_PATTERN.md`](../docs/infra/MOBILE_APK_LOCKED_PATTERN.md).

---

## Related docs

- [`releases/APK_UPDATE.md`](../releases/APK_UPDATE.md) — per-build changelog
- [`CAPACITOR.md`](../CAPACITOR.md) — dev sync commands
- [`android/README_BUILD.md`](../android/README_BUILD.md) — Gradle / APK paths
