#!/usr/bin/env bash
# Read-only VPS diagnosis: Realtime WebSocket upgrade via Kong (401 vs 101).
# Usage:
#   ssh dincouture-vps "bash -s" < deploy/diagnose-realtime-ws-vps.sh
#   cd /root/NEWPOSV3 && bash deploy/diagnose-realtime-ws-vps.sh

set -euo pipefail

SUPABASE_HOST="${SUPABASE_HOST:-https://supabase.dincouture.pk}"
KONG_YML="${KONG_YML:-/root/supabase/docker/volumes/api/kong.yml}"
ENV_FILE="${ENV_FILE:-/root/supabase/docker/.env}"

echo "=== Realtime WebSocket VPS diagnosis ==="
echo "Supabase: $SUPABASE_HOST"
echo ""

# Resolve anon key from Supabase docker env or ERP production env
ANON=""
if [ -f "$ENV_FILE" ]; then
  ANON="$(grep -E '^ANON_KEY=' "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
fi
if [ -z "$ANON" ] && [ -f /root/NEWPOSV3/.env.production ]; then
  ANON="$(grep -E '^VITE_SUPABASE_ANON_KEY=' /root/NEWPOSV3/.env.production 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
fi
if [ -z "$ANON" ]; then
  echo "WARN: Could not read ANON_KEY — set ANON env var and re-run."
else
  echo "Anon key: ${ANON:0:20}... (${#ANON} chars)"
fi
echo ""

echo "--- Kong container ---"
docker ps --format 'table {{.Names}}\t{{.Status}}' 2>/dev/null | grep -E 'kong|realtime' || docker ps | grep -E 'kong|realtime' || true
echo ""

echo "--- WS upgrade probe (GET + header apikey) ---"
if [ -n "$ANON" ]; then
  CODE="$(curl -s --max-time 8 -o /dev/null -w '%{http_code}' \
    -H "apikey: $ANON" \
    -H "Upgrade: websocket" \
    -H "Connection: Upgrade" \
    -H "Sec-WebSocket-Version: 13" \
    -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
    "${SUPABASE_HOST}/realtime/v1/websocket?apikey=${ANON}&vsn=2.0.0" 2>&1 || echo "000")"
  echo "HTTP status: $CODE"
  if [ "$CODE" = "101" ]; then
    echo "RESULT: 101 Switching Protocols — Kong accepts WS upgrade"
  elif [ "$CODE" = "401" ]; then
    echo "RESULT: 401 — Kong key-auth rejecting WS (run fix-kong-realtime-key-auth.sh)"
  elif [ "$CODE" = "400" ]; then
    echo "RESULT: 400 from realtime upstream — Kong passed key-auth (browser WS should work)"
  else
    echo "RESULT: unexpected status $CODE"
  fi
fi
echo ""

echo "--- WS upgrade probe (query apikey only) ---"
if [ -n "$ANON" ]; then
  QCODE="$(curl -s --max-time 8 -o /dev/null -w '%{http_code}' \
    -H "Upgrade: websocket" \
    -H "Connection: Upgrade" \
    -H "Sec-WebSocket-Version: 13" \
    -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
    "${SUPABASE_HOST}/realtime/v1/websocket?apikey=${ANON}&vsn=2.0.0" 2>&1 || echo "000")"
  echo "HTTP status: $QCODE"
  if [ "$QCODE" = "401" ]; then
    echo "RESULT: 401 — query-only rejected; Vite proxy must forward apikey header"
  fi
fi
echo ""

echo "--- Recent Kong realtime logs ---"
docker logs supabase-kong --tail 80 2>&1 | grep -i realtime || echo "(no realtime lines in last 80)"
echo ""

echo "--- kong.yml realtime service block ---"
if [ -f "$KONG_YML" ]; then
  awk '/realtime-v1|\/realtime\/v1\//{p=1} p{print} p && /^  - name:/ && !/\/realtime\//{if(++c>1)exit}' "$KONG_YML" 2>/dev/null | head -60 || \
    grep -A40 'realtime' "$KONG_YML" | head -60 || echo "(could not extract block)"
else
  echo "Missing $KONG_YML"
fi
echo ""

echo "--- Realtime container logs (last 30) ---"
docker logs supabase-realtime --tail 30 2>&1 || docker logs realtime-dev.supabase-realtime --tail 30 2>&1 || echo "(realtime container not found by default name)"
echo ""

echo "--- Storage-api (parallel: product images 503) ---"
docker logs supabase-storage --tail 20 2>&1 || echo "(storage container not found)"
echo ""
echo "=== Done ==="
