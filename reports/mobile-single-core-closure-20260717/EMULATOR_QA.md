# EMULATOR_QA.md

Generated: 2026-07-17 (closure)

**Result:** `EMULATOR_QA_FAIL`

## Device identity

| Item | Value |
|------|--------|
| AVD | Medium_Phone_API_36.1 |
| Serial (prior session) | emulator-5554 |
| Model | sdk_gphone64_x86_64 |
| API | 36 |
| App | 1.0.5 / versionCode 39 |
| Source commit | `93cd8436087869f9d839f1c5650626d047a33a98` |
| APK SHA-256 | `d15114fc2a53c735c8004f06267568fc33ecc6575aa8cb798fe9f4c88b57f440` |

## What succeeded (this closure + prior acceptance)

| Step | Result |
|------|--------|
| 1 Install current APK | **PASS** (`adb install -r` Success; versionName/versionCode confirmed on device) |
| 2 Verify SHA/source | **PASS** |
| 3 Open app / login UI (prior acceptance) | **PASS** — login screen screenshots under acceptance report |
| WebView CDP discovery (prior) | **PASS** — `webview_devtools_remote_*` + Chrome/134 targets listed |

## What failed / incomplete

| Step | Result | Note |
|------|--------|------|
| 4–26 Authenticated APK report matrix | **FAIL / incomplete** | Closure re-run: after reinstall, `pidof` empty (process exits), adb shell/screencap hangs; cold reboot attempts left AVD unstable / no device online long enough for CDP login matrix |

Preferred CDP automation script is ready: `scripts/mobile-single-core-emulator-cdp-qa.mjs` (Playwright `connectOverCDP` to WebView DevTools).

## Supplementary (does **not** equal APK emulator PASS)

Mobile-web same React bundle QA (:5175): **9/9 PASS** — see prior `reports/mobile-single-core-acceptance-20260717/MOBILE_WEB_QA.md`.
