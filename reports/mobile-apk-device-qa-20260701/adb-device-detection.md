# ADB device detection — MOBILE APK DEVICE QA

**Generated:** 2026-07-01  
**Status:** DEVICE_QA_BLOCKED_NO_ADB_DEVICE

## Result

`adb devices` returned **no connected devices**.

```
List of devices attached

```

On-device QA cannot proceed without a physical/emulated Android device reachable via adb.

## Manual install steps (when device available)

1. Enable **Developer options** and **USB debugging** on the Android test device.
2. Connect device via USB; accept the debugging authorization prompt on the device.
3. Verify connection:
   ```bash
   adb devices
   ```
4. Install internal debug APK:
   ```bash
   adb install -r erp-mobile-app/releases/internal-qa/20260701/dincouture-erp-internal-qa-20260701-debug.apk
   ```
5. Launch **Din Collection ERP** from the app drawer and complete the role QA checklists in `reports/mobile-apk-internal-qa-build-20260701/device-qa-checklist.md`.

**Do not** upload APK to Play Store or distribute publicly without separate operator approval.
