#!/bin/bash
# Ensure demo user can login: try signup (creates or returns error), then force password in DB with hash from auth
set -e
ANON_KEY=$(grep '^ANON_KEY=' /root/supabase/docker/.env | cut -d= -f2-)
# Signup with same email/password (if user exists, we get "already registered" - then we must fix password in DB)
echo "Trying signup for demo@dincollection.com..."
RESP=$(curl -sk -X POST "https://erp.dincouture.pk/auth/v1/signup" \
  -H "Content-Type: application/json" \
  -H "apikey: $ANON_KEY" \
  -d '{"email":"demo@dincollection.com","password":"demo123"}')
echo "$RESP"
if echo "$RESP" | grep -q '"id"'; then
  echo "User created or already exists with this password."
  exit 0
fi
# Get bcrypt hash from a new signup (create temp user then copy hash)
echo "Creating temp user to get correct hash format..."
TMP_RESP=$(curl -sk -X POST "https://erp.dincouture.pk/auth/v1/signup" \
  -H "Content-Type: application/json" \
  -H "apikey: $ANON_KEY" \
  -d '{"email":"demotemp'$(date +%s)'@dincollection.com","password":"demo123"}')
if echo "$TMP_RESP" | grep -q '"id"'; then
  TMP_ID=$(echo "$TMP_RESP" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  HASH=$(docker exec supabase-db psql -U postgres -d postgres -t -A -c "SELECT encrypted_password FROM auth.users WHERE id = '$TMP_ID'")
  echo "Copying hash to demo user..."
  docker exec supabase-db psql -U postgres -d postgres -c "UPDATE auth.users SET encrypted_password = '$HASH', email_confirmed_at = now() WHERE email = 'demo@dincollection.com'"
  docker exec supabase-db psql -U postgres -d postgres -c "DELETE FROM auth.users WHERE id = '$TMP_ID'"
  echo "Demo password set. Login: demo@dincollection.com / demo123"
fi
