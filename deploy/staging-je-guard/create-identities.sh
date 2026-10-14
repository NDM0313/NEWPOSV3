#!/usr/bin/env bash
# Create two staging-only users on clone via GoTrue + link public.users.
set -euo pipefail
STAGE_DIR=/root/je-guard-stage
# shellcheck disable=SC1091
source "$STAGE_DIR/keys.env"
# shellcheck disable=SC1091
source "$STAGE_DIR/identity.env"

COMPANY_A=e08a04af-22a8-4869-9b4d-da31fce13158
PASS_A=$(openssl rand -hex 12)
PASS_B=$(openssl rand -hex 12)
EMAIL_A="je-guard-a-$(date +%s)@staging.local"
EMAIL_B="je-guard-b-$(date +%s)@staging.local"

COMPANY_B=$(docker exec supabase-db psql -U postgres -d ledger_stage_20260919_prodcheck -t -A -c \
  "SELECT id::text FROM companies WHERE id <> '$COMPANY_A' ORDER BY created_at NULLS LAST, id LIMIT 1;")
if [[ -z "$COMPANY_B" ]]; then
  echo "ERROR: no company B found"
  exit 1
fi

create_user() {
  local email="$1" pass="$2"
  curl -sS "http://127.0.0.1:${AUTH_PORT}/admin/users" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -H "apikey: ${SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${email}\",\"password\":\"${pass}\",\"email_confirm\":true}" 
}

RESP_A=$(create_user "$EMAIL_A" "$PASS_A")
RESP_B=$(create_user "$EMAIL_B" "$PASS_B")
UID_A=$(python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])' <<<"$RESP_A")
UID_B=$(python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])' <<<"$RESP_B")

docker exec -i supabase-db psql -U postgres -d ledger_stage_20260919_prodcheck -v ON_ERROR_STOP=1 <<SQL
-- Link public.users for get_user_company_id()
INSERT INTO public.users (id, auth_user_id, company_id, email, role, full_name, is_active)
VALUES
  ('$UID_A'::uuid, '$UID_A'::uuid, '$COMPANY_A'::uuid, '$EMAIL_A', 'admin', 'JE Guard A', true),
  ('$UID_B'::uuid, '$UID_B'::uuid, '$COMPANY_B'::uuid, '$EMAIL_B', 'admin', 'JE Guard B', true)
ON CONFLICT (id) DO UPDATE SET
  auth_user_id = EXCLUDED.auth_user_id,
  company_id = EXCLUDED.company_id,
  email = EXCLUDED.email,
  is_active = true;
SQL

# Persist credentials for gate scripts only (chmod 600; never commit)
cat > "$STAGE_DIR/test_users.env" <<EOF
EMAIL_A=$EMAIL_A
PASS_A=$PASS_A
UID_A=$UID_A
COMPANY_A=$COMPANY_A
EMAIL_B=$EMAIL_B
PASS_B=$PASS_B
UID_B=$UID_B
COMPANY_B=$COMPANY_B
EOF
chmod 600 "$STAGE_DIR/test_users.env"

# Prove GoTrue login
TOKEN_A=$(curl -sS "http://127.0.0.1:${AUTH_PORT}/token?grant_type=password" \
  -H "apikey: ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL_A}\",\"password\":\"${PASS_A}\"}" \
  | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("access_token") or d)')
TOKEN_B=$(curl -sS "http://127.0.0.1:${AUTH_PORT}/token?grant_type=password" \
  -H "apikey: ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL_B}\",\"password\":\"${PASS_B}\"}" \
  | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("access_token") or d)')

if [[ "$TOKEN_A" == eyJ* && "$TOKEN_B" == eyJ* ]]; then
  echo "LOGIN_OK company_a=$COMPANY_A company_b=$COMPANY_B uid_a=$UID_A uid_b=$UID_B"
else
  echo "LOGIN_FAIL"
  echo "A=$TOKEN_A"
  echo "B=$TOKEN_B"
  exit 1
fi

# Save tokens for subsequent tests (ephemeral)
printf 'TOKEN_A=%s\nTOKEN_B=%s\n' "$TOKEN_A" "$TOKEN_B" > "$STAGE_DIR/tokens.env"
chmod 600 "$STAGE_DIR/tokens.env"
echo "IDENTITIES_OK"
