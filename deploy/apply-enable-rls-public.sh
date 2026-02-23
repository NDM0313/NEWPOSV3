#!/bin/bash
# Enable RLS on all public tables (Security Advisor: "RLS has not been enabled").
# Run on VPS: bash deploy/apply-enable-rls-public.sh
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONTAINER=$(docker ps --format '{{.Names}}' | grep -E '^db$|^supabase-db$|^postgres$|supabase.*db' | head -1)
[ -z "$CONTAINER" ] && { echo "[enable-rls] No DB container. Skip."; exit 0; }
echo "[enable-rls] Enabling RLS on public tables in $CONTAINER..."
docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=0 < "$SCRIPT_DIR/enable-rls-public-tables.sql"
echo "[enable-rls] Done."
