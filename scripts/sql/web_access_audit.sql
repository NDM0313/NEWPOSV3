-- =====================================================================
-- web_access_audit.sql
-- =====================================================================
-- Reports the current state of row-level security (RLS) policies and
-- grant-based access across every table in the public schema, so that
-- overlapping / duplicate / obsolete rules can be found and cleaned up.
--
-- Run with:
--   docker exec -i supabase-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 \
--     -f /tmp/web_access_audit.sql > /tmp/web_access_audit.out 2>&1
--
-- All SELECTs are read-only; no data is mutated.
-- =====================================================================

\echo '============================================================'
\echo ' 1. Tables & RLS status'
\echo '============================================================'
SELECT
  n.nspname AS schema,
  c.relname AS table,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced,
  COALESCE(p.policy_count, 0) AS policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN (
  SELECT schemaname, tablename, COUNT(*) AS policy_count
  FROM pg_policies
  GROUP BY schemaname, tablename
) p ON p.schemaname = n.nspname AND p.tablename = c.relname
WHERE c.relkind = 'r'
  AND n.nspname = 'public'
ORDER BY c.relname;

\echo ''
\echo '============================================================'
\echo ' 2. All RLS policies (per-table, per-role, per-command)'
\echo '============================================================'
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  LEFT(qual::text, 80) AS using_expr,
  LEFT(with_check::text, 80) AS check_expr
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;

\echo ''
\echo '============================================================'
\echo ' 3. Potential duplicates: same (table, cmd, roles) appears 2+'
\echo '============================================================'
SELECT
  tablename,
  cmd,
  roles,
  COUNT(*) AS dup_count,
  array_agg(policyname ORDER BY policyname) AS policy_names
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename, cmd, roles
HAVING COUNT(*) > 1
ORDER BY dup_count DESC, tablename;

\echo ''
\echo '============================================================'
\echo ' 4. Table-level grants outside the default auth roles'
\echo '============================================================'
SELECT
  grantee,
  table_name,
  string_agg(DISTINCT privilege_type, ', ' ORDER BY privilege_type) AS privs
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee NOT IN ('postgres', 'supabase_admin', 'PUBLIC')
GROUP BY grantee, table_name
ORDER BY table_name, grantee;

\echo ''
\echo '============================================================'
\echo ' 5. Column-level grants (highlights over-permissive updates)'
\echo '============================================================'
SELECT
  grantee,
  table_name,
  column_name,
  privilege_type
FROM information_schema.role_column_grants
WHERE table_schema = 'public'
  AND grantee NOT IN ('postgres', 'supabase_admin', 'PUBLIC')
ORDER BY table_name, column_name, grantee;

\echo ''
\echo '============================================================'
\echo ' 6. Tables WITHOUT any RLS policy (dangerous if RLS enabled)'
\echo '============================================================'
SELECT
  n.nspname AS schema,
  c.relname AS table,
  c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policies p ON p.schemaname = n.nspname AND p.tablename = c.relname
WHERE c.relkind = 'r'
  AND n.nspname = 'public'
  AND c.relrowsecurity = true
  AND p.policyname IS NULL
ORDER BY c.relname;

\echo ''
\echo '============================================================'
\echo ' 7. Functions runnable by authenticated role'
\echo '============================================================'
SELECT
  p.proname AS function,
  pg_get_function_identity_arguments(p.oid) AS args,
  CASE p.prosecdef WHEN true THEN 'DEFINER' ELSE 'INVOKER' END AS security
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
ORDER BY p.proname;

\echo ''
\echo '============================================================'
\echo ' Audit complete.'
\echo '============================================================'
