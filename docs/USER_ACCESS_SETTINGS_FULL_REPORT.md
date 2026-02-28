# User Access Settings — Full Report

## 1. Problem Statement

When an admin assigns **branch access** or **account access** to a user in **Settings → Users → Edit User**, the save often fails with:

```text
insert or update on table "user_branches" violates foreign key constraint "user_branches_user_id_fkey"
```

The UI shows: *"User saved. Branch access failed: ..."* and the HTTP response is **409**.

---

## 2. Symptoms

- **FK violation** on `user_branches` (and potentially `user_account_access`) when saving from the Edit User modal.
- **409** from the API when assigning branches/accounts.
- Root cause is **wrong `user_id`** being written: the value does not exist in `public.users.id` (the FK target).

---

## 3. Root Cause (Exact)

1. **FK target**  
   `user_branches.user_id` has FK **`user_branches_user_id_fkey`** → **`public.users(id)`**.  
   Only **`public.users.id`** is valid. **`auth.users.id`** (auth uid) is **not** valid here.

2. **ID confusion**  
   - **auth.users** = Supabase Auth (login identity).  
   - **public.users** = ERP profile (company, role, branches, accounts).  
   - A row in `public.users` has:
     - `id` = primary key (UUID), **this** is what `user_branches.user_id` must reference.
     - `auth_user_id` = link to `auth.users.id` (nullable until user has login).

   If the app (or a fallback path) sends **auth_user_id** or any UUID that is not **public.users.id**, the insert into `user_branches` violates the FK.

3. **Previous “fix” that still failed**  
   - Frontend sometimes resolved id via list/query; when RPC was missing or resolution failed, code **fell back to direct DML** with whatever id it had (e.g. auth uid).  
   - That direct insert used a wrong id → FK error.  
   - So: **any direct insert/update/delete on `user_branches` / `user_account_access` from the frontend is unsafe** and has been removed.

---

## 4. Database Schema (Tables + FK)

### 4.1 Constraint

```sql
-- Run to confirm:
SELECT conname, conrelid::regclass AS table_name, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conname = 'user_branches_user_id_fkey';
```

- **Constraint:** `user_branches_user_id_fkey`  
- **Table:** `public.user_branches`  
- **Definition:** `user_id` REFERENCES `public.users(id)` (or equivalent)

### 4.2 Tables

- **public.users**  
  - `id` (PK, UUID) = **the** id used by `user_branches.user_id` and `user_account_access.user_id`.  
  - `auth_user_id` (UUID, nullable) = link to `auth.users.id`.  
  - `company_id`, `email`, `full_name`, `role`, `is_active`, etc.

- **public.user_branches**  
  - `user_id` → **public.users(id)** (FK).  
  - `branch_id`, `is_default`, etc.

- **public.user_account_access**  
  - `user_id` → **public.users(id)** (FK).  
  - `account_id`, etc.

---

## 5. Correct ID Model (auth.users vs public.users)

| Concept              | Table         | Column / Meaning                          |
|----------------------|---------------|-------------------------------------------|
| Login identity       | auth.users    | `id` (auth uid)                           |
| ERP profile          | public.users  | `id` (PK); `auth_user_id` → auth.users.id |
| Branch/account FK    | user_branches / user_account_access | Must store **public.users.id** only |

- **Never** write `auth.users.id` into `user_branches.user_id` or `user_account_access.user_id`.  
- **Always** resolve to **public.users.id** (and optionally create a minimal `public.users` row from auth if allowed).

---

## 6. RPC Contract (Inputs/Outputs)

All branch/account **writes** go through these RPCs only. DB is the single source of truth for resolving **public.users.id**.

### 6.1 get_public_user_id

- **Purpose:** Resolve to **public.users.id** for a given id or auth uid, scoped by company.
- **Signature:** `get_public_user_id(p_user_id uuid, p_company_id uuid DEFAULT NULL) RETURNS uuid`
- **Behaviour:**
  - If `p_user_id` = some `public.users.id` and (if `p_company_id` given) that user’s `company_id` = `p_company_id` → return that `id`.
  - Else if `p_user_id` = some `public.users.auth_user_id` (and company matches if `p_company_id` given) → return that row’s `id`.
  - Else → return NULL.
- **Used by:** Backend (inside `set_user_branches` / `set_user_account_access`); frontend may use for read paths only.

### 6.2 set_user_branches

- **Purpose:** Set branch access for one user (replace existing). Admin-only. FK-safe.
- **Signature:** `set_user_branches(p_user_id uuid, p_branch_ids uuid[], p_default_branch_id uuid DEFAULT NULL, p_company_id uuid DEFAULT NULL) RETURNS void`
- **Behaviour:**
  1. Check caller is admin (e.g. via `get_user_role()`).
  2. `v_user_id := get_public_user_id(p_user_id, p_company_id)`.
  3. If `v_user_id` is NULL and `p_company_id` is set, optionally create a minimal `public.users` row from `auth.users` (by `p_user_id` = auth uid), then set `v_user_id` to the new `id`.
  4. If `v_user_id` still NULL → `RAISE EXCEPTION 'USER_NOT_FOUND: ...'`.
  5. `DELETE FROM user_branches WHERE user_id = v_user_id`.
  6. Insert new rows into `user_branches` with `user_id = v_user_id` and given branch ids/default.
- **Important:** All writes use **public.users.id** (`v_user_id`). No auth uid is ever written into `user_branches.user_id`.

