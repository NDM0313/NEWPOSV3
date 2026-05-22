# ERP Mobile — Remaining tasks (office / APK)

**Date:** 2026-05-21  
**For:** Tomorrow office — complete testing + **new APK** with today's code  
**Prerequisite:** Pull latest `main` after GitHub push (barcode + Settings + branch UUID fixes)

**Completed work reference:** [`2026-05-21-TODAY_WORK_SUMMARY.md`](2026-05-21-TODAY_WORK_SUMMARY.md)

---

## P0 — Must do first (APK for tablets)

### A. Pull & sync native projects

```bash
cd erp-mobile-app
git pull origin main
npm ci
npm run typecheck
npm run cap:sync:android:prod
```

### B. Build new APK (build **7** recommended)

Today's **build 6** APK was built **before** barcode scan + Settings accordion fixes. Office tablets need a **fresh** build.

```bash
cd erp-mobile-app/android
./gradlew assembleDebug
# Output: android/app/build/outputs/apk/debug/app-debug.apk
cp app/build/outputs/apk/debug/app-debug.apk ../releases/erp-mobile-1.0.5-build7-debug.apk
```

Optional signed release (counter fleet):

```bash
cd erp-mobile-app
npm run android:apk:release:win   # Windows
# or Mac equivalent from android/README_BUILD.md
```

### C. Install on Sunmi / tablets

1. **Uninstall** old ERP Mobile (signature / WebView cache).
2. Install `releases/erp-mobile-1.0.5-build7-debug.apk` (or release APK).
3. `adb install -r releases/erp-mobile-1.0.5-build7-debug.apk` if using USB.

### D. Device test checklist (build 7+)

| # | Area | Steps | Pass? |
|---|------|--------|-------|
| 1 | **Branch "all"** | All Branches → record payment / expense | No `uuid: "all"` toast |
| 2 | **Barcode — Settings** | Settings → expand **Printer & barcode** → **Camera** | Saves OK |
| 3 | **Barcode — Scan** | Sales → Add Items → **Scan** | Native camera opens; EAN adds product (no browser error) |
| 4 | **Barcode — POS** | POS → Scan | Still works (regression) |
| 5 | **Settings layout** | Open Settings | Only **Account & branch** open; rest collapsed |
| 6 | **Settings — Counter** | Expand **Counter & lock screen** | PIN enroll, policy, shared toggle work |
| 7 | **Settings — Printer** | Expand **Printer & barcode** | Mode, test print, receipt toggles work |
| 8 | **Counter PIN** | Lock screen / PIN switch | After VPS deploy: one email login if vault expired |
| 9 | **Shipment** | Shipment & Cargo dates/status | Journal after dispatch (VPS migration live) |

---

## P1 — Release & documentation

| Task | Notes |
|------|--------|
| Update [`APK_UPDATE.md`](../../erp-mobile-app/releases/APK_UPDATE.md) | New top block: build **7**, git SHA, changelog: barcode native scan, Settings accordions, branch `all` UUID fix |
| Copy APK to shared drive / WhatsApp | Path: `erp-mobile-app/releases/erp-mobile-1.0.5-build7-debug.apk` |
| GitHub Release (optional) | `gh release create mobile-v1.0.5-build7 --notes-file docs/mobile/2026-05-21-TODAY_WORK_SUMMARY.md` + attach APK (APK is gitignored — upload manually) |
| iOS IPA (if needed) | `npm run cap:sync:ios:prod` → Xcode **NDM ERP** → Run on device |

---

## P2 — If barcode still fails on device

| Check | Action |
|-------|--------|
| Settings method | Must be **Camera** (not keyboard wedge only) |
| Camera permission | iOS Settings → app → Camera ON; Android permission prompt on first scan |
| Wrong build installed | Confirm build **7** includes commit with `useBarcodeScanner` in `AddProducts.tsx` |
| ML Kit missing | Re-run `cap:sync:android:prod`; confirm plugin in `android` Gradle sync |
| Logcat | `adb logcat \| grep -iE "mlkit|barcode|capacitor"` |

---

## P3 — Optional / low priority

| Task | Notes |
|------|--------|
| `BarcodeCameraModal` native delegate | On `open` + `Capacitor.isNativePlatform()` → call `scanBarcode()` (future callers safe) |
| Signed release APK for production fleet | Replace debug APK when tests pass |
| Archive old debug APKs locally | Keep build5 (reference) + latest only |
| Update [`MOBILE_APP_REMAINING_TASKS.md`](../../erp-mobile-app/docs/MOBILE_APP_REMAINING_TASKS.md) | Point to build 7 + this file |

---

## Done when (office sign-off)

1. **build 7** (or newer) APK installed on at least one Sunmi + one phone.
2. Add Products **Scan** works on native (no browser error).
3. Settings page is short by default; Counter + Printer sections work when expanded.
4. Payment with **All Branches** does not show UUID error.
5. `APK_UPDATE.md` updated; team has install path for new APK.

---

## Quick commands (copy-paste)

```bash
# From repo root after git pull
cd erp-mobile-app
npm run typecheck
npm run cap:sync:android:prod
cd android && ./gradlew assembleDebug
cp app/build/outputs/apk/debug/app-debug.apk ../releases/erp-mobile-1.0.5-build7-debug.apk
ls -lh ../releases/erp-mobile-1.0.5-build7-debug.apk
```
