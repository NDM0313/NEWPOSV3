# ERP Commission Batch — RLS Fix

## Observed behavior

Post Commission failed with:

`new row violates row-level security policy for table "commission_batches"`

and `403 (Forbidden)` on POST to the Supabase `commission_batches` endpoint.

## Root cause

The `commission_batches` table had no RLS policies (or had policies that blocked INSERT). Supabase uses RLS by default; with no policy allowing INSERT for the authenticated user, the insert was rejected.

## Fix

**New migration: `migrations/commission_batches_rls_company_scoped.sql`**

- Enables RLS on `commission_batches`.
- Adds company-scoped policies using existing helpers `get_user_company_id()` and `has_branch_access(branch_id)`:
  - **SELECT**: User can see rows where `company_id = get_user_company_id()` and (`branch_id` is null or `has_branch_access(branch_id)`).
  - **INSERT**: User can insert rows with the same company and branch checks (so Post Commission can create a batch).
  - **UPDATE**: User can update rows where `company_id = get_user_company_id()` (e.g. to set `journal_entry_id` after creating the JE).

No DELETE policy was added; batches are not deleted in the normal flow.

## Applying the fix

Run the migration in your local Supabase (e.g. SQL Editor):

```bash
# From project root, run the SQL file contents in Supabase Dashboard → SQL Editor
# Or: supabase db push (if using Supabase CLI)
```

File to run: `migrations/commission_batches_rls_company_scoped.sql`.

## Verification

1. Open Reports → Commission.
2. Select period/salesman/filters so there is pending commission.
3. Click **Post Commission**.
4. The batch should be created and the journal entry linked; no 403 / RLS error.
5. Report should refresh and show the posted amount.

## Rollback

To revert RLS (not recommended in production):

- Disable RLS: `ALTER TABLE public.commission_batches DISABLE ROW LEVEL SECURITY;`
- Or drop the new policies and recreate any previous ones you had.
