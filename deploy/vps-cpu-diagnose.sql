-- Read-only CPU/autovacuum diagnostic queries
\echo '=== AUTOVACUUM IN PROGRESS ==='
SELECT pid, datname, relid::regclass AS tbl, phase,
       heap_blks_total, heap_blks_scanned, heap_blks_vacuumed
FROM pg_stat_progress_vacuum;

\echo '=== _supabase DEAD TUPLES TOP 10 ==='
\c _supabase
SELECT schemaname, relname, n_live_tup, n_dead_tup, last_autovacuum
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC
LIMIT 10;

\echo '=== public DEAD TUPLES TOP 10 ==='
\c postgres
SELECT schemaname, relname, n_live_tup, n_dead_tup, last_autovacuum
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_dead_tup DESC
LIMIT 10;

\echo '=== LOG EVENTS TABLE SIZE ==='
\c _supabase
SELECT pg_size_pretty(pg_total_relation_size('_analytics.log_events_69440b5f_7061_41f2_8774_6a585ac5c3fe')) AS total_size,
       count(*) AS row_count
FROM _analytics.log_events_69440b5f_7061_41f2_8774_6a585ac5c3fe;

\echo '=== LOG EVENTS COLUMNS ==='
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = '_analytics'
  AND table_name = 'log_events_69440b5f_7061_41f2_8774_6a585ac5c3fe'
ORDER BY ordinal_position
LIMIT 20;

\echo '=== ACTIVE NON-IDLE QUERIES ==='
\c postgres
SELECT pid, datname, state, wait_event_type, left(query, 100) AS q
FROM pg_stat_activity
WHERE state <> 'idle'
  AND query NOT LIKE '%pg_stat_activity%'
ORDER BY pid
LIMIT 15;