### 6.3 set_user_account_access

- **Purpose:** Set account access for one user (replace existing). Admin-only. FK-safe.
- **Signature:** `set_user_account_access(p_user_id uuid, p_account_ids uuid[], p_company_id uuid DEFAULT NULL) RETURNS void`
- **Behaviour:** Same resolution and optional create-from-auth as branches; then replace rows in `user_account_access` using **public.users.id** only.

---

## 7. Frontend Flow (Settings UI → RPC)

1. **Settings → Users → Edit User** (or Add User).
2. User fills General / Branch Access / Account Access / Permissions.
3. On **Save**:
   - General: create/update user (existing API / Edge Function).
   - **Branch access:** `userService.setUserBranches(userId, branchIds, defaultBranchId, companyId)`.
   - **Account access:** `userService.setUserAccountAccess(userId, accountIds, companyId)`.
4. **userId** passed to these calls is:
   - **Edit:** `editingUser.id` (from list = **public.users.id**).
   - **Create:** `savedUserId` (from create response or refetch = **public.users.id**).
5. **No direct DML:**  
   There is **no** `.from('user_branches').insert/upsert/delete` or `.from('user_account_access').insert/upsert/delete` in the frontend for these flows. Only RPCs are used.
6. **If RPCs are missing:**  
   If the server returns “function does not exist” (e.g. 42883), the app throws a **blocking** error:  
   *"Server is missing required RPCs. Apply migration: migrations/rpc_assign_user_branches_fk_fix.sql"*  
   and does **not** fall back to direct insert/update/delete.

**Feature flag:** `REQUIRE_RPCS_FOR_ACCESS_SETTINGS` (default `true`) in `userService`: when true, missing RPCs cause the above error instead of any fallback.

---

## 8. Security Model (Admin-Only + RLS)

- **RPCs:** `set_user_branches` and `set_user_account_access` are **SECURITY DEFINER** and enforce **admin only** (e.g. `get_user_role()` = admin). Non-admin callers get `ACCESS_DENIED`.
- **Scoping:** Resolution uses `get_public_user_id(..., p_company_id)` so resolution is scoped by company when `p_company_id` is provided.
- **RLS:** RPCs run with definer rights and `search_path = public, auth`, so internal DELETEs/INSERTs are not blocked by RLS. Normal SELECT on `user_branches` / `user_account_access` / `users` remains subject to RLS for non-admin users.

---

## 9. How to Deploy (Run Migration + Verify)

1. **Apply migration** on the Supabase project the app uses (e.g. self-hosted at supabase.dincouture.pk):
   - Open **SQL Editor**.
   - Run the full contents of **`migrations/rpc_assign_user_branches_fk_fix.sql`**.
2. **Verify RPCs exist:**  
   Run **`docs/USER_ACCESS_SETTINGS_VERIFY.sql`** (sections 1–2 at minimum): FK definition and `get_public_user_id`, `set_user_branches`, `set_user_account_access` must exist.
3. **Test in UI:**  
   As admin, open **Settings → Users → Edit User**, set branch access (and account access if used), Save.  
   - Success = no FK error, no 409 from branch/account save.  
   - If you see “Server is missing required RPCs…”, the migration was not applied to the DB the app is using (wrong project/env).

---

## 10. Troubleshooting Checklist (If Error Returns)

- [ ] **Confirm FK:**  
  `user_branches_user_id_fkey` references **public.users(id)** (run Step 1 in `USER_ACCESS_SETTINGS_VERIFY.sql`).
- [ ] **Confirm RPCs:**  
  All three functions exist in `public` (Step 2 in verify script). If any are missing → run **`migrations/rpc_assign_user_branches_fk_fix.sql`** on the **same** Supabase project the app uses.
- [ ] **Confirm environment:**  
  App’s Supabase URL/keys point to the project where the migration was applied (no mix of local vs hosted, or different projects).
- [ ] **No direct DML:**  
  Search codebase for `.from('user_branches').insert` / `.from('user_account_access').insert` (and delete/upsert) in the Settings/Edit User flow. There should be **none** for writes; only RPCs.
- [ ] **User exists in public.users:**  
  For the failing user, run:  
  `SELECT id, auth_user_id, email FROM public.users WHERE email = '<email>';`  
  If no row → create profile (or use RPC with `p_company_id` so it can create from auth if implemented).
- [ ] **Admin role:**  
  Caller must be admin; otherwise RPC raises ACCESS_DENIED (different from FK).

---

## Summary of Fixes Applied

| Item | Change |
|------|--------|
| **Migration** | Single migration `rpc_assign_user_branches_fk_fix.sql`: `get_public_user_id`, `set_user_branches`, `set_user_account_access` with resolution and optional create-from-auth; clear RAISE messages; company-scoped resolution. |
| **Frontend** | All branch/account **writes** go through RPC only. No direct insert/update/delete on `user_branches` or `user_account_access`. |
| **Missing RPCs** | If RPCs are missing, throw blocking error with migration hint; no silent fallback to direct DML. |
| **Feature flag** | `REQUIRE_RPCS_FOR_ACCESS_SETTINGS = true` so production always requires RPCs. |
| **Docs** | This report + `USER_ACCESS_SETTINGS_VERIFY.sql` for DB checks and manual RPC tests. |

After applying the migration and deploying the frontend, admin branch/account assignment from the UI must use only these RPCs and must not produce FK errors when the user exists (or can be created) in `public.users`.
