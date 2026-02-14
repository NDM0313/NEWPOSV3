#!/bin/bash
# Production-safe Supabase Postgres backup
# Runs via docker exec - no public port. UFW: 5432 never exposed.
# Output: /opt/erp/supabase/backups/

set -e
BACKUP_DIR="${BACKUP_DIR:-/opt/erp/supabase/backups}"
STAMP=$(date +%Y%m%d_%H%M%S)

# Detect db container (Supabase self-host: db, supabase-db, postgres)
# Override: CONTAINER=db ./deploy/supabase-backup.sh
if [ -n "$CONTAINER" ]; then
  docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$" || { echo "Container $CONTAINER not running"; exit 1; }
else
  CONTAINER=$(docker ps --format '{{.Names}}' | grep -E '^db$|^supabase-db$|^postgres$|supabase.*db' | head -1)
  [ -z "$CONTAINER" ] && CONTAINER=$(docker ps --format '{{.Names}}' | grep -i postgres | head -1)
fi
if [ -z "$CONTAINER" ]; then
  echo "ERROR: No db/postgres container found. Run: docker ps"
  exit 1
fi

echo "[$(date)] Using container: $CONTAINER"
sudo mkdir -p "$BACKUP_DIR"
sudo chown "$(id -u):$(id -g)" "$BACKUP_DIR"
cd "$BACKUP_DIR"

# 1) Full logical backup (schema + data)
FULL_FILE="supabase_full_${STAMP}.sql.gz"
echo "[$(date)] Full backup: $FULL_FILE"
docker exec -T "$CONTAINER" pg_dump -U postgres postgres --no-owner --no-acl | gzip > "$FULL_FILE"
chmod 640 "$FULL_FILE"

# 2) Schema-only backup
SCHEMA_FILE="supabase_schema_${STAMP}.sql.gz"
echo "[$(date)] Schema-only backup: $SCHEMA_FILE"
docker exec -T "$CONTAINER" pg_dump -U postgres postgres --schema-only --no-owner --no-acl | gzip > "$SCHEMA_FILE"
chmod 640 "$SCHEMA_FILE"

echo "[$(date)] Done. Files:"
ls -lh "$FULL_FILE" "$SCHEMA_FILE"

# Retention: keep 7 days
find "$BACKUP_DIR" -name "supabase_full_*.sql.gz" -mtime +7 -delete
find "$BACKUP_DIR" -name "supabase_schema_*.sql.gz" -mtime +7 -delete
