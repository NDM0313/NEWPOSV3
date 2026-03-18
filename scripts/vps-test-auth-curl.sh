#!/bin/bash
# Test login from VPS (backend). Run on VPS: bash scripts/vps-test-auth-curl.sh
set -e
[ -f /root/supabase/docker/.env ] && source /root/supabase/docker/.env 2>/dev/null
ANON_KEY="${ANON_KEY:-$(docker exec supabase-kong printenv SUPABASE_ANON_KEY 2>/dev/null | tr -d '\r\n')}"
[ -z "$ANON_KEY" ] && echo "ANON_KEY not set" && exit 1
echo "Testing auth for ndm313@yahoo.com / 123456 ..."
R=$(curl -sk -X POST "https://supabase.dincouture.pk/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"ndm313@yahoo.com","password":"123456"}')
if echo "$R" | grep -q '"access_token"'; then
  echo "OK: Backend login successful (token received)"
else
  echo "FAIL: $R"
fi
