#!/bin/bash
set -eu

echo "=== STEP 1 CHECK (after limit) ==="
sleep 60
uptime
docker stats --no-stream --format '{{.Name}} {{.CPUPerc}} {{.MemUsage}}' | head -15

echo "=== STEP 2 ENV ==="
docker service inspect dincouture-n8n --format '{{json .Spec.TaskTemplate.ContainerSpec.Env}}' | python3 -m json.tool 2>/dev/null || docker service inspect dincouture-n8n --format '{{json .Spec.TaskTemplate.ContainerSpec.Env}}'

CID=$(docker ps --filter name=dincouture-n8n -q | head -1)
echo "CID=$CID"
docker inspect "$CID" --format 'name={{.Name}} image={{.Config.Image}}'
docker inspect "$CID" --format 'cmd={{json .Config.Cmd}}'
docker inspect "$CID" --format 'mounts={{json .Mounts}}'
docker service inspect dincouture-n8n --format 'limit_cpu={{.Spec.TaskTemplate.Resources.Limits.NanoCPUs}}'

echo "=== STEP 3 LOGS ==="
docker logs --since 10m "$CID" 2>&1 | tail -250 > /root/n8n-current-high-cpu.log
tail -150 /root/n8n-current-high-cpu.log

echo "=== STEP 4 DB TYPE / VOLUME ==="
docker exec "$CID" sh -lc 'ls -lh /home/node/.n8n 2>/dev/null; du -sh /home/node/.n8n 2>/dev/null; ls -lh /home/node/.n8n/database.sqlite* 2>/dev/null || true; env | grep -E "^DB_" || echo NO_DB_ENV'

echo "=== STEP 5 EXECUTIONS ==="
docker exec "$CID" sh -lc 'n8n --version || true; which sqlite3 || echo sqlite3_missing'
if docker exec "$CID" sh -lc 'test -f /home/node/.n8n/database.sqlite && which sqlite3 >/dev/null 2>&1'; then
  docker exec "$CID" sh -lc 'sqlite3 /home/node/.n8n/database.sqlite "select status, count(*) from execution_entity group by status;"'
  docker exec "$CID" sh -lc 'sqlite3 /home/node/.n8n/database.sqlite "select count(*) from execution_entity;"'
fi

echo "=== STEP 6 REPEATED WORKFLOWS IN LOGS ==="
grep -iE 'workflow|timeout|retry|error|IgLnk|execution' /root/n8n-current-high-cpu.log | tail -40 || true

echo "=== STEP 7 LOGFLARE ==="
pgrep -af 'vps-trim-logflare' || echo none
docker exec supabase-db psql -U postgres -d _supabase -At -c "SELECT n_live_tup FROM pg_stat_user_tables WHERE relname='log_events_69440b5f_7061_41f2_8774_6a585ac5c3fe';"

echo "=== STEP 8 FINAL ==="
uptime
docker stats --no-stream --format '{{.Name}} {{.CPUPerc}} {{.MemUsage}}' | head -15
ps aux | awk '$8 ~ /Z/ {c++} END {print c+0}'
curl -sS -o /dev/null -w 'erp:%{http_code}\n' https://erp.dincouture.pk/
curl -sS -o /dev/null -w 'supabase:%{http_code}\n' https://supabase.dincouture.pk/auth/v1/health
