#!/bin/bash
# Verify both auth users can login. Run on VPS: bash deploy/verify-auth-login.sh
set -e
ENV_FILE="${SUPABASE_ENV:-/root/supabase/docker/.env}"
[ ! -f "$ENV_FILE" ] && echo "Missing $ENV_FILE" && exit 1
# Use key from Kong (what it validates against); fallback to .env
if docker ps --format '{{.Names}}' | grep -q supabase-kong; then
  ANON_KEY=$(docker exec supabase-kong printenv SUPABASE_ANON_KEY 2>/dev/null | tr -d '\r\n')
fi
[ -z "$ANON_KEY" ] && ANON_KEY=$(sed -n 's/^ANON_KEY=//p' "$ENV_FILE" | head -1 | tr -d '\r\n" ')
[ -z "$ANON_KEY" ] && echo "ANON_KEY not found (Kong or $ENV_FILE)" && exit 1
# Use Traefik (same path as Studio/ERP)
API="${SUPABASE_API_URL:-https://127.0.0.1}"
HOST="Host: supabase.dincouture.pk"
CURL_OPTS="-sk"

echo "=== Testing ndm313@yahoo.com ==="
R1=$(curl $CURL_OPTS -X POST "$API/auth/v1/token?grant_type=password" \
  -H "$HOST" -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"ndm313@yahoo.com","password":"iPhone@14max"}' 2>/dev/null)
if echo "$R1" | grep -q '"access_token"'; then
  echo "OK: ndm313@yahoo.com login successful"
else
  echo "FAIL: $R1"
fi

echo ""
echo "=== Testing admin@dincouture.pk ==="
R2=$(curl $CURL_OPTS -X POST "$API/auth/v1/token?grant_type=password" \
  -H "$HOST" -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"admin@dincouture.pk","password":"AdminDincouture2026"}' 2>/dev/null)
if echo "$R2" | grep -q '"access_token"'; then
  echo "OK: admin@dincouture.pk login successful"
else
  echo "FAIL: $R2"
fi

echo ""
echo "Done. Use Studio: https://supabase.dincouture.pk or ERP: https://erp.dincouture.pk"
