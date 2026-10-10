#!/bin/bash
set -eu
date
uptime
echo "---TRIM---"
pgrep -af 'vps-trim-logflare' || echo "trim not running"
echo "---ROWS---"
docker exec supabase-db psql -U postgres -d _supabase -At -c "SELECT n_live_tup FROM pg_stat_user_tables WHERE relname='log_events_69440b5f_7061_41f2_8774_6a585ac5c3fe';"
echo "---VACUUM---"
docker exec supabase-db psql -U postgres -c "SELECT pid, datname, relid::regclass, phase FROM pg_stat_progress_vacuum;"
echo "---STATS---"
docker stats --no-stream --format '{{.Name}} {{.CPUPerc}} {{.MemUsage}}' | head -20
echo "---TOP CPU---"
ps aux --sort=-%cpu | head -20
echo "---ZOMBIES---"
ps aux | awk '$8 ~ /Z/ {c++} END {print c+0}'
echo "---SERVICES---"
docker service ls | grep -E 'dincouture-n8n|instagram-media-helper' || true
echo "---ERP---"
curl -sS -o /dev/null -w 'erp:%{http_code}\n' https://erp.dincouture.pk/
