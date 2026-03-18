#!/bin/bash
# Verify login 401 fix: health, token (admin + ndm313), report pass/fail.
# Run on VPS: bash deploy/verify-login-401-fix.sh
set -e
SUPABASE_ENV="${SUPABASE_ENV:-/root/supabase/docker/.env}"
KEY=$(grep '^ANON_KEY=' "$SUPABASE_ENV" 2>/dev/null | cut -d= -f2- | tr -d '\n\r')
[ -z "$KEY" ] && echo "FAIL: ANON_KEY not found" && exit 1
echo "Testing with anon key length: ${#KEY}"

HEALTH=$(curl -sk -o /dev/null -w '%{http_code}' -H "apikey: $KEY" "https://supabase.dincouture.pk/auth/v1/health")
echo -n "health: $HEALTH "
[ "$HEALTH" = "200" ] && echo "OK" || echo "FAIL"

TOKEN_ADMIN=$(curl -sk -X POST "https://supabase.dincouture.pk/auth/v1/token?grant_type=password" \
  -H "apikey: $KEY" -H "Content-Type: application/json" \
  -d '{"email":"admin@dincouture.pk","password":"AdminDincouture2026"}')
if echo "$TOKEN_ADMIN" | grep -q '"access_token"'; then
  echo "admin@dincouture.pk: OK"
else
  echo "admin@dincouture.pk: FAIL ($TOKEN_ADMIN)"
fi

TOKEN_NDM=$(curl -sk -X POST "https://supabase.dincouture.pk/auth/v1/token?grant_type=password" \
  -H "apikey: $KEY" -H "Content-Type: application/json" \
  -d '{"email":"ndm313@yahoo.com","password":"123456"}')
if echo "$TOKEN_NDM" | grep -q '"access_token"'; then
  echo "ndm313@yahoo.com: OK"
else
  echo "ndm313@yahoo.com: FAIL"
fi

ADMIN_OK=false; NDM_OK=false
echo "$TOKEN_ADMIN" | grep -q '"access_token"' && ADMIN_OK=true
echo "$TOKEN_NDM" | grep -q '"access_token"' && NDM_OK=true
if [ "$HEALTH" = "200" ] && ( $ADMIN_OK || $NDM_OK ); then
  echo "VERIFICATION PASSED"
else
  echo "VERIFICATION FAILED (health must be 200 and at least one login must succeed)"
fi
