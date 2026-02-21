-- =============================================================================
-- AUTHENTICATED VALIDATION – Run while LOGGED IN as a normal user
-- =============================================================================
-- Option A: Use the app UI: Test Pages > RLS Validation > Run Validation
-- Option B: Supabase SQL Editor with "Run as user" (if available)
-- Option C: Run from your app's authenticated context
-- Note: auth.uid() returns NULL when run without a session.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 1 — Validate JWT + public.users mapping
-- ─────────────────────────────────────────────────────────────────────────────

SELECT auth.uid() AS current_user_id;
-- Expected: One UUID (your user id). If NULL → no auth session; run from app.

SELECT id, company_id, email, role
FROM public.users
WHERE id = auth.uid();
-- Expected: Exactly one row. company_id must match your test data.
-- If 0 rows → RLS will silently block everything.

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 2 — Confirm Company Isolation (Same Company)
-- ─────────────────────────────────────────────────────────────────────────────

SELECT count(*) AS purchases_count FROM purchases;
SELECT count(*) AS rentals_count FROM rentals;
SELECT count(*) AS expenses_count FROM expenses;
-- Expected: Only your company's rows. Compare with known totals.

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 3 — INSERT Policy Validation (after creating purchase via UI)
-- ─────────────────────────────────────────────────────────────────────────────

-- Replace 'NEW_PURCHASE_ID' with the id of a purchase you just created.
-- SELECT company_id FROM purchases WHERE id = 'NEW_PURCHASE_ID';
-- Expected: company_id matches your user's company_id.

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 4 — UPDATE Policy (manual cross-company test)
-- ─────────────────────────────────────────────────────────────────────────────

-- Login as Company Y user. Try: UPDATE purchases SET total = 999 WHERE id = 'COMPANY_X_PURCHASE_ID';
-- Expected: 0 rows affected (blocked by RLS).

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 5 — DELETE Policy (Expense Soft Delete)
-- ─────────────────────────────────────────────────────────────────────────────

-- After deleting expense via UI:
-- SELECT status, company_id FROM expenses WHERE id = 'EXPENSE_ID';
-- Expected: status = 'rejected', company_id unchanged.

-- Login as another company user. Run: SELECT * FROM expenses WHERE id = 'EXPENSE_ID';
-- Expected: 0 rows (RLS hides it).

-- =============================================================================
-- CRITICAL CHECK (no auth required – can run anytime)
-- =============================================================================

SELECT relname, relforcerowsecurity
FROM pg_class
WHERE relname IN ('purchases', 'rentals', 'expenses');
-- Expected: relforcerowsecurity = true for all three.
