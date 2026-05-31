-- ============================================
-- PRE-WIPE PREVIEW — read-only row estimates
-- ============================================
-- Run BEFORE deploy/wipe-public-schema-data.sql.
-- Save this output for the wipe log (docs/public_schema_wipe_log.md).
-- ============================================

\echo '=== PUBLIC SCHEMA TABLE ROW ESTIMATES (pre-wipe) ==='
\echo ''

SELECT
  schemaname,
  relname AS table_name,
  n_live_tup AS approx_rows
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC, relname;

\echo ''
\echo '=== TOTAL APPROXIMATE ROWS (all public tables) ==='

SELECT COALESCE(SUM(n_live_tup), 0)::bigint AS total_approx_rows
FROM pg_stat_user_tables
WHERE schemaname = 'public';

\echo ''
\echo '=== TABLES THAT WILL BE TRUNCATED (excludes schema_migrations, migration_history) ==='

SELECT COUNT(*)::integer AS tables_to_truncate
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT IN ('schema_migrations', 'migration_history');
