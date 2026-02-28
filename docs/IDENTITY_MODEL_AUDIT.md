# Identity Model Audit

**Purpose:** Single source of truth for identity; no FK violations on `user_account_access` / `user_branches`.

---

## 1. Current FK State (Target)

| Table                 | Column   | Constraint                          | References        |
|-----------------------|----------|-------------------------------------|-------------------|
| `user_account_access` | `user_id` | `user_account_access_user_id_fkey`  | **auth.users(id)** ON DELETE CASCADE |
| `user_branches`      | `user_id` | `user_branches_user_id_fkey`        | **auth.users(id)** ON DELETE CASCADE |

**Rule:** Both tables MUST reference `auth.users(id)` only. Any FK pointing to `public.users(id)` must be dropped and recreated to `auth.users(id)`.

**Verification query:** Run `docs/IDENTITY_MODEL_VERIFY_AND_FIX.sql` (STEP 1). Expected: `ccu.table_schema = 'auth'`, `ccu.table_name = 'users'`.

---

## 2. Orphan Rows

**Definition:** Rows in `user_account_access` or `user_branches` where `user_id` does not exist in `auth.users`.

**Why they exist:**  
- FK was previously on `public.users(id)` and rows used `public.users.id`; after switching FK to `auth.users(id)`, backfill may have missed some or auth user was deleted.  
- Or inserts used `public.users.id` before frontend was updated.

**Action:** Delete orphans before or after fixing FK. Migration `identity_model_enforce_fk_clean_orphans.sql` removes them and enforces auth FK.

**Query (STEP 2):** See `docs/IDENTITY_MODEL_VERIFY_AND_FIX.sql`.

---

## 3. Users Without Auth Linkage

**Definition:** Rows in `public.users` with `auth_user_id IS NULL` or `auth_user_id` not in `auth.users`.

**Root cause:** Profile-only users (invited but not yet signed in), or legacy data.

**Action:** Do NOT auto-create auth users. Report only. Link via invite/login or manual process.

**Query (STEP 3):** See `docs/IDENTITY_MODEL_VERIFY_AND_FIX.sql`.

---

## 4. Frontend Identity Flow Summary

| Location            | What is sent                         | Rule |
|---------------------|--------------------------------------|------|
| Load branch/account | `editingUser.auth_user_id` only      | If null, do not call API; show empty. |
| Save branch/account | `identityId = editingUser?.auth_user_id ?? savedAuthUserId` | **Never** `editingUser.id`. |
| New user save       | `savedAuthUserId` from Edge Function / created profile | If null, do not save access; show error toast. |

**Toast when identity missing:**  
`"User is not linked to authentication. Cannot assign branch/account access."`

**Code rule:**  
```ts
const identityId = editingUser?.auth_user_id ?? savedAuthUserId;
// Never use editingUser.id for branch/account save.
```

---

## 5. Final Fixed Architecture

- **auth.users** = identity source of truth.
- **public.users** = profile only (company, role, name, etc.); `auth_user_id` links to `auth.users(id)`.
- **user_branches.user_id** = `auth.users(id)`.
- **user_account_access.user_id** = `auth.users(id)`.
- RPCs `set_user_branches` and `set_user_account_access` accept `p_user_id` as `auth.users(id)` only; no resolution to `public.users.id`, no create-from-auth for access tables.
- Frontend sends only `auth_user_id` (or `savedAuthUserId` for new user) when loading/saving branch and account access.

---

## 6. Prevention Strategy

1. **Migrations:** Apply in order: `identity_model_auth_user_id.sql` → `rpc_user_branches_accounts_auth_id_only.sql` → `fix_user_account_access_fk_to_auth_users.sql` → `identity_model_enforce_fk_clean_orphans.sql`.
2. **Code:** No use of `editingUser.id` or `public.users.id` for `setUserBranches` / `setUserAccountAccess` or for loading their data; only `auth_user_id` / `savedAuthUserId`.
3. **New features:** Any new table that stores “which user” for access control must use `auth.users(id)` (e.g. `user_id UUID REFERENCES auth.users(id)`).
4. **Verification:** Periodically run `docs/IDENTITY_MODEL_VERIFY_AND_FIX.sql` (STEP 1–3) to confirm FK state and orphan/mismatch report.
