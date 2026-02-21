#!/bin/bash
# Full data export from Supabase Cloud and import to VPS.
# Run from a machine that can SSH to VPS (dincouture-vps).
#
# Prerequisites: VPS has Docker, SSH key to dincouture-vps
# Cloud pooler URL and VPS credentials in env or script.

set -e
CLOUD_URL="${CLOUD_DATABASE_URL:-postgresql://postgres.wrwljqzckmnmuphwhslt:khan313ndm313@aws-1-ap-south-1.pooler.supabase.com:6543/postgres}"
EXPORT_DIR="/root/cloud_export"
SSH_HOST="${SSH_HOST:-dincouture-vps}"

echo "[1/4] Exporting from Supabase Cloud..."
ssh "$SSH_HOST" "mkdir -p $EXPORT_DIR && docker run --rm -v ${EXPORT_DIR}:/out -e PGPASSWORD=khan313ndm313 postgres:17 pg_dump -h aws-1-ap-south-1.pooler.supabase.com -p 6543 -U postgres.wrwljqzckmnmuphwhslt -d postgres --no-owner --no-acl --data-only -n public --inserts -f /out/cloud_data.sql 2>/dev/null"

echo "[2/4] Truncating VPS public tables..."
ssh "$SSH_HOST" "docker exec supabase-db psql -U postgres -d postgres -c \"
DO \\\$\\\$ 
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') 
  LOOP
    EXECUTE 'TRUNCATE public.' || quote_ident(r.tablename) || ' CASCADE';
  END LOOP;
END \\\$\\\$;
\" 2>/dev/null"

echo "[3/4] Adding staff to user_role enum if needed..."
ssh "$SSH_HOST" "docker exec supabase-db psql -U postgres -d postgres -c \"ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'staff';\" 2>/dev/null || true"

echo "[4/4] Importing data (triggers disabled)..."
ssh "$SSH_HOST" "(
  echo 'SET session_replication_role = replica;'
  cat $EXPORT_DIR/cloud_data.sql
  echo 'SET session_replication_role = DEFAULT;'
) | docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=0 2>/dev/null"

echo "[DONE] Cloud → VPS data migration complete."
