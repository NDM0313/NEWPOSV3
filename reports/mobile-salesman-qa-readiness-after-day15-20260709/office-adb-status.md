# Office ADB / Pixel Status

**Date:** 2026-07-09  
**Machine:** Office Windows  
**Status:** `ADB_INSTALLED_DEVICE_NOT_CONNECTED`

## Check performed

```powershell
adb kill-server
adb start-server
adb devices
adb version
```

| Check | Result |
|-------|--------|
| ADB installed | **yes** |
| ADB version | Android Debug Bridge 1.0.41 / platform-tools 36.0.0-13206524 |
| Device list | **empty** — no devices attached |
| Pixel 6 Pro | **not connected** |

## Action needed

1. Connect Pixel 6 Pro via USB
2. Enable Developer options → USB debugging
3. Approve “Allow USB debugging” on phone
4. Re-run `adb devices` — expect one line with status `device`
5. Provide Salesman password **shell-only** at QA time (never commit or log)

## Safety

- No passwords stored in this report
- No APK/AAB built or uploaded
- Play Store: NOT RELEASED
