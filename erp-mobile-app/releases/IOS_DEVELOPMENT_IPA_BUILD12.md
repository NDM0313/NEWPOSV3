# iOS Development IPA — Build 12 (Mac)

**App:** NDM ERP (Capacitor)  
**Bundle ID:** `com.dincouture.erp`  
**Marketing version:** 1.0.5  
**Build number:** 12 (`CURRENT_PROJECT_VERSION`)  
**Export method:** Development (`debugging`) — team **NLNZN84GX4**  
**API base (prod sync):** `https://erp.dincouture.pk`

---

## Files

| File | Purpose |
|------|---------|
| `releases/erp-mobile-1.0.5-build12.ipa` | Install on registered iPhone |
| `releases/ios-export-build12/NDM ERP.ipa` | Xcode export output |
| `releases/ios-export-build12/ExportOptions.plist` | Re-export options |

---

## Changelog vs build 11

- **iOS barcode fix:** Migrated from SPM-only to **CocoaPods** so `@capacitor-mlkit/barcode-scanning` (Google ML Kit) links natively. Open `ios/App/App.xcworkspace` (not `.xcodeproj`). Run `pod install` after plugin changes.
- **Add Products:** Scan button always shown on native app; ML Kit camera scan + optional hardware wedge input.
- **Rental:** Shared `DateRangeBar` (purple variant) with This week / Last week presets.
- **Expenses:** Sub-category filter chips from category tree.

**Android parity:** `versionCode 37` → `releases/erp-mobile-1.0.5-build37.apk`

---

## Build commands (Mac)

```bash
cd erp-mobile-app
npm ci
npm run cap:sync:ios:prod
cd ios/App && pod install
xcodebuild -workspace App.xcworkspace -scheme "NDM ERP" -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath ../../build/NDM-ERP-build12.xcarchive archive
xcodebuild -exportArchive \
  -archivePath ../../build/NDM-ERP-build12.xcarchive \
  -exportPath ../../releases/ios-export-build12 \
  -exportOptionsPlist ../../releases/ios-export-build12/ExportOptions.plist
cp "../../releases/ios-export-build12/NDM ERP.ipa" "../../releases/erp-mobile-1.0.5-build12.ipa"
```

---

## Quick test

| # | Check |
|---|--------|
| 1 | Login → prod Supabase |
| 2 | Sales → Add Products → **Scan** opens camera; barcode adds product |
| 3 | Rental date chips (This week / Last week) |
| 4 | Expenses sub-category chips filter list |

**Status:** Archive + export succeeded.
