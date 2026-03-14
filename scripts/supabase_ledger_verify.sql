-- =============================================================================
-- Supabase Ledger Backend Verification (run in SQL Editor)
-- =============================================================================
-- 1) Tables exist
-- 2) RLS enabled and policies allow SELECT + INSERT for ledger_master / ledger_entries
-- 3) Helper functions exist (get_user_company_id, get_user_role)
-- =============================================================================

-- Tables
SELECT 'ledger_master' AS obj, EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ledger_master') AS exists;
SELECT 'ledger_entries' AS obj, EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ledger_entries') AS exists;

-- RLS enabled
SELECT relname AS table_name, relrowsecurity AS rls_enabled
FROM pg_class
WHERE relname IN ('ledger_master', 'ledger_entries');

-- Policies on ledger_master (need SELECT + INSERT for User Ledger to work)
SELECT schemaname, tablename, policyname, cmd, qual::text AS using_expr, with_check::text
FROM pg_policies
WHERE tablename = 'ledger_master'
ORDER BY policyname;

-- Policies on ledger_entries (need SELECT + INSERT)
SELECT schemaname, tablename, policyname, cmd, qual::text AS using_expr, with_check::text
FROM pg_policies
WHERE tablename = 'ledger_entries'
ORDER BY policyname;

-- Helpers (must return non-null for authenticated user)
SELECT get_user_company_id() AS company_id, get_user_role() AS role;
