#!/usr/bin/env bash
# Replace localhost-only ip-restriction on Kong /mcp with key-auth + admin ACL
# so Cursor (remote IP) can connect with SERVICE_ROLE_KEY in apikey header.
#
# Run on VPS:
#   cd /root/NEWPOSV3 && bash deploy/fix-kong-mcp-key-auth.sh
#
# After patch, set ~/.cursor/mcp.json:
#   "supabase": { "url": "https://supabase.dincouture.pk/mcp", "headers": { "apikey": "<SERVICE_ROLE_KEY>" } }
#
set -euo pipefail

KONG_YML="${KONG_YML:-/root/supabase/docker/volumes/api/kong.yml}"
SUPABASE_DIR="${SUPABASE_DIR:-/root/supabase/docker}"
SUPABASE_ENV="${SUPABASE_ENV:-$SUPABASE_DIR/.env}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MCP_URL="${MCP_URL:-https://supabase.dincouture.pk/mcp}"

echo "=== Fix Kong MCP key-auth ==="

if [ ! -f "$KONG_YML" ]; then
  echo "[FAIL] Missing $KONG_YML"
  exit 1
fi

BAK="${KONG_YML}.bak-mcp-keyauth-$(date +%Y%m%d-%H%M%S)"
cp "$KONG_YML" "$BAK"
echo "[OK] Backup: $BAK"

python3 "$SCRIPT_DIR/fix-kong-mcp-key-auth.py" "$KONG_YML"

echo "[fix-kong-mcp-key-auth] Reloading Kong..."
if docker exec supabase-kong kong reload 2>/dev/null; then
  echo "[OK] kong reload"
else
  echo "[WARN] kong reload failed — recreating container..."
  (cd "$SUPABASE_DIR" && docker compose up -d kong --force-recreate)
fi

sleep 2

echo "[verify] POST without apikey (expect 401)..."
CODE_NO_KEY=$(curl -s -o /tmp/mcp-nokey.json -w '%{http_code}' -X POST "$MCP_URL" \
  -H 'Content-Type: application/json' -d '{}' || true)
echo "  HTTP $CODE_NO_KEY"
if [ "$CODE_NO_KEY" = "403" ]; then
  echo "[FAIL] Still getting 403 without key — ip-restriction may still be active."
  exit 1
fi

if [ ! -f "$SUPABASE_ENV" ]; then
  echo "[WARN] $SUPABASE_ENV not found — skip authenticated verify."
  exit 0
fi

# shellcheck disable=SC1090
SRK=""
if [ -f "$SUPABASE_ENV" ]; then
  SRK="$(grep '^SERVICE_ROLE_KEY=' "$SUPABASE_ENV" | cut -d= -f2- | tr -d '"' | tr -d '\r' || true)"
fi
if [ -z "$SRK" ]; then
  echo "[WARN] SERVICE_ROLE_KEY not set in $SUPABASE_ENV — skip authenticated verify."
  exit 0
fi

echo "[verify] POST with SERVICE_ROLE_KEY (expect non-403)..."
CODE_KEY=$(curl -s -o /tmp/mcp-key.json -w '%{http_code}' -X POST "$MCP_URL" \
  -H 'Content-Type: application/json' \
  -H "apikey: $SRK" \
  -d '{}' || true)
echo "  HTTP $CODE_KEY"
if [ "$CODE_KEY" = "403" ]; then
  echo "[FAIL] Still 403 with service role key."
  head -c 200 /tmp/mcp-key.json 2>/dev/null || true
  echo
  exit 1
fi

echo "[OK] MCP route accepts remote requests with apikey."
echo "[next] Add apikey header to Cursor ~/.cursor/mcp.json supabase server entry."
