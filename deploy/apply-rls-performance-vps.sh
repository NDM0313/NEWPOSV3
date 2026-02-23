#!/bin/bash
# Apply RLS performance fix (account_transactions: use (select auth.role())). Run on VPS.
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONTAINER=$(docker ps --format '{{.Names}}' | grep -E '^db$|^supabase-db$|^postgres$|supabase.*db' | head -1)
[ -z "$CONTAINER" ] && { echo "[apply-rls-perf] No DB container. Skip."; exit 0; }
echo "[apply-rls-perf] Applying RLS performance fix in $CONTAINER..."
if [ -f "$SCRIPT_DIR/rls-performance-fix.sql" ]; then
  docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=0 < "$SCRIPT_DIR/rls-performance-fix.sql" || true
else
  docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=0 <<'EOSQL' || true
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'account_transactions') THEN
    DROP POLICY IF EXISTS "Allow authenticated read access" ON public.account_transactions;
    CREATE POLICY "Allow authenticated read access" ON public.account_transactions
      FOR SELECT USING ((SELECT auth.role()) = 'authenticated');
    DROP POLICY IF EXISTS "Allow authenticated insert access" ON public.account_transactions;
    CREATE POLICY "Allow authenticated insert access" ON public.account_transactions
      FOR INSERT WITH CHECK ((SELECT auth.role()) = 'authenticated');
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
EOSQL
fi
echo "[apply-rls-perf] Done."
