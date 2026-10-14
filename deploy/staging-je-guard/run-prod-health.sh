#!/usr/bin/env bash
set -euo pipefail
docker ps --format '{{.Names}} {{.Status}}' | grep -E 'supabase-(kong|auth|rest|db)'
ANON_KEY=$(grep -E '^ANON_KEY=' /root/supabase/docker/.env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
SERVICE_ROLE_KEY=$(grep -E '^SERVICE_ROLE_KEY=' /root/supabase/docker/.env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
curl -sS --max-time 8 -o /dev/null -w "kong_rest=%{http_code}\n" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" http://127.0.0.1:8000/rest/v1/
curl -sS --max-time 8 -o /dev/null -w "kong_auth=%{http_code}\n" -H "apikey: $ANON_KEY" http://127.0.0.1:8000/auth/v1/settings
curl -sS --max-time 8 -o /dev/null -w "erp=%{http_code}\n" https://erp.dincouture.pk/ || echo "erp=ERR"
curl -sS --max-time 8 -o /dev/null -w "supabase_public=%{http_code}\n" -H "apikey: $ANON_KEY" https://supabase.dincouture.pk/rest/v1/ || echo "supabase_public=ERR"
HA=$(curl -sS --max-time 10 -o /tmp/a.json -w "%{http_code}" -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" "http://127.0.0.1:8000/rest/v1/accounts?select=id&limit=2")
HJ=$(curl -sS --max-time 10 -o /tmp/j.json -w "%{http_code}" -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" "http://127.0.0.1:8000/rest/v1/journal_entries?select=id&limit=2")
echo "accounts=$HA journal_entries=$HJ"
# Avoid hanging docker logs: use --since and timeout
CNT=$(timeout 4 docker logs --since 30m supabase-rest 2>&1 | grep -cEi 'JOURNAL_ACCOUNT|FATAL|panic' || true)
echo "rest_recent_guard_or_fatal_matches=${CNT:-0}"
echo HEALTH_OK
