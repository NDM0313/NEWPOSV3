# ERP Mobile — build & graphify (run locally)

Use these commands yourself to save agent credits. Agent does not run APK builds unless you ask.

## 1) Release APK (Windows)

```powershell
cd "c:\Users\ndm31\dev\Corusr\NEW POSV3\erp-mobile-app"
npm run android:apk:release:win
```

Output: `releases/erp-mobile-1.0.5-build33.apk` (versionCode must match `android/app/build.gradle`).

**Needs:** JDK 17 or 21, Android SDK, `android/keystore.properties` for signed release.

## 2) Install on phone (USB debugging)

```powershell
adb devices
adb install -r "c:\Users\ndm31\dev\Corusr\NEW POSV3\erp-mobile-app\releases\erp-mobile-1.0.5-build33.apk"
```

Replace `build33` with the APK you just built.

## 3) Graphify update (repo root, AST only — no API cost)

```powershell
cd "c:\Users\ndm31\dev\Corusr\NEW POSV3"
graphify update .
```

Updates `graphify-out/graph.json` and `graphify-out/GRAPH_REPORT.md`. Run after code changes, not required for APK install only.

## 4) Verify corrupt storage object (Supabase Dashboard)

Example path from debug log (2-byte junk on server):

```
product-images / 597a5292-14c8-4cd8-96bd-c61b5a0d8c92 / 335a566a-b559-418c-95a1-471345c8821c / 507604b2-c072-4f6f-a9d9-69604bba9118.jpg
```

If file size is **2 B**, delete or re-upload from APK build 32+ (upload) or build 33+ (attachments + product).

## 6) Attachment QA (build 33)

After install: sale JPG attach, purchase attach, payment receipt, expense receipt, journal/transfer PDF+image. Settings → 7× version → Debug log → Share if preview fails.

## 5) Debug log on device

Settings → App version tap **7×** → Developer Tools → **Debug log** → Clear → reproduce → **Share**.
