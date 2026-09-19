#!/usr/bin/env bash
set -euo pipefail
docker exec supabase-db psql -U postgres -d ledger_stage_20260919_prodcheck -t -A -c \
  "SELECT current_database() || '|' || pg_size_pretty(pg_database_size(current_database()));"
docker exec supabase-db psql -U postgres -d ledger_stage_20260919_prodcheck -t -A -c \
  "SELECT to_regprocedure('public.resolve_journal_posting_account_id(uuid,uuid)') IS NOT NULL;"
cd /root/je-guard-stage
docker compose -p je-guard-stage down
echo '--- remaining containers ---'
docker ps --format '{{.Names}} {{.Ports}}' | grep -E 'je-guard|supabase-(auth|rest|kong|db)' || true
docker exec supabase-db psql -U postgres -d postgres -t -A -c \
  "SELECT datname FROM pg_database WHERE datname='ledger_stage_20260919_prodcheck';"
echo TEARDOWN_OK
