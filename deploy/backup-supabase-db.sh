#!/bin/bash
# Database backup for self-hosted Supabase (pg_dump). Run on VPS.
# Usage: bash deploy/backup-supabase-db.sh [retention_days]
# Default: keep last 7 days. Backups go to BACKUP_DIR (default: /root/NEWPOSV3/backups or ./backups).
set -e
RETENTION_DAYS="${1:-7}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"
CONTAINER=$(docker ps --format '{{.Names}}' | grep -E '^supabase-db$|^db$' | head -1)

mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILE="$BACKUP_DIR/supabase_db_$TIMESTAMP.dump"

if [ -z "$CONTAINER" ]; then
  echo "[backup] No Supabase DB container found. Skip."
  exit 0
fi

echo "[backup] Dumping database from $CONTAINER to $FILE ..."
docker exec "$CONTAINER" pg_dump -U postgres -d postgres -Fc -f /tmp/db_$TIMESTAMP.dump
docker cp "$CONTAINER:/tmp/db_$TIMESTAMP.dump" "$FILE"
docker exec "$CONTAINER" rm -f /tmp/db_$TIMESTAMP.dump
echo "[backup] Created $FILE"

# Retention: remove backups older than RETENTION_DAYS
find "$BACKUP_DIR" -name 'supabase_db_*.dump' -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
echo "[backup] Done. Kept last $RETENTION_DAYS days."
