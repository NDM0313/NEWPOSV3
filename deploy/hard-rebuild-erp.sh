#!/bin/bash
# Bump CACHEBUST, tear down fixed-name ERP compose containers, rebuild erp with no cache, up.
# Run from repo root on the VPS: bash deploy/hard-rebuild-erp.sh
set -euo pipefail
cd "$(dirname "$0")/.."
CACHEBUST=$(date +%s)
if grep -q '^CACHEBUST=' .env.production 2>/dev/null; then
  grep -v '^CACHEBUST=' .env.production > .env.production.tmp
else
  cp .env.production .env.production.tmp
fi
echo "CACHEBUST=$CACHEBUST" >> .env.production.tmp
mv .env.production.tmp .env.production

COMPOSE_CMD=(docker compose -f deploy/docker-compose.prod.yml --env-file .env.production)
docker kill erp-frontend erp-backup-page erp-studio-injector 2>/dev/null || true
docker rm -f erp-frontend erp-backup-page erp-studio-injector 2>/dev/null || true
"${COMPOSE_CMD[@]}" down --remove-orphans 2>/dev/null || true
docker network rm deploy_default 2>/dev/null || true
sleep 2
"${COMPOSE_CMD[@]}" build --no-cache erp
"${COMPOSE_CMD[@]}" up -d --force-recreate erp
echo "[hard-rebuild-erp] Done. CACHEBUST=$CACHEBUST"
