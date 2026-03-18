#!/bin/bash
# Run on VPS: regenerate anon/service keys from JWT_SECRET and update .env (no $ expansion).
set -e
source /root/supabase/docker/.env 2>/dev/null || true
[ -z "$JWT_SECRET" ] && echo "JWT_SECRET not set" && exit 1
OUT=$(docker run --rm -e JWT_SECRET="$JWT_SECRET" -v "/root/NEWPOSV3/deploy:/app" node:20-alpine node /app/gen-jwt-keys.cjs 2>/dev/null)
# Output: often one line "ANON_KEY=... SERVICE_ROLE_KEY=..."; strip to key only, trim trailing CRLF
NEW_ANON=$(echo "$OUT" | sed 's/^ANON_KEY=//' | head -1 | sed 's/ SERVICE_ROLE_KEY=.*//' | sed 's/[\r\n]*$//' | tr -d '\n\r')
NEW_SVC=$(echo "$OUT" | sed 's/^.*SERVICE_ROLE_KEY=//' | head -1 | sed 's/[\r\n]*$//' | tr -d '\n\r')
[ -z "$NEW_ANON" ] && echo "Failed to parse ANON_KEY" && exit 1
grep -v '^ANON_KEY=' /root/supabase/docker/.env | grep -v '^SERVICE_ROLE_KEY=' > /tmp/envnew
printf 'ANON_KEY=%s\n' "$NEW_ANON" >> /tmp/envnew
printf 'SERVICE_ROLE_KEY=%s\n' "$NEW_SVC" >> /tmp/envnew
mv /tmp/envnew /root/supabase/docker/.env
grep -v '^VITE_SUPABASE_ANON_KEY=' /root/NEWPOSV3/.env.production 2>/dev/null > /tmp/erpnew || true
printf 'VITE_SUPABASE_ANON_KEY=%s\n' "$NEW_ANON" >> /tmp/erpnew
mv /tmp/erpnew /root/NEWPOSV3/.env.production
cd /root/supabase/docker && docker compose up -d kong studio storage functions --force-recreate 2>/dev/null
docker compose restart auth rest 2>/dev/null
echo "OK Anon length: ${#NEW_ANON}"
