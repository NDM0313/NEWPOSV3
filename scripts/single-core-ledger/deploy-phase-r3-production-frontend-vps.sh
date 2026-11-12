#!/bin/bash
# R3 — production frontend deploy (code/docs sync only). NO flag SQL. NO migrations.
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/root/NEWPOSV3}"
BUILD_LABEL="${BUILD_LABEL:-phase-r3-prod}"
ROLLBACK_TAG="erp-frontend:rollback-before-r3-$(date +%Y%m%d%H%M%S)"
DIN_CHINA_ID="30bd8592-3384-4f34-899a-f3907e336485"

cd "$DEPLOY_DIR"

echo "[r3-deploy] git pull:"
git pull --ff-only

echo "[r3-deploy] git HEAD:"
git rev-parse --short HEAD

docker tag erp-frontend:latest "$ROLLBACK_TAG" 2>/dev/null || true
echo "[r3-deploy] rollback tag: $ROLLBACK_TAG"

bash deploy/write-erp-env-from-supabase-docker-env.sh
export VITE_BUILD_COMMIT="$BUILD_LABEL"
export CACHEBUST=$(date +%s)
grep -v '^CACHEBUST=' .env.production 2>/dev/null | grep -v '^VITE_BUILD_COMMIT=' > .env.production.tmp || true
echo "CACHEBUST=$CACHEBUST" >> .env.production.tmp
echo "VITE_BUILD_COMMIT=$VITE_BUILD_COMMIT" >> .env.production.tmp
mv .env.production.tmp .env.production

echo "[r3-deploy] Read-only flag audit — DIN CHINA unified flags:"
docker exec -i supabase-db psql -U postgres -d postgres -t -A -c \
  "SELECT feature_key, enabled FROM feature_flags WHERE company_id = '${DIN_CHINA_ID}' AND feature_key LIKE 'unified_ledger%' ORDER BY feature_key;"

echo "[r3-deploy] Other-company unified loaders enabled (must be 0):"
docker exec -i supabase-db psql -U postgres -d postgres -t -A -c \
  "SELECT c.name, ff.feature_key FROM feature_flags ff JOIN companies c ON c.id = ff.company_id WHERE ff.company_id != '${DIN_CHINA_ID}' AND ff.feature_key LIKE 'unified_ledger_loader_%' AND ff.enabled = true;"

COMPOSE="docker compose -f deploy/docker-compose.prod.yml --env-file .env.production"
$COMPOSE build erp

docker kill erp-frontend 2>/dev/null || true
docker rm -f erp-frontend 2>/dev/null || true
$COMPOSE up -d --force-recreate erp

echo "[r3-deploy] R3 audit scripts present:"
test -f scripts/single-core-ledger/r3-readonly-expansion-audit.sql && echo "  r3-readonly-expansion-audit.sql OK"
test -f scripts/single-core-ledger/r3-readonly-golden-baseline.sql && echo "  r3-readonly-golden-baseline.sql OK"

echo "[r3-deploy] DONE — frontend only. No flags changed."
