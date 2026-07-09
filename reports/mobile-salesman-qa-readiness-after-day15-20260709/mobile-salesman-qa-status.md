# Mobile Salesman QA Readiness — After Day 15

**Date:** 2026-07-09 (updated office session)  
**Status:** `BLOCKED_SALESMAN_DEVICE_QA_PENDING`

## Office Windows (2026-07-09)

| Item | Result |
|------|--------|
| Machine | Office Windows |
| ADB | installed (platform-tools 36.0.0) |
| `adb devices` | empty |
| Pixel 6 Pro | not connected |
| Status | `ADB_INSTALLED_DEVICE_NOT_CONNECTED` |
| Evidence | [`office-adb-status.md`](office-adb-status.md) |

## Home Mac (prior session)

**Machine:** Home Mac  
**Status:** `ADB_INSTALLED_DEVICE_NOT_CONNECTED`

## ADB setup

```bash
brew install android-platform-tools
which adb
adb version
adb kill-server && adb start-server
adb devices
```

| Check | Result |
|-------|--------|
| ADB installed | **yes** (`/usr/local/bin/adb`) |
| ADB version | Android Debug Bridge version 1.0.41 / platform-tools 37.0.0-14910828 |
| Device list | *(empty — no devices attached)* |
| Pixel 6 Pro | **not connected** |

## Salesman QA

| Item | Status |
|------|--------|
| Password requested | no (device gate blocks QA) |
| Password value recorded | **no** |
| QA run | **no** |
| QA result | blocked — `ADB_INSTALLED_DEVICE_NOT_CONNECTED` |
| Documented procedure | `reports/mobile-manager-salesman-device-qa-20260702/salesman-role-qa.md`, `docs/mobile_phase3_device_qa_runbook.md` |

## Role QA matrix

| Role | Status |
|------|--------|
| Admin | PASS 21/21 (prior evidence) |
| Manager | N/A / waived |
| Salesman | **ADB_INSTALLED_DEVICE_NOT_CONNECTED** |
| Play Store | **NOT RELEASED** |

## Operator next steps

1. Connect Pixel 6 Pro via USB
2. Enable Developer options → USB debugging
3. Approve “Allow USB debugging” on phone
4. Re-run `adb devices` — expect one line with status `device`
5. Provide Salesman password **shell-only** at QA time (never commit or log)
6. Run documented Salesman QA checklist

## Safety

- R8: not run
- DB migrations: not run
- Repairs: not run
- Production GL/data mutation: no
- APK/AAB uploaded: no
- Play Store submission: no
- Passwords stored in this report: no
