#!/bin/bash
# Fix "name resolution failed" or 503 on https://supabase.dincouture.pk/backup
# Kong proxies /backup to erp-backup-page; if that container isn't running or nginx fails, you get 503.
# Run on VPS: cd /root/NEWPOSV3 && bash deploy/fix-backup-name-resolution.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

echo "[fix-backup] Ensuring backup-page container is on supabase_default and serving..."

# Ensure network exists (Supabase stack usually creates it)
docker network inspect supabase_default &>/dev/null || {
  echo "[fix-backup] WARN: supabase_default network not found. Start Supabase stack first (e.g. cd /root/supabase/docker && docker compose up -d)."
  exit 1
}

# Compose must run from project root so ./backup-page resolves to deploy/backup-page (compose file dir = deploy/)
COMPOSE_CMD="docker compose -f deploy/docker-compose.prod.yml"
[ -f .env.production ] && COMPOSE_CMD="$COMPOSE_CMD --env-file .env.production"

# Force recreate so volumes and network are correct; ensures nginx gets the right files
$COMPOSE_CMD up -d --force-recreate backup-page

echo "[fix-backup] Waiting for nginx to be healthy..."
for i in 1 2 3 4 5 6 7 8 9 10; do
  if docker exec erp-backup-page wget -q --spider http://localhost:80/ 2>/dev/null; then
    echo "[fix-backup] backup-page is responding."
    break
  fi
  [ "$i" -eq 10 ] && { echo "[fix-backup] WARN: nginx inside container not responding. Check: docker logs erp-backup-page"; exit 1; }
  sleep 1
done

# Re-add Kong route and reload Kong (in case route was missing or Kong cached bad DNS)
if [ -f deploy/add-kong-backup-route.sh ]; then
  bash deploy/add-kong-backup-route.sh
fi

echo "[fix-backup] Testing https://supabase.dincouture.pk/backup ..."
HTTP=$(curl -sS -o /dev/null -w "%{http_code}" "https://supabase.dincouture.pk/backup" 2>/dev/null || echo "000")
if [ "$HTTP" = "200" ]; then
  echo "[fix-backup] OK – backup page returns 200. Open https://supabase.dincouture.pk/backup"
else
  echo "[fix-backup] Got HTTP $HTTP. Run: bash deploy/debug-backup-403.sh (or check Kong logs: docker logs supabase-kong 2>&1 | tail -30)"
fi
