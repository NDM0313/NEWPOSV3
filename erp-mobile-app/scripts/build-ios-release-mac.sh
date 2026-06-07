#!/usr/bin/env bash
# Mac-only: prod sync → pod install → archive → export → copy IPA to releases/
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

node scripts/prepare-release-env.mjs
node scripts/verify-mobile-build-env.mjs
npm run cap:sync:ios:prod

cd ios/App
pod install

BUILD_NUM="$(grep -m1 'CURRENT_PROJECT_VERSION = ' App.xcodeproj/project.pbxproj | sed 's/.*= \([0-9]*\);/\1/')"
ARCHIVE_PATH="$ROOT/build/NDM-ERP-build${BUILD_NUM}.xcarchive"
EXPORT_PATH="$ROOT/releases/ios-export-build${BUILD_NUM}"
EXPORT_PLIST="$EXPORT_PATH/ExportOptions.plist"

if [[ ! -f "$EXPORT_PLIST" ]]; then
  SEED=""
  for d in "$ROOT/releases"/ios-export-build*; do
    [[ -d "$d" && -f "$d/ExportOptions.plist" ]] || continue
    SEED="$d"
  done
  if [[ -n "$SEED" && "$SEED" != "$EXPORT_PATH" ]]; then
    echo "[build-ios-release-mac] Seeding $EXPORT_PATH from $(basename "$SEED")"
    mkdir -p "$EXPORT_PATH"
    cp "$SEED/ExportOptions.plist" "$EXPORT_PLIST"
  fi
fi

if [[ ! -f "$EXPORT_PLIST" ]]; then
  echo "[build-ios-release-mac] Missing $EXPORT_PLIST (copy from a prior ios-export-buildN folder)"
  exit 1
fi

mkdir -p "$ROOT/build"

xcodebuild -workspace App.xcworkspace -scheme "NDM ERP" -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE_PATH" archive

xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_PATH" \
  -exportOptionsPlist "$EXPORT_PLIST"

cd "$ROOT"
node scripts/copy-release-ipa.mjs --build="$BUILD_NUM"
