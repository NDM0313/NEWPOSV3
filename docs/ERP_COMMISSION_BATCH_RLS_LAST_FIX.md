# ERP Commission Batches RLS — Last Fix

## Problem

Post Commission still returns 403 / "new row violates row-level security policy for table commission_batches" even after applying `commission_batches_rls_company_scoped.sql`.

## Possible causes

1. **Migration not applied** — The RLS migration was never run in the local DB.
2. **Helper functions missing** — Policies use `get_user_company_id()` and `has_branch_access()`. If these don’t exist or behave differently (e.g. return NULL), the policy fails.
3. **Identity mismatch** — `auth.uid()` may not match how your app links users (e.g. `users.id` vs `users.auth_user_id`).

## Fix 1: Apply original migration

Ensure the original RLS migration has been run:

- **File:** `migrations/commission_batches_rls_company_scoped.sql`
- Run it in Supabase SQL Editor (or your migration runner).
- It enables RLS and creates SELECT/INSERT/UPDATE policies using `get_user_company_id()` and `has_branch_access(branch_id)`.

## Fix 2: Inline policies (no helper dependency)

If 403 persists, use the **inline** version so policies do not depend on helper functions:

- **File:** `migrations/commission_batches_rls_inline_company.sql`
- This migration:
  - Enables RLS and drops existing commission_batches policies.
  - Recreates SELECT/INSERT/UPDATE using **inline subqueries**:
    - Company: `company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid() OR auth_user_id = auth.uid())`
    - Branch: `branch_id IS NULL OR EXISTS (SELECT 1 FROM user_branches ub JOIN users u ON u.id = ub.user_id WHERE ub.branch_id = commission_batches.branch_id AND (u.id = auth.uid() OR u.auth_user_id = auth.uid()))`

Run **one** of the two migrations (either the original or the inline). The inline one is the fallback when helpers are missing or return NULL.

## Verify

1. Run the chosen migration in your **local** Supabase project.
2. Open Reports → Commission, choose a period/filters with pending commission.
3. Click **Post Commission**.
4. You should get success: batch row created, journal entry created, sales updated to `commission_status = 'posted'` and `commission_batch_id` set. No 403.

## Rollback

To disable RLS (not recommended in production):

```sql
ALTER TABLE public.commission_batches DISABLE ROW LEVEL SECURITY;
```

To revert to previous policies, drop the new policies and recreate your originals.
