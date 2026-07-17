# EMULATOR_QA.md

Generated: 2026-07-17 (decision-gate run — single attempt after health probe)

**Result:** `EMULATOR_QA_FAIL`  
**Also recorded:** `EMULATOR_ENVIRONMENT_UNAVAILABLE` (system ANR on display)

## Infrastructure probe

| Check | Result |
|-------|--------|
| `boot_completed` | 1 |
| Repeated `adb shell echo` | 3/3 |
| Package process | Present |
| Screenshot | Captured — shows **"Process system isn't responding"** ANR (`emu-decision-health.png`) |
| APK install | Success (versionName 1.0.5 / versionCode 39) |
| CDP socket | Found once |

## Authenticated matrix

| Scenario | Result |
|----------|--------|
| Login | **FAIL** (stuck on Loading…) |
| Report navigation | Incomplete / unreliable after login failure |
| Critical | Login failed → overall **FAIL** |

Raw: `emulator-qa-raw.json`

## Failure classification

| Layer | Verdict |
|-------|---------|
| Application accounting defect | **Not proven** |
| WebView automation | Partial (CDP connected; login interaction unreliable) |
| ADB | Intermittent hangs historically |
| AVD/display | **YES** — system ANR dialog |

**No further CDP retries** per decision-gate policy.

Physical device remains the preferred primary native APK evidence when available.
