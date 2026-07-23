# ERP Mobile — build & graphify (run locally)

Use these commands yourself to save agent credits. Agent does not run APK/IPA builds unless you ask.

## 1) Release APK

### Mac (zsh)

```bash
cd erp-mobile-app
npm run android:apk:release:mac
```

Output: `releases/erp-mobile-1.0.5-build39.apk` (versionCode must match `android/app/build.gradle`).

### Windows (PowerShell)

```powershell
cd "c:\Users\ndm31\dev\Corusr\NEW POSV3\erp-mobile-app"
npm run android:apk:release:win
```

**Needs:** JDK 17 or 21, Android SDK, `android/keystore.properties` for signed release.

## 2) Release IPA (Mac only)

```bash
cd erp-mobile-app
npm run ios:ipa:release:mac
```

Output: `releases/erp-mobile-1.0.5-build14.ipa` (build number must match `CURRENT_PROJECT_VERSION` in `ios/App/App.xcodeproj/project.pbxproj`).

See `releases/IOS_DEVELOPMENT_IPA_BUILD14.md` for manual xcodebuild steps.

**Needs:** Xcode, Apple team signing (Development), CocoaPods (`pod install` in `ios/App`). Open **`App.xcworkspace`**, not `.xcodeproj`.

## 3) Install on phone

**Android (USB debugging):**

```bash
adb devices
adb install -r erp-mobile-app/releases/erp-mobile-1.0.5-build39.apk
```

**iOS:** Xcode → Window → Devices and Simulators → drag `erp-mobile-1.0.5-build14.ipa` onto registered device.

Replace build numbers with the APK/IPA you just built.

## 4) Graphify update (repo root, AST only — no API cost)

```bash
cd /path/to/NEWPOSV3
graphify update .
```

Updates `graphify-out/graph.json` and `graphify-out/GRAPH_REPORT.md`. Run after code changes, not required for install only.

## 5) Verify corrupt storage object (Supabase Dashboard)

Example path from debug log (2-byte junk on server):

```
product-images / 597a5292-14c8-4cd8-96bd-c61b5a0d8c92 / 335a566a-b559-418c-95a1-471345c8821c / 507604b2-c072-4f6f-a9d9-69604bba9118.jpg
```

If file size is **2 B**, delete or re-upload from APK build 32+ (upload) or build 33+ (attachments + product).

## 6) Attachment QA (build 33+)

After install: sale JPG attach, purchase attach, payment receipt, expense receipt, journal/transfer PDF+image. Settings → 7× version → Debug log → Share if preview fails.

## 7) Debug log on device

Settings → App version tap **7×** → Developer Tools → **Debug log** → Clear → reproduce → **Share**.
