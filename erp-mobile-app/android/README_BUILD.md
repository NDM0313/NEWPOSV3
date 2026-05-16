# Android build

This project uses **Gradle 9.1.0** and **Android Gradle Plugin 9.0**. Capacitor 8 requires **JDK 21+** for compilation (JDK 25 works on this machine).

## One-time setup

1. Install Android Studio (SDK). Set `sdk.dir` in `android/local.properties` (see example path for Windows).
2. Use JDK 21 or newer. On Windows PowerShell before Gradle:

```powershell
$env:JAVA_HOME = "C:\Program Files\Java\jdk-25.0.1.8-hotspot"
```

## Full build (from `erp-mobile-app`)

```bash
npm ci
npm run build:mobile
npx cap sync android
cd android
.\gradlew.bat assembleDebug    # Windows
# ./gradlew assembleDebug      # macOS/Linux
```

**Debug APK:** `android/app/build/outputs/apk/debug/app-debug.apk`

## Company modules

Enable POS, Rental, Studio, Accounting in Web ERP → **Settings → Module Toggles**.  
Packing: **Settings → Inventory → Enable Packing**. Mobile users: log out and back in after changes.

Run `migrations/backfill_mobile_modules_config.sql` in Supabase once if legacy companies are missing module rows.
