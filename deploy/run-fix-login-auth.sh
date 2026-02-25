#!/bin/bash
# Fix login 400 (Invalid email or password). No Docker build. Run on VPS: cd ~/NEWPOSV3 && bash deploy/run-fix-login-auth.sh
set -e
cd "$(dirname "$0")/.."
CONTAINER=$(docker ps --format '{{.Names}}' | grep -E '^db$|^supabase-db$|^postgres$|supabase.*db' | head -1)
[ -z "$CONTAINER" ] && echo "ERROR: No Postgres container (db/supabase-db/postgres)." && exit 1
echo "[fix-login] Using $CONTAINER"
if [ -f deploy/fix-login-auth-only.sql ]; then
  docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 < deploy/fix-login-auth-only.sql
else
  bash deploy/fix-quick-login-users-vps.sh
fi
echo "[fix-login] Done. Try Admin / Info / Demo quick login on https://erp.dincouture.pk/m/"
