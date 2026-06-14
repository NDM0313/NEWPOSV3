#!/bin/bash
# One-shot VPS CPU / Postgres autovacuum diagnostic. Safe read-only.
set -eu

echo "=== LOAD ==="
uptime

echo "=== TOP CPU (non-ssh) ==="
ps aux --sort=-%cpu | grep -v 'sshd\|ps aux' | head -15

echo "=== ZOMBIE COUNT ==="
ps aux | awk '$8 ~ /Z/ {c++} END {print c+0 " zombies"}'

echo "=== DOCKER RESTART/HEALTH ==="
for c in supabase-db supabase-kong supabase-auth supabase-meta supabase-rest supabase-imgproxy erp-frontend; do
  if docker inspect "$c" &>/dev/null; then
    docker inspect "$c" --format "{{.Name}} restart={{.RestartCount}} status={{.State.Status}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}n/a{{end}} started={{.State.StartedAt}}"
  fi
done

echo "=== AUTOVACUUM PROGRESS (_supabase) ==="
docker exec supabase-db psql -U postgres -d _supabase -At -c \
  "SELECT pid, relid::regclass, phase, heap_blks_total, heap_blks_scanned FROM pg_stat_progress_vacuum;" 2>/dev/null || echo "(none or error)"

echo "=== DEAD TUPLES TOP 15 (_supabase) ==="
docker exec supabase-db psql -U postgres -d _supabase -c \
  "SELECT schemaname, relname, n_live_tup, n_dead_tup, last_autovacuum FROM pg_stat_user_tables ORDER BY n_dead_tup DESC LIMIT 15;" 2>/dev/null

echo "=== DEAD TUPLES TOP 15 (postgres main) ==="
docker exec supabase-db psql -U postgres -At -c \
  "SELECT schemaname||'.'||relname, n_live_tup, n_dead_tup FROM pg_stat_user_tables WHERE schemaname='public' ORDER BY n_dead_tup DESC LIMIT 15;" 2>/dev/null

echo "=== ACTIVE PG QUERIES (cpu) ==="
docker exec supabase-db psql -U postgres -c \
  "SELECT pid, usename, datname, state, wait_event_type, left(query,120) AS q FROM pg_stat_activity WHERE state != 'idle' AND query NOT LIKE '%pg_stat_activity%' ORDER BY pid LIMIT 20;" 2>/dev/null

echo "=== RECENT CRON LOGS ==="
tail -5 /var/log/kong-auto-repair.log 2>/dev/null || true
ls -lt /root/NEWPOSV3/deploy/*.log 2>/dev/null | head -3 || true

echo "=== RUNNING DEPLOY/DOCKER RUN ==="
ps aux | grep -E 'deploy\.sh|verify-mobile|docker run' | grep -v grep | head -10 || true

echo "=== DONE ==="
