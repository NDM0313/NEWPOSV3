#!/usr/bin/env bash
# Build release APK with anon key from local env (not committed).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$APP_ROOT/.." && pwd)"

# shellcheck source=lib/env-resolve.sh
source "$SCRIPT_DIR/lib/env-resolve.sh"

"$SCRIPT_DIR/verify-flutter-build-env.sh"

if ! resolve_flutter_env_file "$REPO_ROOT"; then
  echo "[build-release-apk] Env file missing after verify."
  exit 1
fi

read_flutter_anon_key "$FLUTTER_ENV_FILE"
KEY="$FLUTTER_ANON_KEY"

cd "$APP_ROOT"
flutter pub get
flutter analyze
flutter build apk --release --dart-define=SUPABASE_ANON_KEY="$KEY"

"$SCRIPT_DIR/copy-release-apk.sh"

echo "[build-release-apk] APK: $APP_ROOT/build/app/outputs/flutter-apk/app-release.apk"
