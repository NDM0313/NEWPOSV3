# ERP Mobile App — Remaining Tasks

Last updated: 2026-05-21  
Current target build: `erp-mobile-1.0.4-build5.apk`

Work still open after the boot-screen and build-pipeline fixes. Prioritize items marked **P0**.

---

## P0 — Must verify on physical device

| Task | Owner | Notes |
|------|-------|-------|
| Install build 5 on Sunmi/tablet | User | Uninstall old app first; install `releases/erp-mobile-1.0.4-build5.apk` |
| Confirm cold boot → login screen | User | Not plain blue; splash ~2s then UI |
| If still blue: capture logcat | User / Dev | `adb logcat \| findstr /i "chromium capacitor ERP Failed"` |
| Confirm counter lock shows **company-scoped** users only | User | After login with enrolled counter PINs |

---

## P1 — Release & distribution

| Task | Notes |
|------|-------|
| Upload APK to GitHub Release | Tag e.g. `mobile-v1.0.4-build5`; attach `erp-mobile-1.0.4-build5.apk` (APK is gitignored — upload manually or via `gh release create`) |
| Update `releases/APK_UPDATE.md` git commit SHA | After push |
| Share install link with counter tablets | Internal distribution |

---

## P2 — If build 5 still fails on device

| Task | Notes |
|------|-------|
| Analyze logcat for asset 404 / JS syntax errors | Look for `/assets/` vs `./assets/` |
| Try `androidScheme: 'https'` in Capacitor (if capacitor:// resolution fails) | Requires config test + new build |
| Revert `React.lazy` to eager imports only if inlining insufficient | Currently inlined at build time |
| Test on oldest WebView device in fleet | Record Android version + WebView package version |

---

## P3 — Product / features (not blocking boot)

| Task | Notes |
|------|-------|
| iOS build + TestFlight (if needed) | `cap sync ios` — Mac required |
| GitHub Actions CI for `android:apk:release:win` | Optional automation |
| Reduce main bundle size below 2 MB | Code-split non-boot routes only if device boot is stable |
| Printer field testing on Sunmi hardware | Sunmi built-in + Bluetooth ESC/POS |
| RLS migration `20260521170000_settings_mobile_printer_barcode_auth_user_id.sql` | Apply on VPS if not already applied |

---

## P4 — Documentation / cleanup

| Task | Notes |
|------|-------|
| Remove or archive old failed APKs from `releases/` locally | Keep build2 (known good) + build5 |
| Add device WebView version to support matrix | Sunmi model + Android API level |
| Document `adb` troubleshooting in `android/README_BUILD.md` | Link from this file |

---

## Done when

1. Physical device cold boot shows login (or boot fallback with Reload), **not** endless blue.
2. Counter company filter works on lock screen.
3. GitHub has source push + optional Release with build5 APK.
4. Team has install instructions in [`MOBILE_APP_COMPLETED_TASKS.md`](MOBILE_APP_COMPLETED_TASKS.md) and [`releases/APK_UPDATE.md`](../releases/APK_UPDATE.md).

---

## Quick retest checklist (build 5)

```text
[ ] Uninstall previous ERP Mobile
[ ] Install erp-mobile-1.0.4-build5.apk
[ ] Cold boot → login within ~15s
[ ] Email login works
[ ] Counter lock (if enrolled) shows only same-company users
[ ] Open POS / Sales once (smoke test)
```
