#!/bin/bash
# E2E: signup + create_business_transaction for din@yahoo.com (VPS)
# Run: bash scripts/diagnostics/signup-e2e-din-yahoo.sh
set -euo pipefail

ENV_FILE="${SUPABASE_ENV:-/root/supabase/docker/.env}"
BASE="${BASE_URL:-https://supabase.dincouture.pk}"
EMAIL="${TEST_EMAIL:-din@yahoo.com}"
PASSWORD="${TEST_PASSWORD:-CreateBizTest123!}"
OWNER="${TEST_OWNER:-Din Test Owner}"
BUSINESS="${TEST_BUSINESS:-Din Couture Test Co}"

ANON=$(grep '^ANON_KEY=' "$ENV_FILE" 2>/dev/null | head -1 | sed 's/^ANON_KEY=//' | tr -d '\r"')
if [ -z "$ANON" ]; then
  echo "FAIL: ANON_KEY missing"
  exit 1
fi

cleanup() {
  local uid
  uid=$(docker exec supabase-db psql -U postgres -d postgres -t -A -c \
    "SELECT id FROM auth.users WHERE LOWER(email) = LOWER('$EMAIL') LIMIT 1;" 2>/dev/null || true)
  if [ -n "$uid" ]; then
    docker exec supabase-db psql -U postgres -d postgres -c \
      "DELETE FROM public.user_branches WHERE user_id = '$uid';
       DELETE FROM public.users WHERE auth_user_id = '$uid' OR id = '$uid';
       DELETE FROM auth.identities WHERE user_id = '$uid';
       DELETE FROM auth.users WHERE id = '$uid';" 2>/dev/null || true
    echo "Cleaned prior test user $EMAIL"
  fi
}

echo "=== E2E Create Business: $EMAIL ==="
cleanup

echo "=== Step 1: signUp ==="
SIGNUP=$(curl -sk -X POST "$BASE/auth/v1/signup" \
  -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"data\":{\"full_name\":\"$OWNER\"}}")

TOKEN=$(echo "$SIGNUP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('access_token',''))" 2>/dev/null || true)
USER_ID=$(echo "$SIGNUP" | python3 -c "import sys,json; d=json.load(sys.stdin); u=d.get('user') or {}; print(u.get('id',''))" 2>/dev/null || true)

if [ -z "$TOKEN" ] || [ -z "$USER_ID" ]; then
  echo "FAIL signUp: $SIGNUP"
  exit 1
fi
echo "OK signUp user_id=$USER_ID"

echo "=== Step 2: create_business_transaction RPC ==="
RPC_BODY=$(cat <<EOF
{
  "p_business_name": "$BUSINESS",
  "p_owner_name": "$OWNER",
  "p_email": "$EMAIL",
  "p_password": "$PASSWORD",
  "p_user_id": "$USER_ID",
  "p_currency": "PKR",
  "p_branch_name": "Main Branch",
  "p_branch_code": "HQ",
  "p_branch_city": "Peshawar",
  "p_branch_state": "KPK"
}
EOF
)

RPC=$(curl -sk -X POST "$BASE/rest/v1/rpc/create_business_transaction" \
  -H "apikey: $ANON" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "$RPC_BODY")

echo "$RPC" | head -c 400
echo ""

SUCCESS=$(echo "$RPC" | python3 -c "import sys,json; d=json.load(sys.stdin); print('true' if d.get('success') else 'false')" 2>/dev/null || echo "false")
if [ "$SUCCESS" != "true" ]; then
  echo "FAIL RPC"
  cleanup
  exit 1
fi
echo "OK RPC"

echo "=== Step 3: verify public.users link ==="
docker exec supabase-db psql -U postgres -d postgres -c \
  "SELECT u.email, u.company_id IS NOT NULL AS has_company, c.name AS company_name
   FROM public.users u
   LEFT JOIN public.companies c ON c.id = u.company_id
   WHERE LOWER(u.email) = LOWER('$EMAIL');"

echo "=== Step 4: signIn ==="
LOGIN=$(curl -sk -X POST "$BASE/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
if echo "$LOGIN" | grep -q access_token; then
  echo "OK signIn"
else
  echo "FAIL signIn: $LOGIN"
  exit 1
fi

echo ""
echo "E2E PASSED for $EMAIL — user can Create Business from localhost with this password if using synced anon key."
