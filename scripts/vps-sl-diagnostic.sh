#!/bin/bash
set -e
docker exec -i supabase-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -f /root/NEWPOSV3/scripts/sync-sl-sequence-diagnostic.sql
