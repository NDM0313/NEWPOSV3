#!/bin/bash
# Deploy Edge Functions to self-hosted Supabase on VPS.
# Run from project root on VPS: cd /root/NEWPOSV3 && bash deploy/deploy-edge-functions-vps.sh
# Or from local: ssh dincouture-vps "cd /root/NEWPOSV3 && git pull && bash deploy/deploy-edge-functions-vps.sh"

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

FUNCTIONS_VOLUME="${FUNCTIONS_VOLUME:-/root/supabase/docker/volumes/functions}"
EDGE_CONTAINER="${EDGE_CONTAINER:-supabase-edge-functions}"

if [ ! -d "$FUNCTIONS_VOLUME" ]; then
  echo "[edge-functions] Volume not found: $FUNCTIONS_VOLUME. Skipping."
  exit 0
fi

echo "[edge-functions] Deploying to $FUNCTIONS_VOLUME..."

for fn in create-erp-user user-admin-actions; do
  src="$ROOT/supabase/functions/$fn"
  dst="$FUNCTIONS_VOLUME/$fn"
  if [ -f "$src/index.ts" ]; then
    mkdir -p "$dst"
    cp "$src/index.ts" "$dst/"
    echo "[edge-functions] Deployed $fn"
  else
    echo "[edge-functions] Skip $fn (no index.ts)"
  fi
done

if docker ps --format '{{.Names}}' | grep -q "^${EDGE_CONTAINER}$"; then
  echo "[edge-functions] Verifying env (SUPABASE_URL, SERVICE_ROLE_KEY)..."
  docker exec "$EDGE_CONTAINER" sh -c 'echo "SUPABASE_URL=${SUPABASE_URL:-MISSING}" && echo "SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY:+SET}"' 2>/dev/null || true
  echo "[edge-functions] Restarting $EDGE_CONTAINER..."
  docker restart "$EDGE_CONTAINER"
  echo "[edge-functions] Done."
else
  echo "[edge-functions] Container $EDGE_CONTAINER not running. Start Supabase stack to enable functions."
fi
