# ERP Mobile App — Remaining Tasks

Last updated: 2026-05-23  
Current target build: `erp-mobile-1.0.5-build7-debug.apk`

**Office checklist (authoritative):** [`docs/mobile/2026-05-21-REMAINING_TASKS.md`](../../docs/mobile/2026-05-21-REMAINING_TASKS.md)  
**Release log:** [`releases/APK_UPDATE.md`](../releases/APK_UPDATE.md)

---

## P0 — Must verify on physical device (build 7)

| Task | Owner | Notes |
|------|-------|-------|
| Install build 7 on Sunmi/tablet | User | Uninstall old app first; install `releases/erp-mobile-1.0.5-build7-debug.apk` |
| Confirm cold boot → login screen | User | Not plain blue; splash ~2s then UI |
| Sales → Add Items → Scan | User | Native camera (Settings → Printer & barcode → **Camera**) |
| All Branches payment | User | No `uuid: "all"` toast |
| Settings accordions | User | Counter + Printer sections expand and save OK |
| If scan/boot fails: logcat | User / Dev | `adb logcat \| findstr /i "mlkit barcode chromium capacitor ERP Failed"` |

APK built on Windows 2026-05-23 (~30 MB). No device was connected via `adb` during build — **office install required**.

---

## P1 — Release & distribution

| Task | Status |
|------|--------|
| GitHub source push | Done (`689e0a3` on `main`) |
| `APK_UPDATE.md` build 7 block | Done |
| Upload APK to GitHub Release | Optional — tag `mobile-v1.0.5-build7`; attach local APK (`gh` not on build machine) |
| Share install path with tablets | `erp-mobile-app/releases/erp-mobile-1.0.5-build7-debug.apk` |

---

## P2 — After debug tests pass

| Task | Notes |
|------|-------|
| Signed release build 7 | `npm run android:apk:release:win` from `erp-mobile-app` |
| Archive old debug APKs locally | Keep build2 (reference) + latest build7 |

---

## Done when

1. Build 7 installed on at least one Sunmi + one phone.
2. Native barcode scan works on Add Products.
3. Settings accordions + branch `all` UUID fix verified.
4. Team has install path in `APK_UPDATE.md`.
