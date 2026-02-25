#!/bin/bash
# Fix all quick-login users in Supabase Auth so mobile app buttons work.
# Run on VPS: cd ~/NEWPOSV3 && bash deploy/fix-quick-login-users-vps.sh
# Sets: admin@dincouture.pk, info@dincouture.pk, demo@dincollection.com (passwords match app)
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

CONTAINER=$(docker ps --format '{{.Names}}' | grep -E '^db$|^supabase-db$|^postgres$|supabase.*db' | head -1)
[ -z "$CONTAINER" ] && echo "ERROR: No Supabase Postgres container found." && exit 1
echo "[fix-quick-login] Using DB container: $CONTAINER"

docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<'EOSQL'
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- bcrypt cost 10 to match GoTrue

-- admin@dincouture.pk
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, confirmation_sent_at, role, aud, created_at, updated_at)
SELECT gen_random_uuid(), 'admin@dincouture.pk', crypt('AdminDincouture2026', gen_salt('bf', 10)), now(), now(), 'authenticated', 'authenticated', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@dincouture.pk');
UPDATE auth.users SET encrypted_password = crypt('AdminDincouture2026', gen_salt('bf', 10)), email_confirmed_at = COALESCE(email_confirmed_at, now()), confirmation_sent_at = COALESCE(confirmation_sent_at, now()) WHERE email = 'admin@dincouture.pk';

-- info@dincouture.pk
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, confirmation_sent_at, role, aud, created_at, updated_at)
SELECT gen_random_uuid(), 'info@dincouture.pk', crypt('InfoDincouture2026', gen_salt('bf', 10)), now(), now(), 'authenticated', 'authenticated', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'info@dincouture.pk');
UPDATE auth.users SET encrypted_password = crypt('InfoDincouture2026', gen_salt('bf', 10)), email_confirmed_at = COALESCE(email_confirmed_at, now()), confirmation_sent_at = COALESCE(confirmation_sent_at, now()) WHERE email = 'info@dincouture.pk';

-- demo@dincollection.com
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, confirmation_sent_at, role, aud, created_at, updated_at)
SELECT gen_random_uuid(), 'demo@dincollection.com', crypt('demo123', gen_salt('bf', 10)), now(), now(), 'authenticated', 'authenticated', now(), now()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'demo@dincollection.com');
UPDATE auth.users SET encrypted_password = crypt('demo123', gen_salt('bf', 10)), email_confirmed_at = COALESCE(email_confirmed_at, now()), confirmation_sent_at = COALESCE(confirmation_sent_at, now()) WHERE email = 'demo@dincollection.com';

SELECT email, email_confirmed_at IS NOT NULL AS confirmed FROM auth.users WHERE email IN ('admin@dincouture.pk', 'info@dincouture.pk', 'demo@dincollection.com');
EOSQL

echo "[fix-quick-login] Done. Quick login passwords: Admin/Info/Demo = AdminDincouture2026 / InfoDincouture2026 / demo123"