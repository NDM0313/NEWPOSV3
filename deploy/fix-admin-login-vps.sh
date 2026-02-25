#!/bin/bash
# Fix admin@dincouture.pk login (400 Bad Request). Run on VPS from repo root:
#   cd ~/NEWPOSV3 && bash deploy/fix-admin-login-vps.sh
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

# Find Supabase Postgres container
CONTAINER=$(docker ps --format '{{.Names}}' | grep -E '^db$|^supabase-db$|^postgres$|supabase.*db' | head -1)
if [ -z "$CONTAINER" ]; then
  echo "ERROR: No Supabase Postgres container found (looked for db, supabase-db, postgres)."
  exit 1
fi
echo "[fix-admin] Using DB container: $CONTAINER"

# Ensure admin user exists, then set password and confirm email
echo "[fix-admin] Applying admin user fix..."
docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<'EOSQL'
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Insert admin if missing
INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at, confirmation_sent_at,
  role, aud, created_at, updated_at
)
SELECT
  gen_random_uuid(), 'admin@dincouture.pk', crypt('AdminDincouture2026', gen_salt('bf')),
  now(), now(), 'authenticated', 'authenticated', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@dincouture.pk');

-- Reset password and confirm email (fixes 400 if user existed with wrong hash)
UPDATE auth.users
SET encrypted_password = crypt('AdminDincouture2026', gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    confirmation_sent_at = COALESCE(confirmation_sent_at, now())
WHERE email = 'admin@dincouture.pk';

SELECT email, email_confirmed_at IS NOT NULL AS confirmed FROM auth.users WHERE email = 'admin@dincouture.pk';
EOSQL

echo "[fix-admin] Done. Try logging in with Admin (admin@dincouture.pk) and password AdminDincouture2026"
echo "If still 400, run: bash deploy/verify-auth-login.sh (from repo root, with SUPABASE_API_URL=https://supabase.dincouture.pk)"
