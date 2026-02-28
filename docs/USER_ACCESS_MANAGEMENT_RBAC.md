# User Access Management (RBAC) — Implementation Summary

## What was built

### 1. Database

- **`user_account_access`** (new table)
  - `user_id` → `public.users(id)`
  - `account_id` → `accounts(id)`
  - `UNIQUE(user_id, account_id)`
  - Used so non-admin users only see/use accounts you assign here.

- **`user_branches`** (existing)
  - Used for branch access; no schema change.

### 2. RLS

- **`user_account_access`**
  - SELECT: user sees own rows (`user_id = auth.uid()` or `user_id` = their `users.id` when `auth_user_id = auth.uid()`).
  - INSERT/UPDATE/DELETE: only `admin`.

- **`accounts`**
  - SELECT: `company_id = get_user_company_id()` and:
    - **admin / manager / accountant:** all company accounts.
    - **others:** only accounts in `user_account_access` for that user.

So after migration, **salesman/operator/etc. see only accounts you assign** in Edit User → Account Access. Assign at least Cash/Bank (and Mobile Wallet if used) for users who receive payments.

### 3. Admin UI (Settings → Users → Edit User / Add User)

- **Tabs:** General | Branch Access | Account Access | Permissions.

- **General:** Name, email, phone, role, active, login setup (new user).

- **Branch Access:** Checkbox list of company branches. Save updates `user_branches` (replace existing).

- **Account Access:** Checkbox list of company accounts. Save updates `user_account_access` (replace existing).

- **Permissions:** Can be assigned as salesman + all module permissions (Sales, Accounting, etc.).

On **Save**:
- User record is created/updated.
- Then `user_branches` and `user_account_access` are updated for that user (admin only).

### 4. SaleForm / payments

- Branch selection already uses `accessibleBranchIds` from context (from `user_branches`).
- Accounts for payments come from `accountService.getAllAccounts()`, which is **filtered by RLS**. So only assigned accounts are visible to non-admin; no extra frontend filtering needed.

### 5. Security

- All enforcement is in RLS (no frontend-only checks).
- Admin can manage `user_branches` and `user_account_access`; others cannot.

---

## Files changed / added

| File | Change |
|------|--------|
| `migrations/user_account_access_and_rbac_rls.sql` | **New.** Table `user_account_access`, RLS for it and for `accounts`. |
| `src/app/services/userService.ts` | `getUserBranches`, `setUserBranches`, `getUserAccountAccess`, `setUserAccountAccess`. |
| `src/app/components/users/AddUserModal.tsx` | Tabs General / Branch Access / Account Access / Permissions; load and save branch & account access. |
| `docs/USER_ACCESS_MANAGEMENT_RBAC.md` | This summary. |

---

## How to run

1. **Run migration** (e.g. MacBook with DB env):
   ```bash
   cd /Users/ndm/Documents/Development/CursorDev/NEWPOSV3
   node scripts/run-migrations.js
   ```

2. **Assign access for existing users**
   - Settings → Users → Edit User.
   - Open **Branch Access** and **Account Access** and select branches/accounts per user.
   - Save.

3. **New users**
   - Add User → fill General → set Branch Access and Account Access → set Permissions → Save.
   - Branch/account access is saved after the user is created.

---

## Backward compatibility

- **Branches:** Unchanged; still `user_branches` + existing branches RLS.
- **Accounts:** Before this migration, roles like salesman/operator could see accounts with codes 1000/1010/1020 via old RLS. After migration they only see accounts in `user_account_access`. So you **must** assign at least Cash (1000), Bank (1010), and optionally Mobile Wallet (1020) in **Account Access** for any user who should receive or use payments.

---

## Quick test

1. Log in as **admin**.
2. Settings → Users → Edit a salesman.
3. **Branch Access:** Select one branch; Save.
4. **Account Access:** Select Cash and Bank; Save.
5. Log in as that **salesman** → New Sale: one branch auto-selected, no branch error; payment uses only assigned accounts (RLS).
