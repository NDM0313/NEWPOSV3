#!/bin/bash
# Combined auth diagnostic: 401 vs 502 vs invalid_credentials vs network/CORS.
# Run on VPS: bash deploy/diagnose-auth-full.sh
# Use to distinguish: 401 = key/auth, 502 = upstream/gateway, invalid_credentials = user/password, network = frontend transport.
set -e
SUPABASE_ENV="${SUPABASE_ENV:-/root/supabase/docker/.env}"
ERP_ENV="${ERP_ENV:-/root/NEWPOSV3/.env.production}"
KONG_YML="${KONG_YML:-/root/supabase/docker/volumes/api/kong.yml}"
BASE_URL="${BASE_URL:-https://supabase.dincouture.pk}"

echo "========== ENV CONSISTENCY =========="
for f in "$SUPABASE_ENV" "$ERP_ENV"; do
  [ -f "$f" ] && echo "OK $f" || echo "MISSING $f"
done
ANON=$(grep '^ANON_KEY=' "$SUPABASE_ENV" 2>/dev/null | cut -d= -f2- | tr -d '\n\r')
VITE_ANON=$(grep '^VITE_SUPABASE_ANON_KEY=' "$ERP_ENV" 2>/dev/null | cut -d= -f2- | tr -d '\n\r')
echo "ANON_KEY length: ${#ANON}, VITE_SUPABASE_ANON_KEY length: ${#VITE_ANON}"
[ -n "$ANON" ] && [ "$ANON" = "$VITE_ANON" ] && echo "OK Keys match" || echo "WARN Keys differ"
echo ""

echo "========== KONG ROUTE HEALTH =========="
docker ps --format '{{.Names}} {{.Status}}' 2>/dev/null | grep -E 'kong|auth|rest' || true
KONG_KEY=$(docker exec supabase-kong printenv SUPABASE_ANON_KEY 2>/dev/null | tr -d '\n\r')
echo "Kong SUPABASE_ANON_KEY length: ${#KONG_KEY}"
KEY="${ANON:-$KONG_KEY}"
echo ""

echo "========== AUTH UPSTREAM (in-container) =========="
docker exec supabase-auth wget -qO- --no-check-certificate http://localhost:9999/health 2>/dev/null | head -c 120 || echo "FAIL"
echo ""
echo ""

echo "========== REST UPSTREAM (in-container) =========="
docker exec supabase-rest wget -qO- --no-check-certificate http://localhost:3000/ 2>/dev/null | head -c 80 || echo "FAIL"
echo ""
echo ""

echo "========== PUBLIC HEALTH (with apikey) =========="
CODE=""
[ -n "$KEY" ] && CODE=$(curl -sk -o /dev/null -w '%{http_code}' -H "apikey: $KEY" "$BASE_URL/auth/v1/health") && echo "GET $BASE_URL/auth/v1/health -> $CODE" || echo "FAIL or no key"
[ "$CODE" = "200" ] && echo "  -> 200 = Kong + Auth OK (not 401/502)" || true
[ "$CODE" = "401" ] && echo "  -> 401 = Kong key-auth or ACL issue" || true
[ "$CODE" = "502" ] && echo "  -> 502 = Kong down or upstream unreachable" || true
[ "$CODE" = "404" ] && echo "  -> 404 = Kong route not matched (check kong.yml auth-v1 service)" || true
echo ""

echo "========== PUBLIC REST (with apikey) =========="
[ -n "$KEY" ] && RCODE=$(curl -sk -o /dev/null -w '%{http_code}' -H "apikey: $KEY" -H "Accept: application/json" "$BASE_URL/rest/v1/") && echo "GET $BASE_URL/rest/v1/ -> $RCODE" || echo "FAIL"
echo ""

echo "========== TOKEN ENDPOINT (password grant) =========="
TOKEN=$(curl -sk -X POST "$BASE_URL/auth/v1/token?grant_type=password" -H "apikey: $KEY" -H "Content-Type: application/json" -d '{"email":"ndm313@yahoo.com","password":"123456"}')
if echo "$TOKEN" | grep -q '"access_token"'; then
  echo "ndm313@yahoo.com: OK (login works)"
elif echo "$TOKEN" | grep -q 'invalid_credentials'; then
  echo "ndm313@yahoo.com: invalid_credentials (user/password issue, not 401/502)"
else
  echo "ndm313@yahoo.com: FAIL $TOKEN"
fi
echo ""

echo "========== AUTH.USERS COUNT =========="
docker exec supabase-db psql -U postgres -d postgres -t -c 'SELECT count(*) FROM auth.users;' 2>/dev/null || echo "FAIL"
echo ""

echo "========== FRONTEND ENV SUMMARY =========="
[ -f "$ERP_ENV" ] && echo "VITE_SUPABASE_URL=$(grep '^VITE_SUPABASE_URL=' "$ERP_ENV" 2>/dev/null | cut -d= -f2-)" || true
[ -f "$ERP_ENV" ] && echo "VITE_SUPABASE_ANON_KEY length: $(grep '^VITE_SUPABASE_ANON_KEY=' "$ERP_ENV" 2>/dev/null | cut -d= -f2- | tr -d '\n\r' | wc -c)" || true
echo ""
echo "Run full verification: bash deploy/verify-login-401-fix.sh"
