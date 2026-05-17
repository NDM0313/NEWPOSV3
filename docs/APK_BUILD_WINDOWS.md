# Build Android APK on Windows (ERP Mobile)

Target app: [`erp-mobile-app/`](../erp-mobile-app/) (Capacitor + Vite + React).

## Prerequisites

| Requirement | Notes |
|-------------|--------|
| **Node.js LTS** + npm | Install dependencies with `npm ci` or `npm install` inside `erp-mobile-app`. |
| **JDK 17** | Set `JAVA_HOME` to a JDK 17 install. Matches `android/app/build.gradle` compile options. |
| **Android SDK** | Install via Android Studio. Set `ANDROID_HOME` (or `ANDROID_SDK_ROOT`). |
| **`android/local.properties`** | Must contain `sdk.dir` pointing at your SDK (Android Studio can generate this). |
| **Env for web build** | `.env` / `.env.production` in `erp-mobile-app` with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and for native builds `VITE_TARGET=capacitor` for production (see [`erp-mobile-app/android/README_BUILD.md`](../erp-mobile-app/android/README_BUILD.md)). |

## Fast path: Debug APK (sideload / internal testing)

From repository root:

```bat
cd erp-mobile-app
npm ci
npm run android:debug:win
```

Or double-click style (run `cmd` from `erp-mobile-app`):

```bat
scripts\build-apk-windows.cmd
```

PowerShell (Debug default):

```powershell
cd erp-mobile-app
powershell -ExecutionPolicy Bypass -File .\scripts\build-apk-windows.ps1
```

**Output:** `erp-mobile-app\android\app\build\outputs\apk\debug\app-debug.apk`

## Release APK (signed)

1. Copy `android/keystore.properties.example` to `android/keystore.properties` and fill signing fields.
2. Bump `versionCode` / `versionName` in `android/app/build.gradle` `defaultConfig` before each store upload.
3. Production web bundle + sync, then Gradle:

```powershell
cd erp-mobile-app
powershell -ExecutionPolicy Bypass -File .\scripts\build-apk-windows.ps1 -Configuration Release -Production
```

**Outputs:** under `android\app\build\outputs\apk\release\` (and `bundle\release\` if you run `npm run android:bundle:win`).

## Play Store bundle (.aab)

```bat
cd erp-mobile-app\android
gradlew.bat bundleRelease
```

## After each build (APK “update file”)

Edit [`erp-mobile-app/releases/APK_UPDATE.md`](../erp-mobile-app/releases/APK_UPDATE.md): set version, date, changelog, and the path or URL where you stored the APK. Commit that file when you distribute a build so the team has a single place to look.

## npm scripts reference

| Script | Purpose |
|--------|---------|
| `npm run android:debug:win` | `cap sync` + `gradlew.bat assembleDebug` |
| `npm run android:apk:release:win` | Prod Vite build + sync + `assembleRelease` |
| `npm run android:bundle:win` | `gradlew.bat bundleRelease` (run sync first if web assets changed) |

From repo root: `npm run mobile:apk:debug:win` / `npm run mobile:apk:release:win` (see root `package.json`).

## Troubleshooting

### `invalid source release: 21` (JDK 17)

Capacitor 8’s `node_modules/@capacitor/android` defaults to **Java 21**. If `JAVA_HOME` is **JDK 17**, Gradle used to fail compiling `:capacitor-android`.

This repo pins **all** Android library/app modules to **Java 17** in [`android/build.gradle`](../erp-mobile-app/android/build.gradle) (`subprojects { ... compileOptions VERSION_17 }`). If you still see release 21 after upgrading Capacitor, re-check that block exists.

**Alternative:** install **JDK 21+**, set `JAVA_HOME`, and you can remove the pin if you prefer to match upstream Capacitor defaults.
