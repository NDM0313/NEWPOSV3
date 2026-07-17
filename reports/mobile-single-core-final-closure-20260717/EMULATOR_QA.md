# EMULATOR_QA.md

Generated: 2026-07-17 (operational gates re-run)

**Result:** `EMULATOR_QA_FAIL`

## Environment

| Item | Value |
|------|--------|
| AVD | Medium_Phone_API_36.1 |
| Serial | emulator-5554 |
| Product APK | `erp-mobile-app/android/app/build/outputs/apk/debug/app-debug.apk` |
| APK SHA-256 | `d15114fc2a53c735c8004f06267568fc33ecc6575aa8cb798fe9f4c88b57f440` |
| Source commit | `93cd8436087869f9d839f1c5650626d047a33a98` |
| App | 1.0.5 / versionCode 39 |

## Stabilization attempts (this run)

1. `adb kill-server` / `adb start-server` — devices briefly healthy (`boot_completed=1`, display 1080x2400).
2. `adb install -r` / `am start` / screencap — **ADB shell hung** (timeouts).
3. Cold kill AVD + relaunch with `-gpu swiftshader_indirect` — emulator stayed **`offline`** for >3 minutes; `getprop sys.boot_completed` failed repeatedly (`adb: device offline`).
4. CDP / WS automation **not reached** — no stable device shell / WebView process.

## Failure classification

| Layer | Verdict |
|-------|---------|
| App-code failure | **Not proven** — no authenticated session; no FATAL crash evidence this run |
| Android/AVD failure | **YES** — device offline / ADB shell hang / black-screen history |
| WebView automation failure | Secondary — blocked by AVD/ADB instability |

## Authenticated matrix

**Not completed** (Customer/Supplier/Worker/Account/Ledger V2/Roznamcha/Cash Flow/Trial Balance).

## Required behavioural checks

Company/branch switch, logout, resume, network failure, Retry — **not executed**.

## Supplementary (not APK PASS)

Prior mobile-web same-bundle QA remains **9/9 PASS** — does **not** equal `EMULATOR_QA_PASS`.
