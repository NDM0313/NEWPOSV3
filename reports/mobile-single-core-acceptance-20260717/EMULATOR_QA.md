# EMULATOR_QA.md

Generated: 2026-07-17T12:30:00.000Z

**Result:** `EMULATOR_QA_FAIL` (install/launch verified earlier; authenticated APK matrix blocked)

| Item | Value |
|------|--------|
| AVD | `Medium_Phone_API_36.1` / `emulator-5554` |
| Model | sdk_gphone64_x86_64 |
| App | 1.0.5 / versionCode 39 |
| APK SHA-256 | `d15114fc2a53c735c8004f06267568fc33ecc6575aa8cb798fe9f4c88b57f440` |
| Source commit | `93cd8436087869f9d839f1c5650626d047a33a98` |
| Install | `adb install -r` → Success (earlier session) |
| Launch | Login UI renders (`emulator-after-wait.png`) |

## Scenario matrix

| # | Scenario | Result | Note |
|---|----------|--------|------|
| 1 | Login screen | PASS | UI renders |
| 2 | Company selection | NOT COMPLETED | WebView opaque to UiAutomator |
| 3 | Branch selection | NOT COMPLETED | — |
| 4–11 | Report loaders | NOT COMPLETED on APK | adb coordinate taps unreliable |
| 12–24 | Cache / retry / rotation | NOT COMPLETED | — |

**Blocker:** Capacitor WebView does not expose fields to UiAutomator; adb `input text` hangs or misses React controlled inputs. `adb` became unresponsive during late acceptance re-run.

## Supplementary (same bundle)

Authenticated flows verified via **mobile web QA** on port 5175 — see `MOBILE_WEB_QA.md` (8/9 PASS; Worker empty list expected for DIN CHINA).

Screenshots: `emulator-launch.png`, `emulator-after-wait.png`, `emulator-after-login-attempt.png`
