#!/bin/bash
# R5a — production frontend deploy (toolkit + docs sync). NO flag SQL. NO migrations.
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/root/NEWPOSV3}"
BUILD_LABEL="${BUILD_LABEL:-phase-r5a-prod}"
ROLLBACK_TAG="erp-frontend:rollback-before-r5a-$(date +%Y%m%d%H%M%S)"
DIN_CHINA_ID="30bd8592-3384-4f34-899a-f3907e336485"
DIN_BRIDAL_ID="597a5292-14c8-4cd8-96bd-c61b5a0d8c92"

cd "$DEPLOY_DIR"

echo "[r5a-deploy] git pull:"
git pull --ff-only

echo "[r5a-deploy] git HEAD:"
git rev-parse --short HEAD

docker tag erp-frontend:latest "$ROLLBACK_TAG" 2>/dev/null || true
echo "[r5a-deploy] rollback tag: $ROLLBACK_TAG"

bash deploy/write-erp-env-from-supabase-docker-env.sh
export VITE_BUILD_COMMIT="$BUILD_LABEL"
export CACHEBUST=$(date +%s)
grep -v '^CACHEBUST=' .env.production 2>/dev/null | grep -v '^VITE_BUILD_COMMIT=' > .env.production.tmp || true
echo "CACHEBUST=$CACHEBUST" >> .env.production.tmp
echo "VITE_BUILD_COMMIT=$VITE_BUILD_COMMIT" >> .env.production.tmp
mv .env.production.tmp .env.production

echo "[r5a-deploy] DIN CHINA unified flags (must be 12 ON):"
docker exec -i supabase-db psql -U postgres -d postgres -t -A -c \
  "SELECT COUNT(*) FROM feature_flags WHERE company_id = '${DIN_CHINA_ID}' AND feature_key LIKE 'unified_ledger%' AND enabled = true;"

echo "[r5a-deploy] DIN BRIDAL unified flags (must be 0 until R5 sign-off):"
docker exec -i supabase-db psql -U postgres -d postgres -t -A -c \
  "SELECT COUNT(*) FROM feature_flags WHERE company_id = '${DIN_BRIDAL_ID}' AND feature_key LIKE 'unified_ledger%' AND enabled = true;"

echo "[r5a-deploy] Other-company loaders enabled (must be 0):"
docker exec -i supabase-db psql -U postgres -d postgres -t -A -c \
  "SELECT c.name, ff.feature_key FROM feature_flags ff JOIN companies c ON c.id = ff.company_id WHERE ff.company_id NOT IN ('${DIN_CHINA_ID}') AND ff.feature_key LIKE 'unified_ledger_loader_%' AND ff.enabled = true;"

COMPOSE="docker compose -f deploy/docker-compose.prod.yml --env-file .env.production"
$COMPOSE build erp

docker kill erp-frontend 2>/dev/null || true
docker rm -f erp-frontend 2>/dev/null || true
$COMPOSE up -d --force-recreate erp

echo "[r5a-deploy] R5a toolkit present:"
test -f scripts/single-core-ledger/r5-company-config.json && echo "  r5-company-config.json OK"
test -f scripts/single-core-ledger/din-bridal/r5-preflight-flags.sql && echo "  din-bridal/r5-preflight-flags.sql OK"

echo "[r5a-deploy] DONE — frontend only. No flags changed."
