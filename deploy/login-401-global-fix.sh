#!/bin/bash
# LOGIN 401 GLOBAL FIX – Production-safe, end-to-end.
# Run on VPS: cd /root/NEWPOSV3 && bash deploy/login-401-global-fix.sh
# 1. Regenerate JWT keys from JWT_SECRET (no shell $ expansion)
# 2. Write Supabase .env with LF only, no CR in values
# 3. Force-recreate Kong so it reloads env and rewrites kong.yml
# 4. Restart Auth/Rest
# 5. Sync ERP .env.production
# 6. Reset auth.users passwords
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SUPABASE_ENV="${SUPABASE_ENV:-/root/supabase/docker/.env}"
SUPABASE_DIR="$(dirname "$SUPABASE_ENV")"
ERP_ENV="$ROOT/.env.production"

echo "[login-401-fix] Phase 1: Read JWT_SECRET and generate keys..."
[ ! -f "$SUPABASE_ENV" ] && echo "Missing $SUPABASE_ENV" && exit 1
source "$SUPABASE_ENV" 2>/dev/null || true
JWT_SECRET="${JWT_SECRET:-}"
[ -z "$JWT_SECRET" ] && echo "JWT_SECRET not set in $SUPABASE_ENV" && exit 1

cd "$ROOT"
if command -v node >/dev/null 2>&1; then
  OUT=$(JWT_SECRET="$JWT_SECRET" node "$SCRIPT_DIR/gen-jwt-keys.cjs" 2>/dev/null)
else
  OUT=$(docker run --rm -e JWT_SECRET="$JWT_SECRET" -v "$ROOT/deploy:/app" node:20-alpine node /app/gen-jwt-keys.cjs 2>/dev/null)
fi
[ -z "$OUT" ] && echo "Failed to generate keys" && exit 1
# Node may output one line or two; anon = first key, service = second (must not mix)
NEW_ANON=$(echo "$OUT" | sed 's/^ANON_KEY=//' | head -1 | sed 's/ SERVICE_ROLE_KEY=.*//' | tr -d '\n\r' | sed 's/[[:space:]]*$//')
# Service key: only from line starting with SERVICE_ROLE_KEY= (avoid taking first line)
NEW_SVC=$(echo "$OUT" | sed -n 's/^SERVICE_ROLE_KEY=//p' | head -1 | tr -d '\n\r' | sed 's/[[:space:]]*$//')
[ -z "$NEW_SVC" ] && NEW_SVC=$(echo "$OUT" | sed 's/^.*SERVICE_ROLE_KEY=//' | head -1 | tr -d '\n\r' | sed 's/[[:space:]]*$//')
[ -z "$NEW_ANON" ] && echo "Could not parse ANON_KEY" && exit 1
[ -z "$NEW_SVC" ] && echo "Could not parse SERVICE_ROLE_KEY" && exit 1
# Service key must not start with ANON_KEY= (was a past bug)
echo "$NEW_SVC" | grep -q '^eyJ' || { echo "SERVICE_ROLE_KEY parse error (got prefix?)"; exit 1; }
echo "[login-401-fix] Anon key length: ${#NEW_ANON}, Service key length: ${#NEW_SVC}"
echo "[login-401-fix] Keys generated (anon len=${#NEW_ANON})"

echo "[login-401-fix] Phase 2: Write .env with printf (no expansion, LF only)..."
grep -v '^ANON_KEY=' "$SUPABASE_ENV" | grep -v '^SERVICE_ROLE_KEY=' > "${SUPABASE_ENV}.tmp"
printf 'ANON_KEY=%s\n' "$NEW_ANON" >> "${SUPABASE_ENV}.tmp"
printf 'SERVICE_ROLE_KEY=%s\n' "$NEW_SVC" >> "${SUPABASE_ENV}.tmp"
mv "${SUPABASE_ENV}.tmp" "$SUPABASE_ENV"
# Ensure no CRLF: rewrite with sed if on a system that might have added CR
sed -i 's/\r$//' "$SUPABASE_ENV" 2>/dev/null || true

echo "[login-401-fix] Phase 3: Sync ERP .env.production..."
[ -f "$ERP_ENV" ] && grep -v '^VITE_SUPABASE_ANON_KEY=' "$ERP_ENV" > "${ERP_ENV}.tmp" 2>/dev/null || true
[ -f "$ERP_ENV" ] && printf 'VITE_SUPABASE_ANON_KEY=%s\n' "$NEW_ANON" >> "${ERP_ENV}.tmp" && mv "${ERP_ENV}.tmp" "$ERP_ENV"

echo "[login-401-fix] Phase 4: Force-recreate Kong (load new env, rewrite kong.yml)..."
(cd "$SUPABASE_DIR" && docker compose up -d kong --force-recreate 2>/dev/null) || true
echo "[login-401-fix] Waiting 15s for Kong to start..."
sleep 15

echo "[login-401-fix] Phase 5: Restart Auth and Rest..."
(cd "$SUPABASE_DIR" && docker compose restart auth rest 2>/dev/null) || true
sleep 5

echo "[login-401-fix] Phase 6: Reset auth.users passwords..."
docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=0 <<'EOSQL' || true
CREATE EXTENSION IF NOT EXISTS pgcrypto;
UPDATE auth.users SET encrypted_password = crypt('AdminDincouture2026', gen_salt('bf', 10)), email_confirmed_at = COALESCE(email_confirmed_at, now()) WHERE email = 'admin@dincouture.pk';
UPDATE auth.users SET encrypted_password = crypt('123456', gen_salt('bf', 10)), email_confirmed_at = COALESCE(email_confirmed_at, now()) WHERE email = 'ndm313@yahoo.com';
UPDATE auth.users SET encrypted_password = crypt('123456', gen_salt('bf', 10)), email_confirmed_at = COALESCE(email_confirmed_at, now()) WHERE email = 'ndm313@live.com';
UPDATE auth.users SET encrypted_password = crypt('demo123', gen_salt('bf', 10)), email_confirmed_at = COALESCE(email_confirmed_at, now()) WHERE email = 'demo@dincollection.com';
EOSQL

echo "[login-401-fix] Done. Run verification: bash deploy/verify-login-401-fix.sh"
echo "[login-401-fix] Anon key (first 50 chars): ${NEW_ANON:0:50}..."
