#!/usr/bin/env bash
# Read-only VPS diagnosis: Storage API via Kong (503 / name resolution failed).
# Usage:
#   ssh dincouture-vps "bash -s" < deploy/diagnose-storage-vps.sh
#   cd /root/NEWPOSV3 && bash deploy/diagnose-storage-vps.sh

set -euo pipefail

SUPABASE_HOST="${SUPABASE_HOST:-https://supabase.dincouture.pk}"
KONG_YML="${KONG_YML:-/root/supabase/docker/volumes/api/kong.yml}"
ENV_FILE="${ENV_FILE:-/root/supabase/docker/.env}"

echo "=== Storage VPS diagnosis ==="
echo "Supabase: $SUPABASE_HOST"
echo ""

ANON=""
if [ -f "$ENV_FILE" ]; then
  ANON="$(grep -E '^ANON_KEY=' "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
fi
if [ -z "$ANON" ] && [ -f /root/NEWPOSV3/.env.production ]; then
  ANON="$(grep -E '^VITE_SUPABASE_ANON_KEY=' /root/NEWPOSV3/.env.production 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
fi
if [ -n "$ANON" ]; then
  echo "Anon key: ${ANON:0:20}... (${#ANON} chars)"
else
  echo "WARN: Could not read ANON_KEY"
fi
echo ""

echo "--- Storage-related containers ---"
docker ps --format 'table {{.Names}}\t{{.Status}}' 2>/dev/null | grep -iE 'storage|kong' || docker ps | grep -iE 'storage|kong' || true
echo ""

echo "--- kong.yml storage-v1 block ---"
if [ -f "$KONG_YML" ]; then
  awk '/- name: storage-v1/{p=1} p{print} p && /^  - name:/ && !/storage-v1/{exit}' "$KONG_YML" 2>/dev/null | head -25 || \
    grep -A20 'storage-v1' "$KONG_YML" | head -25
else
  echo "Missing $KONG_YML"
fi
echo ""

echo "--- Upstream probe from Kong container ---"
CANDIDATES=(
  "http://storage:5000/status"
  "http://supabase-storage:5000/status"
  "http://storage-dev.supabase-storage:5000/status"
  "http://storage:5000/"
  "http://supabase-storage:5000/"
)
for url in "${CANDIDATES[@]}"; do
  CODE="$(docker exec supabase-kong wget -q -O /dev/null -S "$url" 2>&1 | grep 'HTTP/' | tail -1 | awk '{print $2}' || echo 'fail')"
  if [ "$CODE" = "fail" ] || [ -z "$CODE" ]; then
    echo "  $url -> unreachable"
  else
    echo "  $url -> HTTP $CODE"
  fi
done
echo ""

echo "--- Public bucket list (authenticated) ---"
if [ -n "$ANON" ]; then
  BCODE="$(curl -s --max-time 10 -o /dev/null -w '%{http_code}' \
    -H "apikey: $ANON" \
    -H "Authorization: Bearer $ANON" \
    "${SUPABASE_HOST}/storage/v1/bucket" 2>&1 || echo "000")"
  echo "GET /storage/v1/bucket -> HTTP $BCODE"
  if [ "$BCODE" = "200" ]; then
    echo "RESULT: Storage API reachable via Kong"
  elif [ "$BCODE" = "503" ]; then
    echo "RESULT: 503 — Kong upstream or storage-api unhealthy"
  else
    echo "RESULT: unexpected status $BCODE"
  fi
fi
echo ""

echo "--- Recent Kong storage logs ---"
docker logs supabase-kong --tail 60 2>&1 | grep -iE 'storage|name resolution' | tail -15 || echo "(no storage lines)"
echo ""

STORAGE_CONTAINER=""
for name in supabase-storage storage storage-dev.supabase-storage; do
  if docker ps --format '{{.Names}}' | grep -qx "$name" 2>/dev/null; then
    STORAGE_CONTAINER="$name"
    break
  fi
done
if [ -z "$STORAGE_CONTAINER" ]; then
  STORAGE_CONTAINER="$(docker ps --format '{{.Names}}' | grep -i storage | head -1 || true)"
fi

echo "--- Storage container logs (${STORAGE_CONTAINER:-none}) ---"
if [ -n "$STORAGE_CONTAINER" ]; then
  docker logs "$STORAGE_CONTAINER" --tail 40 2>&1 || true
else
  echo "(no storage container found)"
fi
echo ""

if [ -n "$STORAGE_CONTAINER" ]; then
  echo "--- Storage env (STORAGE/S3/DB hints) ---"
  docker inspect "$STORAGE_CONTAINER" --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | \
    grep -iE '^STORAGE|^GLOBAL_S3|^DATABASE|^FILE_' | head -20 || true
fi
echo ""
echo "=== Done ==="
