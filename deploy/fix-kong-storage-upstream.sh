#!/usr/bin/env bash
# Fix Storage 503 / "name resolution failed" on /storage/v1/*.
# Root cause is usually supabase-storage container stopped; Kong DNS for `storage:5000` fails.
# Run on VPS: bash deploy/fix-kong-storage-upstream.sh

set -euo pipefail

KONG_YML="${KONG_YML:-/root/supabase/docker/volumes/api/kong.yml}"
SUPABASE_DIR="${SUPABASE_DIR:-/root/supabase/docker}"

echo "[fix-storage] Ensuring storage-api container is running..."

if [ ! -f "$SUPABASE_DIR/docker-compose.yml" ]; then
  echo "[fix-storage] Missing $SUPABASE_DIR/docker-compose.yml"
  exit 1
fi

(cd "$SUPABASE_DIR" && docker compose up -d storage imgproxy rest 2>&1) || true

echo "[fix-storage] Waiting for storage health..."
for i in $(seq 1 30); do
  STATUS="$(docker inspect supabase-storage --format '{{.State.Health.Status}}' 2>/dev/null || echo 'missing')"
  if [ "$STATUS" = "healthy" ]; then
    echo "[fix-storage] supabase-storage is healthy"
    break
  fi
  if [ "$STATUS" = "missing" ]; then
    echo "[fix-storage] WARN: supabase-storage container not found after compose up"
    docker ps -a | grep -i storage || true
    exit 1
  fi
  [ "$i" -eq 30 ] && { echo "[fix-storage] WARN: storage not healthy after 30s"; docker logs supabase-storage --tail 20 2>&1 || true; exit 1; }
  sleep 1
done

echo "[fix-storage] Probing upstream from Kong..."
WORKING=""
for url in "http://storage:5000/status" "http://supabase-storage:5000/status"; do
  if docker exec supabase-kong wget -q -O /dev/null -S "$url" 2>&1 | grep -q '200 OK'; then
    WORKING="$url"
    echo "[fix-storage] OK $url"
    break
  fi
done

if [ -z "$WORKING" ]; then
  echo "[fix-storage] ERROR: Kong cannot reach storage upstream"
  exit 1
fi

# Patch kong.yml url if it points at a dead hostname (keep storage:5000 when compose service name is storage)
if [ -f "$KONG_YML" ]; then
  CURRENT="$(grep -A1 'name: storage-v1$' "$KONG_YML" | grep 'url:' | head -1 | awk '{print $2}' || true)"
  DESIRED="http://storage:5000/"
  if echo "$WORKING" | grep -q 'supabase-storage'; then
    DESIRED="http://supabase-storage:5000/"
  fi
  if [ -n "$CURRENT" ] && [ "$CURRENT" != "$DESIRED" ]; then
    cp "$KONG_YML" "${KONG_YML}.bak.$(date +%Y%m%d%H%M%S)"
    sed -i "s|url: http://storage:5000/|url: $DESIRED|" "$KONG_YML" 2>/dev/null || true
    sed -i "s|url: http://supabase-storage:5000/|url: $DESIRED|" "$KONG_YML" 2>/dev/null || true
    echo "[fix-storage] Patched storage-v1 url -> $DESIRED"
    (cd "$SUPABASE_DIR" && docker compose up -d kong --force-recreate 2>&1) || true
  else
    echo "[fix-storage] kong.yml storage-v1 url OK ($CURRENT)"
  fi
fi

# Ensure localhost dev CORS on Kong (idempotent)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
if [ -f "$ROOT/deploy/add-kong-cors-erp-origin.sh" ]; then
  bash "$ROOT/deploy/add-kong-cors-erp-origin.sh" || true
fi

echo "[fix-storage] Done. Run: bash deploy/diagnose-storage-vps.sh"
