#!/bin/bash
# Single writer: copy ANON_KEY from Supabase Docker .env into ERP Vite env files used at Docker build time.
# Run from project root after fix-supabase-storage-jwt.sh + Kong/CORS so /root/supabase/docker/.env is canonical.
# Usage: bash deploy/write-erp-env-from-supabase-docker-env.sh
# Env: SUPABASE_ENV (default /root/supabase/docker/.env), ERP_ORIGIN (default https://erp.dincouture.pk)

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SUPABASE_ENV="${SUPABASE_ENV:-/root/supabase/docker/.env}"
ERP_ENV="${ERP_ENV:-$ROOT/.env.production}"
MOBILE_ENV="${MOBILE_ENV:-$ROOT/erp-mobile-app/.env.production}"
ERP_ORIGIN="${ERP_ORIGIN:-https://erp.dincouture.pk}"

if [ ! -f "$SUPABASE_ENV" ]; then
  echo "[write-erp-env] ERROR: Supabase env not found: $SUPABASE_ENV"
  exit 1
fi

line=$(grep -E '^ANON_KEY=|^SUPABASE_ANON_KEY=' "$SUPABASE_ENV" 2>/dev/null | head -1)
if [ -z "$line" ]; then
  echo "[write-erp-env] ERROR: No ANON_KEY= or SUPABASE_ANON_KEY= line in $SUPABASE_ENV"
  exit 1
fi

ANON="${line#*=}"
ANON=$(printf '%s' "$ANON" | tr -d '\r\n')
ANON="${ANON#\"}"
ANON="${ANON%\"}"

if [ -z "$ANON" ]; then
  echo "[write-erp-env] ERROR: Parsed anon key is empty"
  exit 1
fi

VITE_DISABLE_REALTIME=true
if [ -f "$ERP_ENV" ] && grep -q '^VITE_DISABLE_REALTIME=' "$ERP_ENV" 2>/dev/null; then
  VITE_DISABLE_REALTIME=$(grep '^VITE_DISABLE_REALTIME=' "$ERP_ENV" | head -1 | cut -d= -f2- | tr -d '\r\n"')
fi
[ -z "$VITE_DISABLE_REALTIME" ] && VITE_DISABLE_REALTIME=true

write_three() {
  local target="$1"
  {
    echo "VITE_SUPABASE_URL=$ERP_ORIGIN"
    echo "VITE_SUPABASE_ANON_KEY=$ANON"
    echo "VITE_DISABLE_REALTIME=$VITE_DISABLE_REALTIME"
  } > "${target}.tmp"
  mv "${target}.tmp" "$target"
}

mkdir -p "$(dirname "$ERP_ENV")"
mkdir -p "$(dirname "$MOBILE_ENV")"
write_three "$ERP_ENV"
write_three "$MOBILE_ENV"

anon_len=${#ANON}
anon_tail="${ANON: -8}"
echo "[write-erp-env] Wrote $ERP_ENV and $MOBILE_ENV (VITE_SUPABASE_URL=$ERP_ORIGIN, anon ${anon_len} chars, suffix …${anon_tail})"
