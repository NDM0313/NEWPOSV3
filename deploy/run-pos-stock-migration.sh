#!/usr/bin/env bash
# Run POS + Stock DB validation migration on VPS (Supabase Postgres).
# Usage: from repo root, on VPS: bash deploy/run-pos-stock-migration.sh
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONTAINER=$(docker ps --format '{{.Names}}' | grep -E '^db$|^supabase-db$|^postgres$|supabase.*db' | head -1)
if [ -z "$CONTAINER" ]; then
  echo "ERROR: No Postgres container found. Run from VPS where Supabase Docker is up."
  exit 1
fi
echo "Running pos_stock_db_validation.sql on $CONTAINER..."
docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$REPO_ROOT/migrations/pos_stock_db_validation.sql"
echo "Done."
