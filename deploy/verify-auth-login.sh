#!/bin/bash
# Verify both auth users can login. Run on VPS: bash deploy/verify-auth-login.sh
set -e
ENV_FILE="${SUPABASE_ENV:-/root/supabase/docker/.env}"
[ ! -f "$ENV_FILE" ] && echo "Missing $ENV_FILE" && exit 1
ANON_KEY=$(grep -E '^ANON_KEY=' "$ENV_FILE" | cut -d= -f2- | tr -d '\r\n" ')
[ -z "$ANON_KEY" ] && echo "ANON_KEY not found in $ENV_FILE" && exit 1
API="https://127.0.0.1"
HOST="Host: supabase.dincouture.pk"

echo "=== Testing ndm313@yahoo.com ==="
R1=$(curl -sk -X POST "$API/auth/v1/token?grant_type=password" \
  -H "$HOST" -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"ndm313@yahoo.com","password":"iPhone@14max"}' 2>/dev/null)
if echo "$R1" | grep -q '"access_token"'; then
  echo "OK: ndm313@yahoo.com login successful"
else
  echo "FAIL: $R1"
fi

echo ""
echo "=== Testing admin@dincouture.pk ==="
R2=$(curl -sk -X POST "$API/auth/v1/token?grant_type=password" \
  -H "$HOST" -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"admin@dincouture.pk","password":"Admin@Dincouture2026!"}' 2>/dev/null)
if echo "$R2" | grep -q '"access_token"'; then
  echo "OK: admin@dincouture.pk login successful"
else
  echo "FAIL: $R2"
fi

echo ""
echo "Done. Use Studio: https://supabase.dincouture.pk or ERP: https://erp.dincouture.pk"
