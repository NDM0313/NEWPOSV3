#!/bin/bash
# Signup probe — run on VPS: bash /tmp/diagnose-signup-curl.sh
set -e
ENV_FILE="${SUPABASE_ENV:-/root/supabase/docker/.env}"
ANON=$(grep '^ANON_KEY=' "$ENV_FILE" 2>/dev/null | head -1 | sed 's/^ANON_KEY=//' | tr -d '\r"')
BASE="${BASE_URL:-https://supabase.dincouture.pk}"

if [ -z "$ANON" ]; then
  echo "FAIL: ANON_KEY not found in $ENV_FILE"
  exit 1
fi

echo "=== Auth settings (disable_signup?) ==="
curl -sk -H "apikey: $ANON" "$BASE/auth/v1/settings" | head -c 500
echo ""
echo ""

TS=$(date +%s)
PROBE_EMAIL="probe-${TS}@test.local"
echo "=== Fresh signup probe: $PROBE_EMAIL ==="
curl -sk -w "\nHTTP_CODE:%{http_code}\n" -X POST "$BASE/auth/v1/signup" \
  -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d "{\"email\":\"$PROBE_EMAIL\",\"password\":\"TestPass123!\"}"
echo ""

echo "=== din@yahoo.com signup test ==="
curl -sk -w "\nHTTP_CODE:%{http_code}\n" -X POST "$BASE/auth/v1/signup" \
  -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d '{"email":"din@yahoo.com","password":"TestPass123!"}'
echo ""

# Cleanup probe user if created
PROBE_ID=$(docker exec supabase-db psql -U postgres -d postgres -t -A -c \
  "SELECT id FROM auth.users WHERE email = '$PROBE_EMAIL' LIMIT 1;" 2>/dev/null || true)
if [ -n "$PROBE_ID" ]; then
  echo "=== Cleanup probe user $PROBE_EMAIL ($PROBE_ID) ==="
  docker exec supabase-db psql -U postgres -d postgres -c \
    "DELETE FROM auth.identities WHERE user_id = '$PROBE_ID'; DELETE FROM auth.users WHERE id = '$PROBE_ID';" 2>/dev/null || true
  echo "Probe user deleted."
fi

echo "=== Recent supabase-auth logs ==="
docker logs supabase-auth --tail 20 2>&1 || true
