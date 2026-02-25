#!/bin/bash
# Apply Studio Assign/Receive workflow + No Auto-Assign guard.
# Run as supabase_admin (RPCs need it). Skipped by run-migrations-vps.sh (uses postgres).
# Called from deploy/deploy.sh.
# Usage: cd /root/NEWPOSV3 && bash deploy/apply-studio-no-auto-assign.sh

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CONTAINER=$(docker ps --format '{{.Names}}' | grep -E '^db$|^supabase-db$|^postgres$|supabase.*db' | head -1)
[ -z "$CONTAINER" ] && { echo "[studio-migrate] No db container. Skip."; exit 0; }

APPLIED=$(docker exec "$CONTAINER" psql -U postgres -d postgres -t -A -c "SELECT name FROM schema_migrations WHERE name IN ('studio_assign_receive_workflow.sql','studio_production_stages_no_auto_assign_guard.sql')" 2>/dev/null | tr '\n' '|')
APPLIED="|${APPLIED}|"

echo "[studio-migrate] Applying Studio workflow + no-auto-assign guard (supabase_admin)..."
for f in studio_assign_receive_workflow.sql studio_production_stages_no_auto_assign_guard.sql; do
  path="migrations/$f"
  [ ! -f "$path" ] && { echo "[studio-migrate] $f not found. Skip."; continue; }
  if echo "$APPLIED" | grep -qF "|$f|"; then
    echo "[studio-migrate] SKIP $f (already applied)"
    continue
  fi
  echo "[studio-migrate] Running $f..."
  if docker exec -i "$CONTAINER" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 < "$path" 2>&1; then
    docker exec "$CONTAINER" psql -U postgres -d postgres -c "INSERT INTO schema_migrations (name) VALUES ('$f') ON CONFLICT (name) DO NOTHING" 2>/dev/null || true
    echo "[studio-migrate] OK $f"
  else
    echo "[studio-migrate] FAIL $f"
    exit 1
  fi
done
echo "[studio-migrate] Done."
