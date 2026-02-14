-- =============================================================================
-- RLS FINAL VALIDATION – Supabase SQL Editor (paste entire block)
-- Run Part A anytime. Part B requires authenticated session (auth.uid() non-null).
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- PART A: Server-side checks (no auth required)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) relrowsecurity + relforcerowsecurity
SELECT
  c.relname,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS force_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('purchases', 'rentals', 'expenses')
ORDER BY c.relname;
-- Expected: rls_enabled=true, force_rls=true for all three

-- 2) Policies (12 total: 4 per table)
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('purchases', 'rentals', 'expenses')
ORDER BY tablename, policyname;
-- Expected: 12 rows (SELECT, INSERT, UPDATE, DELETE × 3 tables)

-- 3) Policy count summary
SELECT tablename, count(*) AS policy_count
FROM pg_policies
WHERE tablename IN ('purchases', 'rentals', 'expenses')
GROUP BY tablename;
-- Expected: purchases=4, rentals=4, expenses=4

-- 4) Sample users + company_id (for troubleshooting)
SELECT id, company_id, email, role
FROM public.users
ORDER BY email
LIMIT 10;

-- 5) Data distribution by company (admin view – bypasses RLS when run as service role)
SELECT 'purchases' AS tbl, company_id, count(*) AS cnt FROM purchases GROUP BY company_id
UNION ALL
SELECT 'rentals', company_id, count(*) FROM rentals GROUP BY company_id
UNION ALL
SELECT 'expenses', company_id, count(*) FROM expenses GROUP BY company_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- PART B: Authenticated checks (run while logged in; auth.uid() must be non-null)
-- In SQL Editor: use "Run as user" or run from app context.
-- =============================================================================

-- 6) auth.uid() → public.users mapping
SELECT auth.uid() AS current_user_id;
SELECT id, company_id, email, role
FROM public.users
WHERE id = auth.uid();
-- Expected: 1 row. If 0 rows → user missing in public.users → RLS blocks everything.

-- 7) RLS-filtered counts (what authenticated user sees)
SELECT
  (SELECT count(*) FROM purchases) AS purchases_count,
  (SELECT count(*) FROM rentals) AS rentals_count,
  (SELECT count(*) FROM expenses) AS expenses_count;

-- 8) Sample latest rows (RLS-filtered)
SELECT 'purchases' AS tbl, id, supplier_name, total, status, company_id, created_at
FROM purchases ORDER BY created_at DESC LIMIT 3;
SELECT 'rentals' AS tbl, id, booking_no, status, return_date, company_id, created_at
FROM rentals ORDER BY created_at DESC LIMIT 3;
SELECT 'expenses' AS tbl, id, expense_no, amount, category, status, company_id, created_at
FROM expenses ORDER BY created_at DESC LIMIT 3;
