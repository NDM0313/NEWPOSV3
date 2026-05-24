#!/usr/bin/env bash
set -euo pipefail
CONTAINER=supabase-db
PSQL="docker exec $CONTAINER psql -U postgres -d postgres -t -A"

echo "=== Attachment URL backfill check ==="
$PSQL -c "SELECT COUNT(*) FROM schema_migrations WHERE name = '20260530120000_backfill_attachment_urls_to_path.sql';" | sed 's/^/migration_applied: /'

LOCALHOST_COUNT=$($PSQL -c "
SELECT
  (SELECT COUNT(*) FROM sales WHERE attachments::text LIKE '%localhost%' OR attachments::text LIKE '%127.0.0.1%')
  + (SELECT COUNT(*) FROM purchases WHERE attachments::text LIKE '%localhost%' OR attachments::text LIKE '%127.0.0.1%')
  + (SELECT COUNT(*) FROM payments WHERE attachments::text LIKE '%localhost%' OR attachments::text LIKE '%127.0.0.1%');
")
echo "localhost_rows: $LOCALHOST_COUNT"

if [ "${LOCALHOST_COUNT:-0}" != "0" ]; then
  echo "Applying backfill migration..."
  docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 < /root/NEWPOSV3/migrations/20260530120000_backfill_attachment_urls_to_path.sql
  docker exec "$CONTAINER" psql -U postgres -d postgres -c "INSERT INTO schema_migrations (name) VALUES ('20260530120000_backfill_attachment_urls_to_path.sql') ON CONFLICT (name) DO NOTHING;"
  echo "Backfill applied."
else
  echo "No localhost attachment rows remain."
fi
