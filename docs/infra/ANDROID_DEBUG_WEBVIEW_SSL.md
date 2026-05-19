# Android WebView — debug-only SSL bypass

When testing the Capacitor app on a device (e.g. Google Pixel) against an **HTTPS** dev server with a **self-signed or hostname-mismatched** certificate, the system WebView can report a TLS / SSL validation error and show a white screen.

## What we ship

- [`erp-mobile-app/android/app/src/main/java/com/dincouture/erp/DebugSslWebViewClient.java`](../../erp-mobile-app/android/app/src/main/java/com/dincouture/erp/DebugSslWebViewClient.java) — extends Capacitor `BridgeWebViewClient` and overrides `onReceivedSslError` to call `handler.proceed()` **only when** `BuildConfig.DEBUG` is true.
- [`MainActivity.java`](../../erp-mobile-app/android/app/src/main/java/com/dincouture/erp/MainActivity.java) — in `onStart()`, if `BuildConfig.DEBUG`, installs `DebugSslWebViewClient` on the bridge `WebView`. Release builds never install this client (early return when `DEBUG` is false).
- [`erp-mobile-app/android/app/build.gradle`](../../erp-mobile-app/android/app/build.gradle) — `buildFeatures { buildConfig true }` so `BuildConfig` is generated (required on AGP 8+ defaults).

**Release / production:** `BuildConfig.DEBUG` is false; the app keeps the default WebView SSL behavior. This does not change Supabase URLs, `network_security_config.xml`, or server TLS.

**Security:** In debug, `proceed()` accepts certificate errors for that WebView — use only on trusted dev tablets/phones.

## Rebuild and install (Windows / PowerShell)

Per [`.cursor/rules/android-capacitor-build.mdc`](../../.cursor/rules/android-capacitor-build.mdc): sync from `erp-mobile-app`, then Gradle from `erp-mobile-app\android`.

```powershell
Set-Location "C:\Users\ndm31\dev\Corusr\NEW POSV3\erp-mobile-app"
npm run cap:sync:android
Set-Location ".\android"
.\gradlew.bat assembleDebug
adb devices
adb install -r ".\app\build\outputs\apk\debug\app-debug.apk"
```

Use **`assembleDebug`** to get the SSL bypass. **`assembleRelease`** does not run the bypass (`BuildConfig.DEBUG` is false and `MainActivity` does not replace the client).

## Cleartext vs TLS

HTTP cleartext and mixed content are still governed by [`AndroidManifest.xml`](../../erp-mobile-app/android/app/src/main/AndroidManifest.xml), [`network_security_config.xml`](../../erp-mobile-app/android/app/src/main/res/xml/network_security_config.xml), and [`capacitor.config.ts`](../../erp-mobile-app/capacitor.config.ts). This document only covers **HTTPS** certificate validation failures in the WebView.
