#!/bin/bash
# Trim Supabase Logflare _analytics.log_events_* tables (prevents autovacuum CPU spikes).
# Safe retention default: 2 days. Run daily via cron:
#   15 4 * * * /root/NEWPOSV3/deploy/vps-trim-logflare-logs.sh >> /var/log/logflare-trim.log 2>&1

set -eu

RETENTION_DAYS="${LOGFLARE_RETENTION_DAYS:-2}"
BATCH_SIZE="${LOGFLARE_TRIM_BATCH:-50000}"
CONTAINER="${SUPABASE_DB_CONTAINER:-supabase-db}"
PSQL_USER="${SUPABASE_DB_TRIM_USER:-supabase_admin}"

TABLES=$(docker exec "$CONTAINER" psql -U postgres -d _supabase -At -c \
  "SELECT schemaname||'.'||relname FROM pg_stat_user_tables
   WHERE schemaname = '_analytics' AND relname LIKE 'log_events_%'
   ORDER BY n_live_tup DESC;" 2>/dev/null || true)

if [ -z "$TABLES" ]; then
  echo "[$(date)] No log_events tables found"
  exit 0
fi

for tbl in $TABLES; do
  echo "[$(date)] Trimming $tbl (keep ${RETENTION_DAYS}d, batch $BATCH_SIZE)"
  total=0
  while true; do
    deleted=$(docker exec "$CONTAINER" psql -U "$PSQL_USER" -d _supabase -At -c \
      "WITH d AS (
         DELETE FROM $tbl
         WHERE ctid IN (
           SELECT ctid FROM $tbl
           WHERE \"timestamp\" < now() - interval '${RETENTION_DAYS} days'
           LIMIT ${BATCH_SIZE}
         )
         RETURNING 1
       ) SELECT count(*) FROM d;" 2>/dev/null || echo 0)
    deleted=${deleted:-0}
    total=$((total + deleted))
    [ "$deleted" -eq 0 ] && break
    echo "[$(date)]   deleted batch $deleted (total $total)"
    sleep 1
  done
  docker exec "$CONTAINER" psql -U "$PSQL_USER" -d _supabase -c "VACUUM ANALYZE $tbl;" 2>/dev/null || true
  echo "[$(date)] Done $tbl (removed $total rows)"
done
