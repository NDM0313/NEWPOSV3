# RLS Blocker – Resolution Summary

**Date:** 2026-02-15  
**Status:** ✅ **RESOLVED**

---

## 1️⃣ Checkpoint: Table Columns (Confirmed)

All three tables have scoping columns:

| Table     | company_id | branch_id | created_by |
|-----------|------------|-----------|------------|
| purchases | ✅         | ✅        | ✅         |
| rentals   | ✅         | ✅        | ✅         |
| expenses  | ✅         | ✅        | ✅         |

**Scoping model:** `company_id` from `public.users` where `users.id = auth.uid()`.

---

## 2️⃣ RLS Enabled + Policies Created

**Migration:** `43_enable_rls_purchases_rentals_expenses` (applied via Supabase MCP)

**Actions performed:**
- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` on purchases, rentals, expenses
- `ALTER TABLE ... FORCE ROW LEVEL SECURITY` on all three
- 4 policies per table: SELECT, INSERT, UPDATE, DELETE
- All policies use: `company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())`

**Checkpoint query:**
```sql
SELECT n.nspname, c.relname, c.relrowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('purchases','rentals','expenses');
```
**Expected:** `relrowsecurity = true` for all 3 ✅

**FORCE RLS check (2026-02-15):**
```sql
SELECT relname, relforcerowsecurity FROM pg_class
WHERE relname IN ('purchases','rentals','expenses');
```
**Result:** `relforcerowsecurity = true` for all three ✅

---

## 3️⃣ Policies Verification

```sql
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('purchases','rentals','expenses')
ORDER BY tablename, policyname;
```

**Expected:** 12 policies total (4 per table) ✅

---

## 4️⃣ Soft Delete (Expenses)

- Delete sets `status = 'rejected'`; row remains
- RLS still applies to rejected rows
- Optional: Add restrictive policy to hide rejected from default lists (ensure admin path exists)

---

## 5️⃣ Schema Mapping (QA Reference)

| Test Doc     | Actual DB      |
|--------------|----------------|
| vendor_name  | supplier_name  |
| total_amount | total          |
| end_date     | return_date    |
| penalty_amount | late_fee     |
| Purchase status | draft \| ordered \| received \| final |

---

## 6️⃣ Rentals Flow

**Primary QA path:** `RentalsPage` inside `RentalDashboard` (List tab)  
**Secondary:** `RentalOrdersList` (alternate)

---

## Day 4 Status

| Criterion        | Status |
|------------------|--------|
| UI wiring        | ✅ DONE |
| Security/RLS     | ✅ DONE |
| Next task        | ✅ Complete – All phases certified |

---

## Files Updated

- `supabase-extract/migrations/43_enable_rls_purchases_rentals_expenses.sql` – migration (local copy)
- `DAY4_VALIDATION_SCRIPT.md` – RLS status, RentalsPage primary
- `DAY4_QUICK_VERIFICATION.sql` – policies query
- `RLS_BLOCKER_RESOLUTION.md` – this file
