#!/bin/bash
# Phase 2.10B — preview frontend deploy (NO migrations, NO loader flag SQL).
# Syncs from caller's local tree via tar stream OR uses existing VPS worktree.
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/root/NEWPOSV3-preview-qa}"
PREVIEW_PORT="${PREVIEW_PORT:-3003}"
BUILD_LABEL="${BUILD_LABEL:-phase-210b-local}"

cd "$DEPLOY_DIR"

ROLLBACK_TAG="erp-frontend-preview:rollback-before-210b-$(date +%Y%m%d%H%M%S)"
docker tag erp-frontend-preview:latest "$ROLLBACK_TAG" 2>/dev/null || true
echo "[phase-210b] rollback tag (if image existed): $ROLLBACK_TAG"

bash deploy/write-erp-env-from-supabase-docker-env.sh
export VITE_BUILD_COMMIT="$BUILD_LABEL"
export CACHEBUST=$(date +%s)
grep -v '^CACHEBUST=' .env.production 2>/dev/null | grep -v '^VITE_BUILD_COMMIT=' > .env.production.tmp || true
echo "CACHEBUST=$CACHEBUST" >> .env.production.tmp
echo "VITE_BUILD_COMMIT=$VITE_BUILD_COMMIT" >> .env.production.tmp
mv .env.production.tmp .env.production

# Ensure preview maps host :3003 (erp-mobile uses :3002)
sed -i 's/"3002:80"/"3003:80"/' deploy/docker-compose.preview.yml 2>/dev/null || true

COMPOSE="docker compose -f deploy/docker-compose.preview.yml --env-file .env.production"
$COMPOSE build erp-preview

docker rm -f erp-frontend-preview 2>/dev/null || true
$COMPOSE up -d --force-recreate erp-preview

echo "[phase-210b] Health:"
curl -sI "http://127.0.0.1:${PREVIEW_PORT}/" | head -3 || true

echo "[phase-210b] Bundle string check (2.10A loader pack):"
docker exec erp-frontend-preview sh -c '
  cd /usr/share/nginx/html/assets &&
  for s in "data-ledger-v2-main-loader" "unified_ledger_loader_ledger_v2" "resolveLedgerV2MainLoaderSource" "Unified engine preview" "Load MR JALIL"; do
    if grep -rl "$s" . >/dev/null 2>&1; then echo "FOUND:$s"; else echo "MISSING:$s"; fi
  done
' || true

echo "[phase-210b] DONE — preview on :${PREVIEW_PORT}. Tunnel: ssh -N -L 3002:127.0.0.1:${PREVIEW_PORT} dincouture-vps"
echo "[phase-210b] unified_ledger_loader_ledger_v2: NOT enabled. deploy.sh NOT run."
