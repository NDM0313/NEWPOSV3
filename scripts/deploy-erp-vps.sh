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
echo "=== 1. Sync to remote (fetch + reset) ==="
BRANCH="${BRANCH:-before-mobile-replace}"
git fetch origin
git checkout "$BRANCH" 2>/dev/null || true
git reset --hard "origin/$BRANCH"

echo ""
echo "=== 2. Build image (build-args from env) ==="
export VITE_SUPABASE_URL
export VITE_SUPABASE_ANON_KEY
docker compose -f docker-compose.prod.yml build --no-cache

# Ensure dokploy-network exists (Traefik and ERP both use it)
if ! docker network inspect dokploy-network &>/dev/null; then
  echo "Creating dokploy-network..."
  docker network create dokploy-network
fi

echo ""
echo "=== 3. Recreate and start container ==="
docker compose -f docker-compose.prod.yml up -d --force-recreate

# Traefik must be on dokploy-network to route to ERP (Dokploy uses dokploy-traefik)
TRAEFIK_NAME=$(docker ps --format '{{.Names}}' | grep -E 'traefik|dokploy-traefik' | head -1)
if [ -n "$TRAEFIK_NAME" ]; then
  if docker network inspect dokploy-network 2>/dev/null | grep -q "\"$TRAEFIK_NAME\""; then
    echo "Traefik ($TRAEFIK_NAME) already on dokploy-network"
  else
    echo "Attaching Traefik ($TRAEFIK_NAME) to dokploy-network..."
    docker network connect dokploy-network "$TRAEFIK_NAME" 2>/dev/null || true
  fi
else
  echo "No Traefik container found (name containing 'traefik'). If ERP domain fails, attach your reverse-proxy container to dokploy-network."
fi

echo ""
echo "=== 4. Check ==="
docker compose -f docker-compose.prod.yml ps

echo ""
echo "=== 5. Diagnose (erp.dincouture.pk) ==="
[ -f "scripts/vps-erp-diagnose.sh" ] && { chmod +x scripts/vps-erp-diagnose.sh 2>/dev/null; bash scripts/vps-erp-diagnose.sh; } || true

echo ""
echo "Done. Open https://erp.dincouture.pk to test."
