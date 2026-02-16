#!/usr/bin/env bash
# Ensure ERP container is running. Run from repo root (e.g. cron: */5 * * * * cd /root/NEWPOSV3 && bash scripts/vps-ensure-erp-up.sh)
set -e
cd "$(dirname "$0")/.."
if docker compose -f docker-compose.prod.yml ps --status running 2>/dev/null | grep -q erp-frontend; then
  exit 0
fi
docker compose -f docker-compose.prod.yml up -d
sleep 3
if ! docker compose -f docker-compose.prod.yml ps --status running 2>/dev/null | grep -q erp-frontend; then
  docker compose -f docker-compose.prod.yml logs --tail 30 erp-frontend 2>/dev/null || true
  exit 1
fi
exit 0
