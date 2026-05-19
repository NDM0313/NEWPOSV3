# Phase 3 — Device / emulator WebView QA runbook

Use this checklist on a **debug-signed** APK (see [ANDROID_DEBUG_WEBVIEW_SSL.md](infra/ANDROID_DEBUG_WEBVIEW_SSL.md)) so [`DebugSslWebViewClient.java`](../erp-mobile-app/android/app/src/main/java/com/dincouture/erp/DebugSslWebViewClient.java) matches your install.

**Target:** Google Pixel 6 Pro or Android Emulator with Google Play / appropriate WebView.

## Preconditions

- [ ] Debug APK built from current `main` (`erp-mobile-app/android/app/build/outputs/apk/debug/app-debug.apk` or your CI path).
- [ ] Device/emulator time and network OK; can reach Supabase and app backend.

## Cold start and WebView

- [ ] **Cold start:** Force-stop app → launch → login or PIN path loads without blank WebView.
- [ ] **Reload:** From in-app dev tools or OS app switcher, return to app; WebView still loads ERP shell.
- [ ] **SSL:** No certificate errors on your staging/prod URL (debug client only relaxes checks in **debug** builds per doc above).

## OAuth return

- [ ] **Google sign-in:** Start OAuth from [`LoginScreen`](../erp-mobile-app/src/components/LoginScreen.tsx) flow → external browser → deep link return → session established (no stuck spinner).

## OTP / wizard (Phase 2 overlap)

- [ ] **Create business wizard:** Reach OTP step if email confirmation required → enter code / resend countdown behaves.
- [ ] **Post-wizard:** Lands in PIN / branch flow as expected.

## Offline autosync (Phase 3)

- [ ] **Offline write:** Airplane mode on → create offline-tolerant action (e.g. expense or sale per your test data) → queue shows pending in **Settings → Developer Tools** ([`DeveloperToolsSection.tsx`](../erp-mobile-app/src/components/settings/DeveloperToolsSection.tsx)).
- [ ] **Reconnect:** Airplane off → queue drains to synced; `erp_mobile_last_autosync_at` updates (DevTools shows last auto-sync).

## Counter PIN switch

- [ ] **Enroll** secondary PIN (Settings) → **Switch user** from POS/Expense header → `auth` user id / permissions match expected account.

## Sign-off

| Date       | Device / emulator        | Tester | Notes |
|------------|----------------------------|--------|-------|
| *(fill)*  | e.g. Pixel 6 Pro / API 34  |        |       |

When the table is filled and all boxes above are checked, mark **Device QA executed** in [`mobile_phase3_pin_offline.plan.md`](mobile_phase3_pin_offline.plan.md).
