#!/bin/bash
# Phase 2.12 — preview frontend deploy (NO migrations, NO Trial Balance loader flag SQL).
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/root/NEWPOSV3-preview-qa}"
PREVIEW_PORT="${PREVIEW_PORT:-3003}"
BUILD_LABEL="${BUILD_LABEL:-phase-212-preview}"

cd "$DEPLOY_DIR"

ROLLBACK_TAG="erp-frontend-preview:rollback-before-212-$(date +%Y%m%d%H%M%S)"
docker tag erp-frontend-preview:latest "$ROLLBACK_TAG" 2>/dev/null || true
echo "[phase-212] rollback tag: $ROLLBACK_TAG"

bash deploy/write-erp-env-from-supabase-docker-env.sh
export VITE_BUILD_COMMIT="$BUILD_LABEL"
export CACHEBUST=$(date +%s)
grep -v '^CACHEBUST=' .env.production 2>/dev/null | grep -v '^VITE_BUILD_COMMIT=' > .env.production.tmp || true
echo "CACHEBUST=$CACHEBUST" >> .env.production.tmp
echo "VITE_BUILD_COMMIT=$VITE_BUILD_COMMIT" >> .env.production.tmp
mv .env.production.tmp .env.production

sed -i 's/"3002:80"/"3003:80"/' deploy/docker-compose.preview.yml 2>/dev/null || true

COMPOSE="docker compose -f deploy/docker-compose.preview.yml --env-file .env.production"
$COMPOSE build erp-preview

docker rm -f erp-frontend-preview 2>/dev/null || true
$COMPOSE up -d --force-recreate erp-preview

echo "[phase-212] Bundle check:"
docker exec erp-frontend-preview sh -c '
  cd /usr/share/nginx/html/assets &&
  for s in data-trial-balance-main-loader resolveTrialBalanceMainLoaderSource unified_ledger_loader_trial_balance legacy_shadow; do
    if grep -rl "$s" . >/dev/null 2>&1; then echo "FOUND:$s"; else echo "MISSING:$s"; fi
  done
' || true

echo "[phase-212] DONE preview :${PREVIEW_PORT}. Tunnel: ssh -N -L 3002:127.0.0.1:${PREVIEW_PORT} dincouture-vps"
