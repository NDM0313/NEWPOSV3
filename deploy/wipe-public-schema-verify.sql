-- ============================================
-- POST-WIPE VERIFICATION — confirm public tables are empty
-- ============================================
-- Run AFTER deploy/wipe-public-schema-data.sql.
-- Expect row_count = 0 for all tables except schema_migrations and migration_history.
-- ============================================

\echo '=== POST-WIPE ROW COUNTS (public schema) ==='
\echo ''

DO $$
DECLARE
  r RECORD;
  row_cnt bigint;
  nonempty_count integer := 0;
  total_tables integer := 0;
BEGIN
  FOR r IN (
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  ) LOOP
    total_tables := total_tables + 1;
    EXECUTE format('SELECT COUNT(*) FROM public.%I', r.tablename) INTO row_cnt;

    IF row_cnt > 0 AND r.tablename NOT IN ('schema_migrations', 'migration_history') THEN
      nonempty_count := nonempty_count + 1;
      RAISE WARNING 'NON-EMPTY: public.% has % rows', r.tablename, row_cnt;
    ELSIF row_cnt > 0 THEN
      RAISE NOTICE 'OK (preserved): public.% has % rows', r.tablename, row_cnt;
    ELSE
      RAISE NOTICE 'EMPTY: public.%', r.tablename;
    END IF;
  END LOOP;

  IF nonempty_count > 0 THEN
    RAISE EXCEPTION 'WIPE VERIFICATION FAILED: % table(s) still contain data.', nonempty_count;
  END IF;

  RAISE NOTICE 'WIPE VERIFICATION PASSED: % public tables checked; all empty except schema_migrations / migration_history.', total_tables;
END $$;

\echo ''
\echo '=== DETAILED ROW COUNTS (for log) ==='

DO $$
DECLARE
  r RECORD;
  row_cnt bigint;
BEGIN
  RAISE NOTICE 'table_name | row_count';
  FOR r IN (
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  ) LOOP
    EXECUTE format('SELECT COUNT(*) FROM public.%I', r.tablename) INTO row_cnt;
    RAISE NOTICE '% | %', r.tablename, row_cnt;
  END LOOP;
END $$;

\echo ''
\echo '=== GLOBAL SEQUENCES (non-identity; flag if last_value > 0) ==='

SELECT
  schemaname,
  sequencename AS sequence_name,
  last_value
FROM pg_sequences
WHERE schemaname = 'public'
ORDER BY sequencename;
