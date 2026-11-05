#!/usr/bin/env bash
set -euo pipefail
docker exec supabase-db psql -U postgres -d ledger_stage_20260919_prodcheck -c "\d public.users"
docker exec supabase-db psql -U postgres -d ledger_stage_20260919_prodcheck -t -A -c \
  "SELECT id::text FROM companies WHERE id <> 'e08a04af-22a8-4869-9b4d-da31fce13158' LIMIT 3;"
