#!/bin/bash
# Phase 2.12 — production frontend deploy ONLY (Trial Balance loader OFF).
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/root/NEWPOSV3}"
BUILD_LABEL="${BUILD_LABEL:-phase-212-prod}"
ROLLBACK_TAG="erp-frontend:rollback-before-212-$(date +%Y%m%d%H%M%S)"

cd "$DEPLOY_DIR"

docker tag erp-frontend:latest "$ROLLBACK_TAG" 2>/dev/null || true
echo "[phase-212] rollback tag: $ROLLBACK_TAG"

bash deploy/write-erp-env-from-supabase-docker-env.sh
export VITE_BUILD_COMMIT="$BUILD_LABEL"
export CACHEBUST=$(date +%s)
grep -v '^CACHEBUST=' .env.production 2>/dev/null | grep -v '^VITE_BUILD_COMMIT=' > .env.production.tmp || true
echo "CACHEBUST=$CACHEBUST" >> .env.production.tmp
echo "VITE_BUILD_COMMIT=$VITE_BUILD_COMMIT" >> .env.production.tmp
mv .env.production.tmp .env.production

echo "[phase-212] Confirm Trial Balance loader OFF..."
docker exec -i supabase-db psql -U postgres -d postgres -t -A -c \
  "SELECT feature_key, enabled FROM feature_flags WHERE company_id = '30bd8592-3384-4f34-899a-f3907e336485' AND feature_key IN ('unified_ledger_loader_trial_balance','unified_ledger_screen_trial_balance');"

COMPOSE="docker compose -f deploy/docker-compose.prod.yml --env-file .env.production"
$COMPOSE build erp

docker kill erp-frontend 2>/dev/null || true
docker rm -f erp-frontend 2>/dev/null || true
$COMPOSE up -d --force-recreate erp

echo "[phase-212] Bundle check:"
docker exec erp-frontend sh -c '
  cd /usr/share/nginx/html/assets &&
  for s in data-trial-balance-main-loader resolveTrialBalanceMainLoaderSource unified_ledger_loader_trial_balance; do
    if grep -rl "$s" . >/dev/null 2>&1; then echo "FOUND:$s"; else echo "MISSING:$s"; fi
  done
' || true

echo "[phase-212] DONE production frontend. Trial Balance loader NOT enabled."
