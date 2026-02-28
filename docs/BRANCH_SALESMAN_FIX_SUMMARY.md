# Branch & Salesman Fix — Summary and How to Test

## What was fixed

### 1. **Branch source of truth (identified)**
- **Branch assignment:** `user_branches` table: `user_id` = `public.users.id`, `branch_id` = branch UUID.
- **Context:** `SupabaseContext` loads `accessibleBranchIds` from `user_branches` for non-admin (using `data.id` = public user id). SaleForm filters `branches` by `accessibleBranchIds` → `accessibleBranches`.
- **Why "No branch available" happened:** Either (a) **user_branches** RLS blocked the salesman from reading their row (e.g. policy allowed only `user_id = auth.uid()`, but for invited users `user_id` = public `users.id` ≠ `auth.uid()`), or (b) **branches** RLS blocked SELECT for non-admin, so `getAllBranches()` returned 0 rows.

### 2. **Backend (migration): `migrations/branches_and_user_branches_rls.sql`**
- **Branches SELECT:** Admin sees all company branches; non-admin sees only branches they have access to via `has_branch_access(id)` (so salesman sees only their assigned branch).
- **user_branches SELECT:** User can see rows where `user_id = auth.uid()` OR `user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())`, so both “same id” and “invited user” cases work.

### 3. **Frontend**
- **SupabaseContext:** Added dev logs in `loadUserBranch` (erpUserId, userBranches count, branchError). Logs when fallback leaves accessibleBranchIds empty.
- **SaleForm:**
  - Debug log (dev only): `[SALE FORM BRANCH DEBUG]` with role, uid, companyId, contextBranchId, branchesCount, accessibleBranchesCount, accessibleBranchIdsLength, branchesError.
  - Clearer errors: when there is no branch and user is non-admin → “Your user is not assigned to any branch. Ask admin to assign a branch.”; otherwise “No branch available. Please contact admin.”
  - Persistent warning bar when non-admin and `accessibleBranches.length === 0`: “Your user is not assigned to any branch. Ask admin to assign a branch so you can save sales.”
  - **Salesman selector:** Only **admin** sees the salesman dropdown. Non-admin see a read-only label: “Salesperson: [name]” (no popover/chip to change).

## How to run the migration

On the machine that runs migrations (e.g. MacBook) with env pointing at your self-hosted DB:

```bash
cd /Users/ndm/Documents/Development/CursorDev/NEWPOSV3
node scripts/run-migrations.js
```

Ensure `branches_and_user_branches_rls.sql` is applied (check script output or run migrations in order).

## How to test

### Salesman login
1. Log in as a salesman who has **one** assigned branch in `user_branches`.
2. Open **New Sale** (SaleForm).
3. **Expected:** Branch is auto-selected; no “Select Branch” dropdown (read-only chip); no “No branch available” / “Please select a branch” errors; **Salesperson** shows as read-only “Salesperson: [name]” (no dropdown).
4. Add items and save. **Expected:** Save succeeds without branch prompt.

### If salesman still sees “No branch available”
1. Open browser console and check **`[BRANCH LOAD] Non-admin`** and **`[SALE FORM BRANCH DEBUG]`** (only in dev).
2. From logs note: `erpUserId`, `userBranchesCount`, `branchesCount`, `accessibleBranchesCount`, `branchesError`.
3. On the DB, run `docs/BRANCH_ASSIGNMENT_VERIFICATION.sql` (replace `<SALESMAN_AUTH_UID>` with the salesman’s auth UID from the log). Ensure the user has at least one row in `user_branches` for their `public.users.id`. If not, admin should insert into `user_branches` for that user and the desired branch.

### Admin login
1. Log in as admin.
2. Open **New Sale**. **Expected:** If company has multiple branches, branch dropdown is visible; salesman dropdown is visible and optional.

## Files changed

| File | Summary |
|------|--------|
| `migrations/branches_and_user_branches_rls.sql` | New: branches SELECT RLS; user_branches SELECT RLS so salesman can see their assignment. |
| `src/app/context/SupabaseContext.tsx` | Dev logs in `loadUserBranch`; log when fallback leaves no branches. |
| `src/app/components/sales/SaleForm.tsx` | Debug log (dev); branchesError state; clearer toast + persistent bar for “no branch”; salesman UI only for admin, read-only “Salesperson” for non-admin. |
| `docs/BRANCH_ASSIGNMENT_VERIFICATION.sql` | SQL to verify user and branch assignment on the DB. |
| `docs/BRANCH_SALESMAN_FIX_SUMMARY.md` | This summary and test steps. |
