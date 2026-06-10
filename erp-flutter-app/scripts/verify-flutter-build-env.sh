#!/usr/bin/env bash
# Fail release builds when repo root .env.production is missing or uses the public demo anon JWT.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$APP_ROOT/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env.production"
DEMO_SIG='uPWERzbv9FtmRpl0cBPDPox08YhjW_zTOXtwYNLWmuo'

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[verify-flutter-build-env] Missing $ENV_FILE"
  echo "Set VITE_SUPABASE_ANON_KEY from VPS (see docs/infra/MOBILE_APK_LOCKED_PATTERN.md)."
  exit 1
fi

KEY="$(grep -E '^VITE_SUPABASE_ANON_KEY=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" | xargs)"
URL="$(grep -E '^VITE_SUPABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" | xargs)"

failed=0
if [[ "$URL" != https://supabase.dincouture.pk* && "$URL" != https://erp.dincouture.pk* ]]; then
  echo "[verify-flutter-build-env] VITE_SUPABASE_URL must be production (got: ${URL:-empty})"
  failed=1
fi
if [[ -z "$KEY" || ${#KEY} -lt 120 ]]; then
  echo "[verify-flutter-build-env] VITE_SUPABASE_ANON_KEY missing or too short."
  failed=1
fi
if [[ "$(echo "$KEY" | awk -F. '{print $3}')" == "$DEMO_SIG" ]]; then
  echo "[verify-flutter-build-env] VITE_SUPABASE_ANON_KEY is the public Supabase DEMO key."
  failed=1
fi

if [[ "$failed" -ne 0 ]]; then
  exit 1
fi

echo "[verify-flutter-build-env] OK — production Supabase URL/key look valid."
