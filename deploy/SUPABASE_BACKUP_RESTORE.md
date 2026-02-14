# Supabase Backup & Restore

**Path:** `/opt/erp/supabase/backups/`  
**Method:** `docker exec` (no public port, 5432 never exposed)

---

## Backup Commands

### One-shot
```bash
# Create dir
sudo mkdir -p /opt/erp/supabase/backups
sudo chown $(id -u):$(id -g) /opt/erp/supabase/backups

# Run backup script (from project root)
chmod +x deploy/supabase-backup.sh
./deploy/supabase-backup.sh
```

### Full backup (manual)
```bash
STAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/opt/erp/supabase/backups
mkdir -p "$BACKUP_DIR"

# Detect container (Supabase self-host: usually "db")
CONTAINER=$(docker ps --format '{{.Names}}' | grep -E '^db$|supabase-db|postgres' | head -1)

# Full (schema + data)
docker exec -T "$CONTAINER" pg_dump -U postgres postgres --no-owner --no-acl | gzip > "$BACKUP_DIR/supabase_full_${STAMP}.sql.gz"

# Schema only
docker exec -T "$CONTAINER" pg_dump -U postgres postgres --schema-only --no-owner --no-acl | gzip > "$BACKUP_DIR/supabase_schema_${STAMP}.sql.gz"

# List
ls -lh "$BACKUP_DIR"
```

### Cron (daily 2am)
```bash
(crontab -l 2>/dev/null; echo "0 2 * * * /path/to/NEWPOSV3/deploy/supabase-backup.sh") | crontab -
```

---

## Checkpoints

```bash
# Backup exists and non-zero
ls -lh /opt/erp/supabase/backups/
test -s /opt/erp/supabase/backups/supabase_full_*.sql.gz && echo "OK" || echo "FAIL"

# File count
ls /opt/erp/supabase/backups/*.gz | wc -l
```

---

## Restore Commands

### Dry check (verify backup is valid)
```bash
# Decompress and check SQL is valid (no restore)
gunzip -c /opt/erp/supabase/backups/supabase_full_20250115_020000.sql.gz | head -100
# Expect: PostgreSQL dump, CREATE statements, etc.

# Or: validate with psql --dry-run (Postgres 15+)
# gunzip -c backup.sql.gz | psql -U postgres -d postgres --dry-run 2>/dev/null || true
```

### Full restore (destructive – drops and recreates)
```bash
CONTAINER=db   # or your db container name
BACKUP=/opt/erp/supabase/backups/supabase_full_20250115_020000.sql.gz

# 1. Stop app (optional, to avoid connections)
# docker compose stop api kong ...

# 2. Restore
gunzip -c "$BACKUP" | docker exec -i "$CONTAINER" psql -U postgres -d postgres

# 3. Restart app
# docker compose start
```

### Restore to new/empty database
```bash
CONTAINER=db
BACKUP=/opt/erp/supabase/backups/supabase_full_20250115_020000.sql.gz

# Create DB if needed
docker exec -i "$CONTAINER" psql -U postgres -c "CREATE DATABASE postgres_restore;"

# Restore into it
gunzip -c "$BACKUP" | docker exec -i "$CONTAINER" psql -U postgres -d postgres_restore
```

### Schema-only restore
```bash
gunzip -c /opt/erp/supabase/backups/supabase_schema_20250115_020000.sql.gz | docker exec -i db psql -U postgres -d postgres
```

---

## File Paths

| Type        | Path pattern                                      |
|-------------|---------------------------------------------------|
| Full backup | `/opt/erp/supabase/backups/supabase_full_YYYYMMDD_HHMMSS.sql.gz` |
| Schema only | `/opt/erp/supabase/backups/supabase_schema_YYYYMMDD_HHMMSS.sql.gz` |

---

## Permissions

```bash
# Backup dir: owned by backup runner
sudo chown -R $(id -u):$(id -g) /opt/erp/supabase/backups
chmod 750 /opt/erp/supabase/backups
chmod 640 /opt/erp/supabase/backups/*.gz
```
