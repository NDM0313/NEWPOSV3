#!/usr/bin/env bash
# =============================================================================
# ERP Database Backup Script
# - Daily: incremental/nightly dump
# - Weekly: full dump (same command, different name; run from cron with WEEKLY=1)
# - Retention: keep last 30 days of backups
# Run on VPS via cron, e.g.:
#   0 2 * * * WEEKLY=0 /root/NEWPOSV3/scripts/backup-db.sh
#   0 3 * * 0 WEEKLY=1 /root/NEWPOSV3/scripts/backup-db.sh
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_ROOT/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

# DB connection (set in env or .env; for VPS pg_dump)
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-postgres}"
PGDATABASE="${PGDATABASE:-postgres}"
# Optional: PGPASSWORD or use .pgpass

mkdir -p "$BACKUP_DIR"

DATE=$(date +%Y-%m-%d)
TIME=$(date +%H%M)
if [ "${WEEKLY:-0}" = "1" ]; then
  FILE="$BACKUP_DIR/db_full_${DATE}_${TIME}.sql.gz"
else
  FILE="$BACKUP_DIR/db_daily_${DATE}_${TIME}.sql.gz"
fi

echo "[$(date -Iseconds)] Starting backup to $FILE"
if pg_dump -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" --no-owner --no-acl 2>/dev/null | gzip -9 > "$FILE"; then
  echo "[$(date -Iseconds)] Backup done: $FILE ($(du -h "$FILE" | cut -f1))"
else
  echo "[$(date -Iseconds)] ERROR: pg_dump failed" >&2
  exit 1
fi

echo "[$(date -Iseconds)] Pruning backups older than $RETENTION_DAYS days"
find "$BACKUP_DIR" -name 'db_daily_*.sql.gz' -mtime +"$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -name 'db_full_*.sql.gz' -mtime +"$RETENTION_DAYS" -delete
echo "[$(date -Iseconds)] Backup and prune finished"
