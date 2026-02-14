#!/bin/bash
# Backup Supabase (self-hosted) - PostgreSQL dump
# UFW: 5432 never exposed. Use localhost or Docker exec.

set -e
BACKUP_DIR="${BACKUP_DIR:-/var/backups/erp}"
mkdir -p "$BACKUP_DIR"
STAMP=$(date +%Y%m%d_%H%M%S)
FILE="$BACKUP_DIR/supabase_$STAMP.sql.gz"

# Option 1: Docker exec (if Supabase postgres in container named supabase-db or similar)
if docker ps --format '{{.Names}}' | grep -qE 'supabase-db|postgres|db'; then
  CONTAINER=$(docker ps --format '{{.Names}}' | grep -E 'supabase-db|postgres|db' | head -1)
  echo "[$(date)] Backup via Docker: $CONTAINER"
  docker exec "$CONTAINER" pg_dump -U postgres postgres --no-owner --no-acl | gzip > "$FILE"
# Option 2: Direct pg_dump (postgres on host or exposed to localhost)
else
  DB_HOST="${DB_HOST:-localhost}"
  DB_PORT="${DB_PORT:-5432}"
  DB_NAME="${DB_NAME:-postgres}"
  DB_USER="${DB_USER:-postgres}"
  export PGPASSWORD="${DB_PASSWORD}"
  echo "[$(date)] Starting backup to $FILE"
  pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" --no-owner --no-acl | gzip > "$FILE"
  unset PGPASSWORD
fi

echo "[$(date)] Backup done: $(ls -lh $FILE)"
find "$BACKUP_DIR" -name "supabase_*.sql.gz" -mtime +7 -delete
