#!/bin/bash
set -eu

echo "=== DATE/LOAD ==="
date
uptime

echo "=== SERVICES ==="
docker service ls | grep -E 'dincouture-n8n|instagram-media-helper' || true

echo "=== DOCKER STATS ==="
docker stats --no-stream --format '{{.Name}} {{.CPUPerc}} {{.MemUsage}}' | head -20

echo "=== TOP CPU PROCESSES ==="
ps aux --sort=-%cpu | head -25

echo "=== ZOMBIES ==="
ps aux | awk '$8 ~ /Z/ {c++} END {print c+0}'

echo "=== HEALTHCHECK PIDs ==="
for pid in $(pgrep -f "localhost:8080/health|studio:3000/api/platform/profile|node -e" 2>/dev/null || true); do
  echo "--- PID=$pid ---"
  ps -p "$pid" -o pid,ppid,stat,pcpu,pmem,cmd 2>/dev/null || true
  cat /proc/$pid/cgroup 2>/dev/null | tail -5 || true
done

echo "=== CONTAINERS WITH HEALTHCHECKS ==="
for id in $(docker ps -q); do
  docker inspect "$id" --format 'name={{.Name}} image={{.Config.Image}} status={{.State.Status}} restart={{.RestartCount}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}n/a{{end}} healthcheck={{json .Config.Healthcheck}}' 2>/dev/null | grep -E "localhost:8080|studio:3000|node -e|api/platform/profile|health" || true
done

echo "=== ERP ==="
curl -sS -o /dev/null -w 'erp:%{http_code}\n' https://erp.dincouture.pk/

echo "=== LOGFLARE ROWS ==="
docker exec supabase-db psql -U postgres -d _supabase -At -c "SELECT n_live_tup FROM pg_stat_user_tables WHERE relname='log_events_69440b5f_7061_41f2_8774_6a585ac5c3fe';" 2>/dev/null || true

echo "=== TRIM ==="
pgrep -af vps-trim-logflare || echo trim_not_running
