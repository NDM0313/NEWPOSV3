#!/bin/bash
# Apply fix for "invalid input value for enum user_role: """ on VPS Supabase.
# Usage (from repo root): bash deploy/apply-fix-user-role-enum-vps.sh
# Or from local with SSH: ssh dincouture-vps "cd /root/NEWPOSV3 && bash deploy/apply-fix-user-role-enum-vps.sh"

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FIX_SQL="$ROOT/migrations/fix_user_role_enum_empty.sql"

if [ ! -f "$FIX_SQL" ]; then
  echo "ERROR: $FIX_SQL not found."
  exit 1
fi

CONTAINER=$(docker ps --format '{{.Names}}' | grep -E '^db$|^supabase-db$|^postgres$|supabase.*db' | head -1)
if [ -z "$CONTAINER" ]; then
  echo "ERROR: No Postgres container found (db, supabase-db, postgres)."
  exit 1
fi

echo "[fix] Applying user_role enum fix in $CONTAINER..."
docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$FIX_SQL"
echo "[fix] Done. get_user_role() now returns 'viewer' instead of empty string when role is missing/empty."
