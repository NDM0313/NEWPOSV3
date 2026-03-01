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

# Bootstrap: if DB was set up before migrations, mark 02-18 as applied (don't re-run)
BOOTSTRAP="02_clean_erp_schema.sql 03_frontend_driven_schema.sql 04_create_default_accounts.sql 05_inventory_movement_engine.sql 06_purchase_transaction_with_accounting.sql 07_sale_transaction_with_accounting.sql 08_payment_engine.sql 09_contact_groups.sql 09_expense_transaction.sql 10_ledger_calculations.sql 11_returns_cancellation.sql 12_accounting_reports.sql 13_create_demo_company.sql 16_chart_of_accounts.sql 17_accounts_description.sql 18_branches_default_accounts.sql"
COUNT=$(docker exec "$CONTAINER" psql -U postgres -d postgres -t -A -c "SELECT COUNT(*) FROM schema_migrations" 2>/dev/null | tr -d ' ')
if [ -z "$COUNT" ] || [ "$COUNT" -lt 5 ]; then
  echo "[migrate] Bootstrap: marking pre-existing migrations (02-18) as applied..."
  for b in $BOOTSTRAP; do
    docker exec "$CONTAINER" psql -U postgres -d postgres -c "INSERT INTO schema_migrations (name) VALUES ('$b') ON CONFLICT (name) DO NOTHING" 2>/dev/null || true
  done
  echo "[migrate] Bootstrap done."
fi

# Get applied migrations
APPLIED=$(docker exec "$CONTAINER" psql -U postgres -d postgres -t -A -c "SELECT name FROM schema_migrations" 2>/dev/null | tr '\n' '|')
APPLIED="|${APPLIED}|"

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

SKIP="|01_full_database_wipe.sql|14_demo_dummy_data.sql|15_demo_reset_script.sql|cleanup_demo_data.sql|controlled_demo_seed.sql|studio_assign_receive_workflow.sql|studio_production_stages_no_auto_assign_guard.sql|"

# supabase-extract/migrations
for f in $(ls -1 supabase-extract/migrations/*.sql 2>/dev/null | xargs -I{} basename {} | sort -V); do
  echo "$SKIP" | grep -qF "|$f|" && continue
  run_one "supabase-extract/migrations" "$f" || exit 1
done

# migrations/
for f in $(ls -1 migrations/*.sql 2>/dev/null | xargs -I{} basename {} | sort -V); do
  run_one "migrations" "$f" || exit 1
done

# role_permissions table (replica in subfolder; not in migrations/*.sql)
REPLICA_NAME="erp_replica_role_permissions.sql"
REPLICA_PATH="migrations/erp_permission_architecture_replica/01_role_permissions_table_and_seed.sql"
if [ -f "$ROOT/$REPLICA_PATH" ]; then
  if echo "$APPLIED" | grep -qF "|$REPLICA_NAME|"; then
    echo "[SKIP] $REPLICA_NAME (already applied)"
  else
    echo "[RUN] $REPLICA_NAME"
    if docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$ROOT/$REPLICA_PATH" 2>&1; then
      docker exec "$CONTAINER" psql -U postgres -d postgres -c "INSERT INTO schema_migrations (name) VALUES ('$REPLICA_NAME') ON CONFLICT (name) DO NOTHING" 2>/dev/null || true
      echo "[OK] $REPLICA_NAME"
    else
      echo "[FAIL] $REPLICA_NAME"
      exit 1
    fi
  fi
fi

echo "[migrate] Done."
