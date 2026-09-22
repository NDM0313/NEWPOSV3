#!/usr/bin/env bash
set -euo pipefail
echo "=== networks for supabase-db ==="
docker inspect supabase-db -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}'
echo
echo "=== supabase-rest image ==="
docker inspect supabase-rest -f '{{.Config.Image}}'
echo "=== supabase-auth image ==="
docker inspect supabase-auth -f '{{.Config.Image}}'
echo
echo "=== rest env keys (values redacted) ==="
docker inspect supabase-rest -f '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '
  /PGRST|DB_|JWT|DATABASE/ {
    k=$1; $1="";
    if (k ~ /PASS|SECRET|KEY|URI|URL/) print k"=***";
    else print k"="substr($0,2)
  }'
echo
echo "=== auth env keys (values redacted) ==="
docker inspect supabase-auth -f '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '
  /GOTRUE|API_|DB_|JWT|DATABASE|PORT|SITE/ {
    k=$1; $1="";
    if (k ~ /PASS|SECRET|KEY|URI|URL/) print k"=***";
    else print k"="substr($0,2)
  }'
echo
echo "=== postgres user in docker .env (presence only) ==="
if [ -f /root/supabase/docker/.env ]; then
  grep -E '^(POSTGRES_PASSWORD|JWT_SECRET|ANON_KEY|SERVICE_ROLE_KEY)=' /root/supabase/docker/.env | sed 's/=.*/=SET/'
else
  echo "no /root/supabase/docker/.env"
fi
