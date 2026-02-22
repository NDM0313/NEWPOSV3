#!/bin/bash
# Auto-apply storage RLS for payment-attachments on VPS Supabase Postgres.
# On VPS:  cd /root/NEWPOSV3  then  bash deploy/apply-storage-rls-vps.sh
# Uses same DB container as run_link_demo_and_seed.sh. Safe to run on every deploy.
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SQL_FILE="$ROOT/supabase-extract/migrations/RUN_THIS_FOR_STORAGE_RLS.sql"
if [ ! -f "$SQL_FILE" ]; then
  echo "[apply-storage-rls-vps] SQL not found: $SQL_FILE"
  exit 1
fi
CONTAINER=$(docker ps --format '{{.Names}}' | grep -E '^db$|^supabase-db$|^postgres$|supabase.*db' | head -1)
if [ -z "$CONTAINER" ]; then
  echo "[apply-storage-rls-vps] No Postgres container (db, supabase-db, postgres). Skipping."
  exit 0
fi
echo "[apply-storage-rls-vps] Applying storage RLS to $CONTAINER..."
docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$SQL_FILE"
echo "[apply-storage-rls-vps] Done. payment-attachments RLS updated."
