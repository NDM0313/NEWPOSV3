# Office Pixel + Salesman QA Session — 2026-07-09

**Device:** Pixel 6 Pro (`24281FDEE0023P`, Android 16)  
**Status:** `BLOCKED_SALESMAN_PASSWORD_PENDING` (device gate **PASS**)

## ADB / device gate

| Check | Result |
|-------|--------|
| `adb devices` | `24281FDEE0023P device` |
| Model | Pixel 6 Pro |
| Android | 16 |
| Battery | 72% |
| USB authorized | **yes** |

## APK state

| Field | Value |
|-------|--------|
| Package | `com.dincouture.erp` |
| versionName | `1.0.5` |
| versionCode | `39` |
| Install | already present (prior internal QA) |
| Launch smoke | **PASS** — process running, no FATAL in logcat |

## Salesman QA checklist

| Item | Status |
|------|--------|
| Password env (`SALESMAN_QA_PASSWORD`) | **not set** (operator manual login on device) |
| Login smoke | **operator manual** — device unlocked; app launched |
| Scoping / restriction checks | **pending operator manual attestation** |
| Full device checklist | **pending** — see `device-qa-checklist.md` |

**Operator choice (2026-07-09):** Login on Pixel manually; agent records device gate PASS only until checklist attested.

## Safety

- Manager user created: **no**
- Manager QA: N/A / waived
- Play Store: NOT RELEASED
- Password recorded in this report: **no**
- Debug screenshots committed: **no**
