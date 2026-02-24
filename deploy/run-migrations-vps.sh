#!/bin/bash
# Run SQL migrations on VPS via psql (no Node required).
# Called from deploy/deploy.sh. Uses same db container as apply_rls.
# Usage: cd /root/NEWPOSV3 && bash deploy/run-migrations-vps.sh

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CONTAINER=$(docker ps --format '{{.Names}}' | grep -E '^db$|^supabase-db$|^postgres$|supabase.*db' | head -1)
if [ -z "$CONTAINER" ]; then
  echo "[migrate] No db container found. Skipping migrations."
  exit 0
fi

echo "[migrate] Running migrations in $CONTAINER..."

# Create schema_migrations table
docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<'EOSQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);
EOSQL

# Get applied migrations
APPLIED=$(docker exec "$CONTAINER" psql -U postgres -d postgres -t -A -c "SELECT name FROM schema_migrations" 2>/dev/null | tr '\n' '|')

run_one() {
  local dir="$1"
  local file="$2"
  local path="$dir/$file"
  [ ! -f "$path" ] && return 0
  if echo "$APPLIED" | grep -qF "|$file|"; then
    echo "[SKIP] $file (already applied)"
    return 0
  fi
  echo "[RUN] $file"
  if docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$path" 2>&1; then
    docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "INSERT INTO schema_migrations (name) VALUES ('$file') ON CONFLICT (name) DO NOTHING" 2>/dev/null || true
    echo "[OK] $file"
    APPLIED="$APPLIED|$file|"
    return 0
  else
    echo "[FAIL] $file"
    return 1
  fi
}

SKIP="|01_full_database_wipe.sql|14_demo_dummy_data.sql|15_demo_reset_script.sql|cleanup_demo_data.sql|controlled_demo_seed.sql|"

# supabase-extract/migrations
for f in $(ls -1 supabase-extract/migrations/*.sql 2>/dev/null | xargs -I{} basename {} | sort -V); do
  echo "$SKIP" | grep -qF "|$f|" && continue
  run_one "supabase-extract/migrations" "$f" || exit 1
done

# migrations/
for f in $(ls -1 migrations/*.sql 2>/dev/null | xargs -I{} basename {} | sort -V); do
  run_one "migrations" "$f" || exit 1
done

echo "[migrate] Done."
