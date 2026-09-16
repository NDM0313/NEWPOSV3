#!/usr/bin/env bash
# Create an isolated Postgres clone from production supabase-db (read-only source dump).
# NEVER drops or overwrites the live `postgres` database.
#
# Usage (on VPS):
#   CLONE_DB=ledger_stage_20260623 bash scripts/single-core-ledger/create-vps-ledger-clone.sh
#   CLONE_DB=ledger_stage_20260623 RECREATE=1 bash scripts/single-core-ledger/create-vps-ledger-clone.sh
#
set -euo pipefail

CLONE_DB="${CLONE_DB:-ledger_stage_20260623}"
RECREATE="${RECREATE:-0}"
CONTAINER="${SUPABASE_DB_CONTAINER:-supabase-db}"
SOURCE_DB="${SOURCE_DB:-postgres}"

if [[ ! "$CLONE_DB" =~ ^ledger_stage_[0-9]{8}(_prodcheck)?$ ]]; then
  echo "ERROR: CLONE_DB must match ledger_stage_YYYYMMDD or ledger_stage_YYYYMMDD_prodcheck (got: $CLONE_DB)" >&2
  exit 1
fi

if [[ "$CLONE_DB" == "$SOURCE_DB" ]]; then
  echo "ERROR: clone name cannot equal source database" >&2
  exit 1
fi

echo "=== VPS ledger clone (isolated) ==="
echo "Source DB: $SOURCE_DB (read-only dump)"
echo "Clone DB:  $CLONE_DB"
echo "Container: $CONTAINER"
echo "NOT the live production database name: postgres data copied into separate DB only."
echo ""

exists=$(docker exec "$CONTAINER" psql -U postgres -d postgres -t -A -c \
  "SELECT 1 FROM pg_database WHERE datname = '$CLONE_DB' LIMIT 1;" | tr -d '[:space:]')

if [[ "$exists" == "1" && "$RECREATE" != "1" ]]; then
  echo "Clone $CLONE_DB already exists — skip (set RECREATE=1 to rebuild)."
  docker exec "$CONTAINER" psql -U postgres -d "$CLONE_DB" -c \
    "SELECT pg_size_pretty(pg_database_size(current_database())) AS clone_size;"
  exit 0
fi

if [[ "$exists" == "1" && "$RECREATE" == "1" ]]; then
  echo "Dropping existing clone $CLONE_DB …"
  docker exec "$CONTAINER" psql -U postgres -d postgres -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$CLONE_DB' AND pid <> pg_backend_pid();" || true
  docker exec "$CONTAINER" psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS \"$CLONE_DB\";"
fi

echo "Creating empty clone database $CLONE_DB …"
docker exec "$CONTAINER" psql -U postgres -d postgres -c "CREATE DATABASE \"$CLONE_DB\";"

echo "Dumping $SOURCE_DB and restoring into $CLONE_DB (this may take a few minutes) …"
docker exec "$CONTAINER" pg_dump -U postgres -Fc "$SOURCE_DB" -f "/tmp/${CLONE_DB}.dump"
docker exec "$CONTAINER" pg_restore -U postgres -d "$CLONE_DB" --no-owner --no-acl "/tmp/${CLONE_DB}.dump" 2>/dev/null || true
docker exec "$CONTAINER" rm -f "/tmp/${CLONE_DB}.dump"

echo ""
echo "Clone ready:"
docker exec "$CONTAINER" psql -U postgres -d "$CLONE_DB" -c \
  "SELECT current_database() AS database, pg_size_pretty(pg_database_size(current_database())) AS size;"
