# Admin role QA — MOBILE APK DEVICE QA RESUME

**Generated:** 2026-07-01  
**Status:** UI QA PENDING — operator unlock required

## Install / launch

- Debug APK installed on Pixel 6 Pro after signature-mismatch fix (**PASS**)
- App process launches without fatal crash (**PASS**)

## On-device Admin checklist

All 16 read-only UI checks **NOT VERIFIED** in this run — device remained locked; Capacitor WebView UI is not automatable via adb without unlock + operator navigation.

## Golden reference (verify manually after unlock)

| Company | BS Assets | P&L Net |
|---------|-----------|---------|
| DIN CHINA | 89,754,087.52 | 8,465,730.87 |
| DIN BRIDAL | 13,521,792 | 119,992 |
| DIN COUTURE | 22,667,273 | -16,750 |

**Filters to match:** as-of `2026-07-01`, P&L `2026-01-01`–`2026-07-01`, basis `official_gl`, all branches.

## Production proxy (read-only web monitoring)

Pre-QA three-company monitoring **PASS** with company admin logins — same backend/RPC path mobile uses.

**Operator:** Unlock device → login as Admin → complete checklist in `reports/mobile-apk-internal-qa-build-20260701/device-qa-checklist.md`.
