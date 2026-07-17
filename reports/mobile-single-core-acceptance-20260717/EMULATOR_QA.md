# EMULATOR_QA.md

**Result:** `EMULATOR_QA_FAIL` (install/launch succeeded; authenticated report matrix incomplete)

| Item | Value |
|------|--------|
| AVD | Medium_Phone_API_36.1 |
| Device | emulator-5554 |
| App | 1.0.5 / versionCode 39 |
| APK SHA-256 | d15114fc2a53c735c8004f06267568fc33ecc6575aa8cb798fe9f4c88b57f440 |
| Source commit | 93cd8436087869f9d839f1c5650626d047a33a98 |
| Install | `adb install -r` → Success |
| Launch | MainActivity resumed; login UI rendered |
| Screenshots | `emulator-launch.png`, `emulator-after-wait.png`, `emulator-after-login-attempt.png` |

### Scenario coverage
1–3 Login UI: **PASS** (screen shown; credential entry via adb/WebView taps failed validation — WebView not exposed to UiAutomator)  
4–24 Authenticated report checklist: **NOT COMPLETED** on emulator (automation blocked by opaque WebView)

Capacitor log: App resume + network wifi connected; no FATAL crash in sampled logcat.
