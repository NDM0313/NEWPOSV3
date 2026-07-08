# Mobile Salesman QA Readiness — After Day 15

**Date:** 2026-07-09  
**Status:** `BLOCKED_SALESMAN_DEVICE_QA_PENDING`

## Check performed

```bash
adb devices
```

**Result:** `adb: command not found` on operator Mac shell used for this closeout.

| Requirement | Status |
|-------------|--------|
| Pixel 6 Pro connected | not detected |
| ADB authorized | not available |
| Salesman password | not requested (device gate blocks QA) |

## Role QA matrix

| Role | Status |
|------|--------|
| Admin | PASS 21/21 (prior evidence) |
| Manager | N/A / waived |
| Salesman | **BLOCKED_SALESMAN_DEVICE_QA_PENDING** |
| Play Store | **NOT RELEASED** |

## Next steps (operator)

1. Install Android platform-tools / ensure `adb` on PATH
2. Connect Pixel 6 Pro via USB; enable USB debugging; authorize host
3. Re-run `adb devices` — expect one `device` line
4. Provide Salesman password **shell-only** at QA time (never commit or log)
5. Execute documented Salesman QA checklist from mobile QA reports

## Safety

- No APK/AAB built or uploaded
- No Play Store submission
- No passwords stored in this report
