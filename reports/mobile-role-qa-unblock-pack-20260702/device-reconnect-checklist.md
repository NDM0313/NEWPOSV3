# Device reconnect checklist — Pixel 6 Pro

**Target device:** Google Pixel 6 Pro (prior Admin QA PASS 21/21)  
**Expected package:** `com.dincouture.erp` v1.0.5 (39)

## Checklist

1. Connect Pixel 6 Pro via **USB data cable** (not charge-only).
2. **Unlock** phone screen.
3. Set USB mode to **File transfer / MTP** if prompted.
4. **Developer Options** enabled (Settings → About → tap Build number 7×).
5. **USB debugging** enabled (Developer options).
6. If stuck on `unauthorized`: **Revoke USB debugging authorizations** → disconnect → reconnect.
7. Accept **RSA fingerprint** prompt on phone (“Allow USB debugging?”).
8. On office PC run:
   ```bash
   adb kill-server
   adb start-server
   adb devices
   ```
9. **Expected:** serial listed as `device` (not `unauthorized` / `offline`).

## After device connects

```bash
adb shell getprop ro.product.model
adb shell getprop ro.build.version.release
adb shell pm list packages | findstr dincouture
adb shell dumpsys package com.dincouture.erp | findstr /I "versionName versionCode firstInstallTime lastUpdateTime"
```

No reinstall unless APK missing or version mismatch. No Play Store upload.
