#!/bin/bash
POSTGRES_PASSWORD=$(grep -m1 '^POSTGRES_PASSWORD=' /root/supabase/docker/.env | cut -d= -f2- | tr -d '\r"')
docker cp /tmp/list-company-branches.sql supabase-db:/tmp/list-company-branches.sql
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" supabase-db psql -U postgres -d ledger_stage_20260623 -f /tmp/list-company-branches.sql
