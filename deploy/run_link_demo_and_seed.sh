#!/bin/bash
# Run link_demo_user_and_seed_data.sql on VPS Supabase Postgres.
# Fixes "no data" by linking demo user to company and inserting seed contacts.
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_FILE="${SCRIPT_DIR}/link_demo_user_and_seed_data.sql"
if [ ! -f "$SQL_FILE" ]; then
  echo "Missing $SQL_FILE"
  exit 1
fi
CONTAINER=$(docker ps --format '{{.Names}}' | grep -E '^db$|^supabase-db$|^postgres$|supabase.*db' | head -1)
if [ -z "$CONTAINER" ]; then
  echo "No Postgres container found (looking for db, supabase-db, postgres)"
  exit 1
fi
echo "Using container: $CONTAINER"
docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$SQL_FILE"
echo "Done. Refresh ERP and check Contacts."
