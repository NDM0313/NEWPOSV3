# Backup Automation

Production ERP database backups with 30-day retention.

## Script: `scripts/backup-db.sh`

- **Daily backup:** `db_daily_YYYY-MM-DD_HHMM.sql.gz`
- **Weekly full backup:** run with `WEEKLY=1` → `db_full_YYYY-MM-DD_HHMM.sql.gz`
- **Retention:** Backups older than 30 days are deleted automatically.

### Requirements

- `pg_dump` and `gzip` on the server
- PostgreSQL connection: set `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE` (and `PGPASSWORD` or `~/.pgpass`)

### VPS Cron Setup

1. Make script executable:  
   `chmod +x /root/NEWPOSV3/scripts/backup-db.sh`

2. Set env (e.g. in crontab or a small wrapper):
   - `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE`
   - Optional: `BACKUP_DIR=/var/backups/erp`, `RETENTION_DAYS=30`

3. Add cron jobs (run as user that can read DB):

   ```cron
   # Daily at 2:00 AM
   0 2 * * * BACKUP_DIR=/var/backups/erp /root/NEWPOSV3/scripts/backup-db.sh

   # Weekly full at 3:00 AM Sunday
   0 3 * * 0 WEEKLY=1 BACKUP_DIR=/var/backups/erp /root/NEWPOSV3/scripts/backup-db.sh
   ```

### Restore

```bash
gunzip -c /path/to/db_daily_YYYY-MM-DD_HHMM.sql.gz | psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE
```

### Supabase (hosted)

If the app uses **Supabase hosted Postgres**, use Supabase Dashboard → Database → Backups (daily backups and PITR depend on plan). This script is for **self-hosted Postgres on your VPS** (e.g. after migrating DB to the same server).
