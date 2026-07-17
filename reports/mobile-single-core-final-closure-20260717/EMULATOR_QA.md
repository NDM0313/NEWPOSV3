# EMULATOR_QA.md

Generated: 2026-07-17 (resource gates — one clean AVD attempt)

**Result:** `EMULATOR_QA_FAIL`

## Health proof (partial)

| Check | Result |
|-------|--------|
| Stop old AVD / restart ADB | Done |
| One AVD only | Medium_Phone_API_36.1 |
| `sys.boot_completed=1` | Eventually **PASS** |
| Repeated `adb shell echo` | **PASS** (3/3 briefly) |
| Package installed | **PASS** — `com.dincouture.erp` versionName 1.0.5 / versionCode 39 |
| App process | Briefly alive (`pidof` returned) then unstable |
| Non-black screen | **Not proven** — screencap timed out |
| WebView/CDP socket | **FAIL** — no `webview_devtools_remote_*` |
| `adb install -r` | **TIMEOUT** |
| `am start -W` | **TIMEOUT** |

## Authenticated matrix

**Not completed** — environment degraded before login/report navigation.

## Failure classification

| Layer | Verdict |
|-------|---------|
| Application failure | **Not proven** |
| WebView automation failure | Secondary (no CDP target) |
| ADB failure | **YES** — install/screencap/start hangs |
| AVD/display failure | **YES** — unreliable after boot |

APK SHA (host file): `d15114fc2a53c735c8004f06267568fc33ecc6575aa8cb798fe9f4c88b57f440`  
Product commit: `93cd8436087869f9d839f1c5650626d047a33a98`
