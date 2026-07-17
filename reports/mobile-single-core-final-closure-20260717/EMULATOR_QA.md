# EMULATOR_QA.md

Generated: 2026-07-17 (final closure)

**Result:** `EMULATOR_QA_FAIL`

## Environment

| Item | Value |
|------|--------|
| AVD | Medium_Phone_API_36.1 / emulator-5554 |
| API | 36 |
| boot_completed | 1 (intermittent) |
| APK install | Success (versionName 1.0.5 / versionCode 39) |
| APK SHA | `d15114fc2a53c735c8004f06267568fc33ecc6575aa8cb798fe9f4c88b57f440` |
| Source commit | `93cd8436087869f9d839f1c5650626d047a33a98` |

## Attempts

1. **Playwright `connectOverCDP` (browser endpoint)** — FAIL: `Browser context management is not supported` on WebView.
2. **WS page-level CDP script** (`mobile-single-core-emulator-ws-cdp-qa.mjs`) — FAIL: no CDP page target / app process not sustained.
3. **Manual launch + screencap** — black screen (`emu-manual-launch.png`); `pidof com.dincouture.erp` empty; no `webview_devtools_remote_*` socket.

## Classification

| Layer | Result |
|-------|--------|
| App code crash | No FATAL/AndroidRuntime crash lines in sampled logcat |
| WebView automation | FAIL — CDP socket unavailable when process absent |
| Emulator environment | FAIL — unstable AVD (black screen, adb shell hangs, duplicate emulator instances earlier) |

## Authenticated matrix

**Not completed** — login through report navigation blocked by environment.

## Supplementary (not APK PASS)

Mobile-web same-bundle QA (prior acceptance): **9/9 PASS** on port 5175.
