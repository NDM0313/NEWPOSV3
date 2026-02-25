#!/bin/bash
# Run a migration as supabase_admin on VPS when run-migrations fails with "must be owner".
# VPS functions are owned by supabase_admin; use -U supabase_admin.
# Usage: ./scripts/run-migration-as-postgres.sh migrations/fix_auto_post_sale_account_fallbacks.sql

set -e
MIGRATION_FILE="${1:?Usage: $0 <migration-file>}"
MIGRATION_NAME="$(basename "$MIGRATION_FILE")"
if [[ ! -f "$MIGRATION_FILE" ]]; then
  echo "File not found: $MIGRATION_FILE"
  exit 1
fi

echo "Running $MIGRATION_NAME as supabase_admin on VPS..."
ssh dincouture-vps "docker exec -i supabase-db psql -U supabase_admin -d postgres" < "$MIGRATION_FILE"
echo "Marking as applied in schema_migrations..."
ssh dincouture-vps "docker exec supabase-db psql -U supabase_admin -d postgres -c \"INSERT INTO schema_migrations (name) VALUES ('$MIGRATION_NAME') ON CONFLICT (name) DO NOTHING\""
echo "Done."
