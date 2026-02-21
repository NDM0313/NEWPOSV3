-- ============================================
-- DAY 4 – Quick Verification Queries
-- Run in Supabase SQL Editor
-- ============================================

-- 1. RLS Status (MANDATORY - expect relrowsecurity = true)
-- Migration 43_enable_rls_purchases_rentals_expenses applied
SELECT n.nspname AS schema, c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relname IN ('expenses', 'purchases', 'rentals')
  AND n.nspname = 'public';

-- 2. Purchases – Latest 5 (schema: supplier_name, total)
SELECT id, supplier_name, total, status, created_at, updated_at
FROM purchases
ORDER BY created_at DESC
LIMIT 5;

-- 3. Rentals – Latest 5 (schema: return_date, late_fee)
SELECT id, booking_no, status, return_date, late_fee, created_at, updated_at
FROM rentals
ORDER BY created_at DESC
LIMIT 5;

-- 4. Expenses – Latest 5
SELECT id, expense_no, amount, category, payment_method, status, created_at, updated_at
FROM expenses
ORDER BY created_at DESC
LIMIT 5;

-- 5. Single Purchase Verification (replace PURCHASE_ID)
-- SELECT id, total, status, created_at, updated_at FROM purchases WHERE id = 'PURCHASE_ID';

-- 6. Single Rental Verification (replace RENTAL_ID)
-- SELECT id, status, return_date, late_fee, created_at, updated_at FROM rentals WHERE id = 'RENTAL_ID';

-- 7. Single Expense Verification (replace EXPENSE_ID)
-- SELECT id, amount, status, created_at, updated_at FROM expenses WHERE id = 'EXPENSE_ID';

-- 8. RLS Policies (all three tables)
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('purchases', 'rentals', 'expenses')
ORDER BY tablename, policyname;
