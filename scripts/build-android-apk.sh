#!/bin/bash
# Build Android APK for erp-mobile-app
# Run from project root: bash scripts/build-android-apk.sh

set -e
cd "$(dirname "$0")/.."

echo "[1/3] Building web assets..."
cd erp-mobile-app
npm run build:mobile

echo "[2/3] Syncing to Android..."
npx cap sync

echo "[3/3] Building debug APK..."
cd android
./gradlew assembleDebug

echo ""
echo "APK: erp-mobile-app/android/app/build/outputs/apk/debug/app-debug.apk"
echo "For release: open in Android Studio and Build → Build APK(s) with signing"
