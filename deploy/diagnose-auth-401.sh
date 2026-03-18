#!/bin/bash
# Diagnostic script for login 401 / auth gateway issues.
# Run on VPS: bash deploy/diagnose-auth-401.sh
# Checks: env consistency, Kong key, GoTrue DB, auth.users, health, token.
set -e
SUPABASE_ENV="${SUPABASE_ENV:-/root/supabase/docker/.env}"
ERP_ENV="${ERP_ENV:-/root/NEWPOSV3/.env.production}"
KONG_YML="${KONG_YML:-/root/supabase/docker/volumes/api/kong.yml}"

echo "=== 1. Env files present ==="
for f in "$SUPABASE_ENV" "$ERP_ENV"; do
  [ -f "$f" ] && echo "OK $f" || echo "MISSING $f"
done

echo ""
echo "=== 2. ANON_KEY consistency ==="
ANON=$(grep '^ANON_KEY=' "$SUPABASE_ENV" 2>/dev/null | cut -d= -f2- | tr -d '\n\r')
VITE_ANON=$(grep '^VITE_SUPABASE_ANON_KEY=' "$ERP_ENV" 2>/dev/null | cut -d= -f2- | tr -d '\n\r')
echo "Supabase .env ANON_KEY length: ${#ANON}"
echo "ERP .env.production VITE_SUPABASE_ANON_KEY length: ${#VITE_ANON}"
if [ -n "$ANON" ] && [ -n "$VITE_ANON" ] && [ "$ANON" = "$VITE_ANON" ]; then
  echo "OK Keys match"
else
  echo "WARN Keys differ or missing - sync with deploy/login-401-global-fix.sh"
fi

echo ""
echo "=== 3. Kong config (key-auth on auth/rest) ==="
[ -f "$KONG_YML" ] && ( grep -q 'key: \$SUPABASE_ANON_KEY' "$KONG_YML" && echo "OK Template has anon key placeholder" || echo "WARN No anon key placeholder" )
[ -f "$KONG_YML" ] && ( grep -B20 '/auth/v1/' "$KONG_YML" | grep -q 'key-auth' && echo "OK auth-v1 has key-auth" || echo "WARN auth-v1 missing key-auth - add with add-kong-key-auth-to-auth-rest.py or sed" )

echo ""
echo "=== 4. Kong container resolved key (first 50 chars) ==="
KONG_KEY=$(docker exec supabase-kong printenv SUPABASE_ANON_KEY 2>/dev/null | tr -d '\n\r')
echo "Length: ${#KONG_KEY}"
echo "Prefix: ${KONG_KEY:0:50}..."

echo ""
echo "=== 5. GoTrue / health (no key) - from auth container ==="
docker exec supabase-auth wget -qO- --no-check-certificate http://localhost:9999/health 2>/dev/null | head -c 200 || echo "FAIL"

echo ""
echo "=== 6. Health with apikey (public URL) ==="
KEY="${ANON:-$KONG_KEY}"
[ -n "$KEY" ] && CODE=$(curl -sk -o /dev/null -w '%{http_code}' -H "apikey: $KEY" "https://supabase.dincouture.pk/auth/v1/health") && echo "HTTP $CODE" || echo "FAIL (no key or curl error)"

echo ""
echo "=== 7. auth.users count ==="
docker exec supabase-db psql -U postgres -d postgres -t -c 'SELECT count(*) FROM auth.users;' 2>/dev/null || echo "FAIL"

echo ""
echo "=== 8. Token test (ndm313@yahoo.com) ==="
[ -n "$KEY" ] && TOKEN=$(curl -sk -X POST "https://supabase.dincouture.pk/auth/v1/token?grant_type=password" -H "apikey: $KEY" -H "Content-Type: application/json" -d '{"email":"ndm313@yahoo.com","password":"123456"}')
if echo "$TOKEN" | grep -q '"access_token"'; then
  echo "OK Login works"
else
  echo "FAIL $TOKEN"
fi
echo ""
echo "Run full verification: bash deploy/verify-login-401-fix.sh"
