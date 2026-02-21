#!/bin/bash
# Reset a user's password on VPS Supabase (erp.dincouture.pk).
# The MCP Supabase tools connect to Cloud — this script updates the VPS DB directly.
#
# Usage: ./scripts/vps-reset-user-password.sh [email] [password]
# Example: ./scripts/vps-reset-user-password.sh ndm313@yahoo.com 'Demo123!@#'
#
# Prerequisites: SSH access to dincouture-vps (or set SSH_HOST)

set -e
EMAIL="${1:-ndm313@yahoo.com}"
PASSWORD="${2:-Demo123!}"
SSH_HOST="${SSH_HOST:-dincouture-vps}"

# Escape single quotes in password for SQL: ' -> ''
SQL_PASS="${PASSWORD//\'/\'\'}"

echo "[VPS] Resetting password for $EMAIL on VPS Supabase..."
ssh "$SSH_HOST" "docker exec -i supabase-db psql -U postgres -d postgres" <<EOSQL
UPDATE auth.users
SET encrypted_password = crypt('$SQL_PASS', gen_salt('bf'))
WHERE email = '$EMAIL';
EOSQL

# Verify
ssh "$SSH_HOST" "docker exec supabase-db psql -U postgres -d postgres -t -c \"SELECT email FROM auth.users WHERE email = '$EMAIL';\""

echo "[DONE] Try logging in at https://erp.dincouture.pk with $EMAIL / (your password)"
