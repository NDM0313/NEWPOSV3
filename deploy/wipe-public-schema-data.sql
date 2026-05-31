-- ============================================
-- FULL PUBLIC SCHEMA DATA WIPE
-- ============================================
-- DESTRUCTIVE: Removes ALL rows from every public base table.
-- Schema (columns, types, indexes, RLS, triggers, functions) is preserved.
--
-- EXCLUDED: schema_migrations, migration_history (migration runner history)
-- NOT TOUCHED: auth.*, storage.objects
--
-- BEFORE RUNNING:
--   1. Take a full DB backup (deploy/supabase-backup.sh or Cloud backup)
--   2. Run deploy/wipe-public-schema-preview.sql and save the output
--   3. After wipe, run deploy/wipe-public-schema-verify.sql
--   4. Manually delete auth user in Supabase Dashboard → Authentication → Users
--      (required to re-register with the same email)
--
-- PARTIAL RESET (keep companies/users/branches): use deploy/truncate-all-data.sql
-- ============================================

BEGIN;

DO $$
DECLARE
  r RECORD;
  wiped_count integer := 0;
BEGIN
  BEGIN
    PERFORM set_config('session_replication_role', 'replica', true);
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'session_replication_role=replica skipped (insufficient privilege); continuing with TRUNCATE CASCADE';
  END;

  FOR r IN (
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT IN ('schema_migrations', 'migration_history')
    ORDER BY tablename
  ) LOOP
    EXECUTE format('TRUNCATE TABLE public.%I CASCADE', r.tablename);
    wiped_count := wiped_count + 1;
    RAISE NOTICE 'TRUNCATED public.%', r.tablename;
  END LOOP;

  BEGIN
    PERFORM set_config('session_replication_role', 'origin', true);
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;

  RAISE NOTICE 'WIPE COMPLETE: % public tables truncated (schema_migrations, migration_history preserved).', wiped_count;
END $$;

-- Restart public sequences where permitted (best-effort; non-fatal)
DO $$
DECLARE
  s RECORD;
BEGIN
  FOR s IN (
    SELECT sequence_name
    FROM information_schema.sequences
    WHERE sequence_schema = 'public'
  ) LOOP
    BEGIN
      EXECUTE format('ALTER SEQUENCE public.%I RESTART WITH 1', s.sequence_name);
      RAISE NOTICE 'RESTARTED SEQUENCE public.%', s.sequence_name;
    EXCEPTION
      WHEN insufficient_privilege OR OTHERS THEN
        RAISE NOTICE 'Skipped sequence restart: public.% (%).', s.sequence_name, SQLERRM;
    END;
  END LOOP;
END $$;

COMMIT;
