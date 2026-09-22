#!/usr/bin/env bash
# Fail release builds when no local env file or demo anon JWT is used.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$APP_ROOT/.." && pwd)"
DEMO_SIG='uPWERzbv9FtmRpl0cBPDPox08YhjW_zTOXtwYNLWmuo'

# shellcheck source=lib/env-resolve.sh
source "$SCRIPT_DIR/lib/env-resolve.sh"

if ! resolve_flutter_env_file "$REPO_ROOT"; then
  echo "[verify-flutter-build-env] No env file found. Create one of:"
  echo "  $REPO_ROOT/.env.production"
  echo "  $REPO_ROOT/.env.local"
  echo "  $REPO_ROOT/erp-mobile-app/.env.production"
  echo "Must include VITE_SUPABASE_ANON_KEY (see docs/infra/MOBILE_APK_LOCKED_PATTERN.md)."
  exit 1
fi

read_flutter_anon_key "$FLUTTER_ENV_FILE"
read_flutter_supabase_url "$FLUTTER_ENV_FILE"

failed=0
if [[ -n "$FLUTTER_SUPABASE_URL" ]]; then
  if [[ "$FLUTTER_SUPABASE_URL" != https://supabase.dincouture.pk* && "$FLUTTER_SUPABASE_URL" != https://erp.dincouture.pk* ]]; then
    echo "[verify-flutter-build-env] VITE_SUPABASE_URL must be production (got: $FLUTTER_SUPABASE_URL)"
    failed=1
  fi
fi
if [[ -z "$FLUTTER_ANON_KEY" || ${#FLUTTER_ANON_KEY} -lt 120 ]]; then
  echo "[verify-flutter-build-env] VITE_SUPABASE_ANON_KEY missing or too short in $FLUTTER_ENV_FILE"
  failed=1
fi
if [[ "$(echo "$FLUTTER_ANON_KEY" | awk -F. '{print $3}')" == "$DEMO_SIG" ]]; then
  echo "[verify-flutter-build-env] VITE_SUPABASE_ANON_KEY is the public Supabase DEMO key."
  failed=1
fi

if [[ "$failed" -ne 0 ]]; then
  exit 1
fi

echo "[verify-flutter-build-env] OK — using $FLUTTER_ENV_FILE"
