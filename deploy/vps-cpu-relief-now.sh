#!/bin/bash
# Immediate VPS CPU relief — safe, idempotent.
# Run on VPS: bash deploy/vps-cpu-relief-now.sh

set -eu

echo "[relief] Load before: $(uptime)"

# 1) Stop overlapping auto-deploy builds (keep running ERP containers)
if pgrep -f 'deploy/vps-auto-pull-cron.sh|deploy/deploy.sh' >/dev/null 2>&1; then
  echo "[relief] Stopping stuck auto-deploy..."
  pkill -f 'deploy/vps-auto-pull-cron.sh' 2>/dev/null || true
  pkill -f 'deploy/deploy.sh' 2>/dev/null || true
  sleep 2
  pkill -9 -f 'docker compose.*build.*erp' 2>/dev/null || true
  pkill -9 -f 'docker run --rm.*node:20-alpine' 2>/dev/null || true
fi

# 2) Trim Logflare log_events bloat (3M+ rows drives autovacuum on _supabase)
if [ -f /root/NEWPOSV3/deploy/vps-trim-logflare-logs.sh ]; then
  LOGFLARE_RETENTION_DAYS=2 bash /root/NEWPOSV3/deploy/vps-trim-logflare-logs.sh || true
else
  echo "[relief] Trimming log_events (inline fallback)..."
  docker exec supabase-db psql -U supabase_admin -d _supabase -v ON_ERROR_STOP=0 -c \
    "DELETE FROM _analytics.log_events_69440b5f_7061_41f2_8774_6a585ac5c3fe
     WHERE ctid IN (
       SELECT ctid FROM _analytics.log_events_69440b5f_7061_41f2_8774_6a585ac5c3fe
       WHERE \"timestamp\" < now() - interval '2 days' LIMIT 50000
     );" 2>/dev/null || true
fi

# 3) Replace aggressive 5-min crons with safer hourly + daily log trim
CRON_BAK="/root/crontab.bak.$(date +%Y%m%d%H%M)"
crontab -l > "$CRON_BAK" 2>/dev/null || true
{
  crontab -l 2>/dev/null | grep -v 'vps-auto-pull-cron.sh' | grep -v 'kong-auto-repair-if-needed.sh' | grep -v 'studio-auto-repair-if-needed.sh' | grep -v 'vps-trim-logflare-logs.sh' || true
  echo "0 * * * * flock -n /var/lock/newposv3-deploy.lock /root/NEWPOSV3/deploy/vps-auto-pull-cron.sh"
  echo "15 4 * * * /root/NEWPOSV3/deploy/vps-trim-logflare-logs.sh >> /var/log/logflare-trim.log 2>&1"
} | crontab -
echo "[relief] Crontab updated (backup: $CRON_BAK)"

echo "[relief] Zombies: $(ps aux | awk '$8 ~ /Z/ {c++} END {print c+0}')"
echo "[relief] Load after: $(uptime)"
echo "[relief] Done."
