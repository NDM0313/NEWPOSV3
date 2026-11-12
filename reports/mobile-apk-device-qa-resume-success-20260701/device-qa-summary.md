# Device QA summary — MOBILE APK DEVICE QA RESUME

**Generated:** 2026-07-01  
**Classification:** **BLOCKED_DEVICE_QA**

## Resolved

- Prior `INSTALL_FAILED_UPDATE_INCOMPATIBLE` — fixed by uninstalling release-signed app and installing debug internal QA APK.

## Completed this run

| Item | Result |
|------|--------|
| APK installed (Pixel 6 Pro) | **yes** |
| App launches / no fatal crash | **yes** |
| Device network to ERP backend | **yes** |
| Pre-QA web monitoring | **PASS** |
| Production mutations | **none** |

## Blocked / pending

| Item | Status |
|------|--------|
| Admin on-device UI + goldens | **PENDING** — unlock device + operator navigation |
| Manager QA | **PENDING CREDENTIALS** |
| Salesman QA | **PENDING CREDENTIALS** |
| Golden totals on device | **NOT VERIFIED** |

## Why not PASS

Capacitor WebView UI cannot be driven via adb while device is locked. Admin report navigation and golden total verification require operator to unlock Pixel and complete checklist manually.
