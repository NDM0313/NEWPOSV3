#!/bin/bash
# Create demo user in Supabase Auth (run on VPS)
set -e
ENV_FILE="${ENV_FILE:-/root/supabase/docker/.env}"
source "$ENV_FILE" 2>/dev/null || true
SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY:-$(grep SERVICE_ROLE_KEY "$ENV_FILE" 2>/dev/null | cut -d= -f2)}"
ANON_KEY="${ANON_KEY:-$(grep ANON_KEY "$ENV_FILE" 2>/dev/null | cut -d= -f2)}"
BASE="${BASE:-https://erp.dincouture.pk}"
if [ -z "$SERVICE_ROLE_KEY" ]; then
  echo "SERVICE_ROLE_KEY not set in $ENV_FILE"
  exit 1
fi
echo "Creating demo user demo@dincollection.com (Admin API)..."
RESP=$(curl -sk -X POST "$BASE/auth/v1/admin/users" \
  -H "Content-Type: application/json" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -d '{"email":"demo@dincollection.com","password":"demo123","email_confirm":true}')
echo "$RESP"
if echo "$RESP" | grep -q '"id"'; then
  echo "Demo user created. Login with demo@dincollection.com / demo123"
elif echo "$RESP" | grep -q "already been registered\|already exists"; then
  echo "User exists. Resetting password..."
  # Get user id and update password via admin if needed
  echo "Try logging in with demo@dincollection.com / demo123"
else
  echo "Check response above."
fi
