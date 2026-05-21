# Android build

This project uses **Gradle 9.1.0** and **Android Gradle Plugin 9.0**. Use **JDK 17** (`JAVA_HOME`) unless you explicitly validate a newer JDK against this repo (JDK 21+ also works if you drop the root `subprojects` Java 17 pin in `android/build.gradle`).

**Note:** Capacitor 8’s `@capacitor/android` defaults to Java 21 in `node_modules`. The repo’s root [`build.gradle`](build.gradle) forces **Java 17** for all Android modules so JDK 17 machines do not hit `invalid source release: 21`.

## One-time setup

1. Install Android Studio (SDK). Set `sdk.dir` in `android/local.properties`.
2. Set `JAVA_HOME` to JDK 17 (recommended). If NetBeans/Android Studio uses **JDK 25**, run from `erp-mobile-app`: `npm run fix:gradle-jdk` (pins Gradle to JDK 17 via `org.gradle.java.home`).

## Debug build (from `erp-mobile-app`)

```bash
npm ci
npm run android:debug
```

**Debug APK:** `android/app/build/outputs/apk/debug/app-debug.apk`

**Windows (npm):** `npm run android:debug:win` — or run `scripts\build-apk-windows.cmd`, or PowerShell `.\scripts\build-apk-windows.ps1`. Full guide: [`docs/APK_BUILD_WINDOWS.md`](../../docs/APK_BUILD_WINDOWS.md).

Manual equivalent:

```bash
npm run build:mobile && npx cap sync android && cd android && ./gradlew assembleDebug   # macOS/Linux
# Windows: .\gradlew.bat assembleDebug
```

---

## Production (signed AAB / APK)

See also **Production build** section in repo root [`../README.md`](../README.md).

1. **`erp-mobile-app/.env.production`** — copy from [`.env.production.example`](../.env.production.example); must include **`VITE_TARGET=capacitor`** + production Supabase URL/anon key (same as web).
2. **Sync:**

   ```bash
   npm run cap:sync:android:prod
   ```

3. **`android/keystore.properties`** — copy from [`keystore.properties.example`](keystore.properties.example); reference your upload `.jks` (path relative to `android/`). Required for meaningful `bundleRelease` / `assembleRelease` signing.

4. **Bump** `versionCode` / `versionName` in [`app/build.gradle`](app/build.gradle) `defaultConfig` before each Play upload.

5. **Outputs:**

   ```bash
   cd erp-mobile-app
   npm run android:bundle         # Play: .aab
   npm run android:apk:release    # sideload .apk(s)
   ```

Typical outputs:  
`app/build/outputs/bundle/release/app-release.aab` · `app/build/outputs/apk/release/`

---

## Company modules

Enable POS, Rental, Studio, Accounting in Web ERP → **Settings → Module Toggles**.  
Packing: **Settings → Inventory → Enable Packing**. Mobile users: log out and back in after changes.

Run `migrations/backfill_mobile_modules_config.sql` in Supabase once if legacy companies are missing module rows.
