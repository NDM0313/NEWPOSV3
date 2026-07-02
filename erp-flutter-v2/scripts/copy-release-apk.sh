#!/usr/bin/env bash
# Copy app-release.apk → releases/erp-flutter-{version}-build{code}.apk
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RELEASE_DIR="$APP_ROOT/build/app/outputs/flutter-apk"
RELEASES_DIR="$APP_ROOT/releases"

if [[ ! -f "$RELEASE_DIR/app-release.apk" ]]; then
  echo "[copy-release-apk] No app-release.apk — run build-release-apk.sh first."
  exit 0
fi

VERSION="$(grep '^version:' "$APP_ROOT/pubspec.yaml" | awk '{print $2}')"
NAME="${VERSION%%+*}"
CODE="${VERSION##*+}"
DEST_NAME="erp-flutter-${NAME}-build${CODE}.apk"

mkdir -p "$RELEASES_DIR"
cp "$RELEASE_DIR/app-release.apk" "$RELEASES_DIR/$DEST_NAME"
echo "[copy-release-apk] Copied to releases/$DEST_NAME"
