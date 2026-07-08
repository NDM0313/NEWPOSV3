# Mobile Salesman QA Readiness — After Day 15

**Date:** 2026-07-09  
**Machine:** Home Mac (continuation)  
**Status:** `ADB_NOT_INSTALLED`

## Check performed

```bash
which adb
adb version
adb devices
```

**Result:** `adb not found` — Android platform-tools not installed on home Mac.

| Requirement | Status |
|-------------|--------|
| ADB installed | **no** (`ADB_NOT_INSTALLED`) |
| Pixel 6 Pro connected | not checked (adb unavailable) |
| ADB authorized | not available |
| Salesman password | not requested (adb gate blocks QA) |

See also: [`home-adb-status.md`](home-adb-status.md)

## Role QA matrix

| Role | Status |
|------|--------|
| Admin | PASS 21/21 (prior evidence) |
| Manager | N/A / waived |
| Salesman | **ADB_NOT_INSTALLED** → QA blocked |
| Play Store | **NOT RELEASED** |

## Next steps (operator)

1. Install Android platform-tools (`brew install android-platform-tools` or SDK platform-tools)
2. Connect Pixel 6 Pro via USB; enable USB debugging; authorize host
3. Re-run `adb devices` — expect one `device` line
4. Provide Salesman password **shell-only** at QA time (never commit or log)
5. Execute documented Salesman QA checklist from mobile QA reports

## Safety

- No APK/AAB built or uploaded
- No Play Store submission
- No passwords stored in this report
