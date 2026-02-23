# Android APK Build

## Prerequisites

- Node 18+
- Android Studio (or Android SDK)
- Java 17

## Steps

### 1. Build web assets

```bash
cd erp-mobile-app
npm run build:mobile
```

### 2. Sync to Android

```bash
npx cap sync
```

### 3. Open in Android Studio

```bash
npx cap open android
```

### 4. Build APK

In Android Studio:

1. **Build → Build Bundle(s) / APK(s) → Build APK(s)**
2. Debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`
3. Release APK: requires signing (see below)

## Signed Release APK

### Create keystore (one-time)

```bash
keytool -genkey -v -keystore erp-release.keystore -alias erp -keyalg RSA -keysize 2048 -validity 10000
```

### Configure signing

Edit `android/app/build.gradle`:

```gradle
android {
    signingConfigs {
        release {
            storeFile file("../../erp-release.keystore")
            storePassword "YOUR_STORE_PASSWORD"
            keyAlias "erp"
            keyPassword "YOUR_KEY_PASSWORD"
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            shrinkResources true
        }
    }
}
```

### Build release APK

```bash
cd android
./gradlew assembleRelease
```

Output: `android/app/build/outputs/apk/release/app-release.apk`

## Permissions

- **Camera** — optional, for barcode scanning (future)
- **Storage** — optional
- **Internet** — for API calls

Default `AndroidManifest.xml` includes minimal permissions. Add more in `android/app/src/main/AndroidManifest.xml` if needed.

## Script

See `scripts/build-android-apk.sh` for automated steps.
