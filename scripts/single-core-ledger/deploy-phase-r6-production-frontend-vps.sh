#!/bin/bash
# R6 — production frontend deploy (code only). NO flag SQL. NO migrations.
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/root/NEWPOSV3}"
BUILD_LABEL="${BUILD_LABEL:-phase-r6-prod}"
ROLLBACK_TAG="erp-frontend:rollback-before-r6-$(date +%Y%m%d%H%M%S)"
DIN_CHINA_ID="30bd8592-3384-4f34-899a-f3907e336485"

cd "$DEPLOY_DIR"

echo "[r6-deploy] git HEAD:"
git rev-parse --short HEAD

docker tag erp-frontend:latest "$ROLLBACK_TAG" 2>/dev/null || true
echo "[r6-deploy] rollback tag: $ROLLBACK_TAG"

bash deploy/write-erp-env-from-supabase-docker-env.sh
export VITE_BUILD_COMMIT="$BUILD_LABEL"
export CACHEBUST=$(date +%s)
grep -v '^CACHEBUST=' .env.production 2>/dev/null | grep -v '^VITE_BUILD_COMMIT=' > .env.production.tmp || true
echo "CACHEBUST=$CACHEBUST" >> .env.production.tmp
echo "VITE_BUILD_COMMIT=$VITE_BUILD_COMMIT" >> .env.production.tmp
mv .env.production.tmp .env.production

echo "[r6-deploy] Read-only DIN CHINA unified flags (must remain ON):"
docker exec -i supabase-db psql -U postgres -d postgres -t -A -c \
  "SELECT feature_key, enabled FROM feature_flags WHERE company_id = '${DIN_CHINA_ID}' AND feature_key LIKE 'unified_ledger%' ORDER BY feature_key;"

echo "[r6-deploy] Other-company unified loaders (must be 0 rows enabled):"
docker exec -i supabase-db psql -U postgres -d postgres -t -A -c \
  "SELECT company_id, feature_key FROM feature_flags WHERE company_id != '${DIN_CHINA_ID}' AND feature_key LIKE 'unified_ledger_loader_%' AND enabled = true;"

COMPOSE="docker compose -f deploy/docker-compose.prod.yml --env-file .env.production"
$COMPOSE build erp

docker kill erp-frontend 2>/dev/null || true
docker rm -f erp-frontend 2>/dev/null || true
$COMPOSE up -d --force-recreate erp

echo "[r6-deploy] Bundle check (R2 cash/bank diagnostic UI):"
docker exec erp-frontend sh -c "cd /usr/share/nginx/html/assets && grep -rl 'Raw GL diagnostic' . 2>/dev/null | head -1 || echo 'R2_LABEL:check_manually'" || true

echo "[r6-deploy] DONE — frontend only. No flags changed."
