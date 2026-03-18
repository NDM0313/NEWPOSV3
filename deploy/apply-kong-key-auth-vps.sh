#!/bin/bash
# Apply key-auth to auth-v1 and rest-v1 in kong.yml on VPS (idempotent: skips if already present).
# Run on VPS: bash deploy/apply-kong-key-auth-vps.sh
# Then: cd /root/supabase/docker && docker compose up -d kong --force-recreate
KONG_YML="${KONG_YML:-/root/supabase/docker/volumes/api/kong.yml}"
[ ! -f "$KONG_YML" ] && { echo "Missing $KONG_YML"; exit 1; }

# Check if key-auth already present for auth-v1
if grep -B25 '/auth/v1/' "$KONG_YML" | grep -q 'name: key-auth'; then
  echo "[apply-kong-key-auth] auth-v1 already has key-auth"
else
  # Find line number of "      - name: cors" that follows "          - /auth/v1/"
  AUTH_CORS=$(awk '/\/auth\/v1\//{p=1} p && /- name: cors/{print NR; exit}' "$KONG_YML")
  [ -n "$AUTH_CORS" ] && sed -i "${AUTH_CORS}i\\      - name: key-auth\n        config:\n          hide_credentials: false" "$KONG_YML" && echo "[apply-kong-key-auth] Added key-auth to auth-v1"
fi

if grep -B25 '/rest/v1/' "$KONG_YML" | grep -q 'name: key-auth'; then
  echo "[apply-kong-key-auth] rest-v1 already has key-auth"
else
  REST_CORS=$(awk '/\/rest\/v1\//{p=1} p && /- name: cors/{print NR; exit}' "$KONG_YML")
  [ -n "$REST_CORS" ] && sed -i "${REST_CORS}i\\      - name: key-auth\n        config:\n          hide_credentials: false" "$KONG_YML" && echo "[apply-kong-key-auth] Added key-auth to rest-v1"
fi
echo "[apply-kong-key-auth] Done. Recreate Kong: cd /root/supabase/docker && docker compose up -d kong --force-recreate"
