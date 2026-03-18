#!/bin/bash
# Run on VPS to debug 403, 503, or "name resolution failed" on https://supabase.dincouture.pk/backup
# Fix: bash deploy/fix-backup-name-resolution.sh
# Usage: bash deploy/debug-backup-403.sh

set -e
echo "=== 1. Backup-page container (Status = unhealthy means nginx not responding) ==="
docker ps -a --filter name=erp-backup-page --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "=== 2. Request from Kong to backup-page (internal) ==="
KONG_CID=$(docker ps -q -f name=kong 2>/dev/null | head -1)
if [ -n "$KONG_CID" ]; then
  docker exec "$KONG_CID" wget -q -O - --timeout=3 http://erp-backup-page:80/ 2>&1 | head -5
  echo "(first 5 lines above; empty or error = 503 cause)"
else
  echo "Kong container not found."
fi
echo ""
echo "=== 3. Response from public URL (503 = upstream down or Kong can't reach backup-page) ==="
curl -sI "https://supabase.dincouture.pk/backup" 2>&1 | head -15
echo ""
echo "=== 4. Kong route order (backup before dashboard?) ==="
grep -n "backup-route\|backup-page\|Protected Dashboard\|dashboard" /root/supabase/docker/volumes/api/kong.yml 2>/dev/null | head -20
echo ""
echo "=== 5. Last 15 lines of backup-page logs (if 503, check for nginx errors) ==="
docker logs erp-backup-page 2>&1 | tail -15
