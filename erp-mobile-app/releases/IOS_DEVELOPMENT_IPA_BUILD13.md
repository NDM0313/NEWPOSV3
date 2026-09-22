# iOS Development IPA — Build 13 (Mac)

**App:** NDM ERP (Capacitor)  
**Bundle ID:** `com.dincouture.erp`  
**Marketing version:** 1.0.5  
**Build number:** 13 (`CURRENT_PROJECT_VERSION`)  
**Export method:** Development (`debugging`) — team **NLNZN84GX4**  
**API base (prod sync):** `https://erp.dincouture.pk`

---

## Files

| File | Purpose |
|------|---------|
| `releases/erp-mobile-1.0.5-build13.ipa` | Install on registered iPhone |
| `releases/ios-export-build13/NDM ERP.ipa` | Xcode export output |
| `releases/ios-export-build13/ExportOptions.plist` | Re-export options |

---

## Changelog vs build 12

- **Rental list:** Salesman name on cards; workflow badges (Booked → Pickup → Return → Complete).
- **Rental detail:** Bill ref header styling (white, bold); salesman in header.
- **API:** Staff name enrichment fix in `rentals.ts`.

**Android parity:** `versionCode 38` → `releases/erp-mobile-1.0.5-build38.apk`

---

## Build commands (Mac)

One-liner (recommended):

```bash
cd erp-mobile-app
npm run ios:ipa:release:mac
```

Manual steps:

```bash
cd erp-mobile-app
npm ci
npm run cap:sync:ios:prod
cd ios/App && pod install
xcodebuild -workspace App.xcworkspace -scheme "NDM ERP" -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath ../../build/NDM-ERP-build13.xcarchive archive
xcodebuild -exportArchive \
  -archivePath ../../build/NDM-ERP-build13.xcarchive \
  -exportPath ../../releases/ios-export-build13 \
  -exportOptionsPlist ../../releases/ios-export-build13/ExportOptions.plist
node scripts/copy-release-ipa.mjs
```

---

## Quick test

| # | Check |
|---|--------|
| 1 | Login → prod Supabase |
| 2 | Rentals list shows salesman + workflow badges |
| 3 | Rental detail header shows bill ref + salesman |
| 4 | Sales → Add Products → Scan still works (CocoaPods / ML Kit) |

**Install:** Xcode → Devices → drag `erp-mobile-1.0.5-build13.ipa` (Development profile; device registered on team).
