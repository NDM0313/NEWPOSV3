#!/usr/bin/env bash
# Install & run on a connected iPhone (Mac + Xcode required).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$APP_ROOT/.." && pwd)"

# shellcheck source=lib/env-resolve.sh
source "$SCRIPT_DIR/lib/env-resolve.sh"

"$SCRIPT_DIR/verify-flutter-build-env.sh"

if ! resolve_flutter_env_file "$REPO_ROOT"; then
  echo "[run-ios-device] No env file found."
  exit 1
fi

read_flutter_anon_key "$FLUTTER_ENV_FILE"
KEY="$FLUTTER_ANON_KEY"

DEVICE_ID="${1:-}"
MODE="${2:-debug}"

cd "$APP_ROOT"
flutter pub get

echo "[run-ios-device] pod install…"
cd ios
pod install --repo-update
cd "$APP_ROOT"

if [[ -z "$DEVICE_ID" ]]; then
  echo "[run-ios-device] Connected iOS devices:"
  flutter devices | grep -E 'ios|iPhone' || true
  DEVICE_ID="$(flutter devices | grep 'iPhone' | head -1 | awk '{print $NF}' || true)"
  if [[ -z "$DEVICE_ID" ]]; then
    echo "[run-ios-device] No iPhone found. Connect USB or enable wireless debugging in Xcode."
    exit 1
  fi
  echo "[run-ios-device] Using device: $DEVICE_ID"
fi

if [[ "$MODE" == "release" ]]; then
  flutter run -d "$DEVICE_ID" --release \
    --dart-define=SUPABASE_ANON_KEY="$KEY"
else
  flutter run -d "$DEVICE_ID" \
    --dart-define=SUPABASE_ANON_KEY="$KEY"
fi
