#!/usr/bin/env bash
# Build release APK with anon key from repo root .env.production (not committed).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$APP_ROOT/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env.production"

"$SCRIPT_DIR/verify-flutter-build-env.sh"

KEY="$(grep -E '^VITE_SUPABASE_ANON_KEY=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" | xargs)"

cd "$APP_ROOT"
flutter pub get
flutter analyze
flutter build apk --release --dart-define=SUPABASE_ANON_KEY="$KEY"

echo "[build-release-apk] APK: $APP_ROOT/build/app/outputs/flutter-apk/app-release.apk"
