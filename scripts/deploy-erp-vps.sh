#!/usr/bin/env bash
# Auto-deploy ERP frontend on VPS: pull, build with Supabase env, recreate container.
# Run from repo root on VPS:  bash scripts/deploy-erp-vps.sh
# Uses VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY from env or from Supabase .env file.

set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# Default Kong URL (self-hosted Supabase on same VPS)
VITE_SUPABASE_URL="${VITE_SUPABASE_URL:-https://72.62.254.176:8443}"

# Load anon key from Supabase docker .env if not set
SUPABASE_ENV="${SUPABASE_ENV:-/root/supabase/docker/.env}"
if [ -z "$VITE_SUPABASE_ANON_KEY" ] && [ -f "$SUPABASE_ENV" ]; then
  echo "Loading VITE_SUPABASE_ANON_KEY from $SUPABASE_ENV"
  export VITE_SUPABASE_ANON_KEY=$(grep -E '^ANON_KEY=' "$SUPABASE_ENV" | cut -d= -f2- | tr -d '"' | tr -d "'")
fi

if [ -z "$VITE_SUPABASE_ANON_KEY" ]; then
  echo "ERROR: VITE_SUPABASE_ANON_KEY not set and not found in $SUPABASE_ENV"
  echo "Export it or set in .env.production: VITE_SUPABASE_ANON_KEY=your_anon_key"
  exit 1
fi

echo "=== ERP frontend deploy (erp.dincouture.pk) ==="
echo "  VITE_SUPABASE_URL=$VITE_SUPABASE_URL"
echo "  ANON_KEY length: ${#VITE_SUPABASE_ANON_KEY} chars"

echo ""
echo "=== 1. Git pull ==="
git pull || true

echo ""
echo "=== 2. Build image (build-args from env) ==="
export VITE_SUPABASE_URL
export VITE_SUPABASE_ANON_KEY
docker compose -f docker-compose.prod.yml build --no-cache

echo ""
echo "=== 3. Recreate and start container ==="
docker compose -f docker-compose.prod.yml up -d --force-recreate

echo ""
echo "=== 4. Check ==="
docker compose -f docker-compose.prod.yml ps
echo ""
echo "Done. Open https://erp.dincouture.pk to test."
