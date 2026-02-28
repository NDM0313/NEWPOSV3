# Identity Model Audit

**Purpose:** Single source of truth for identity; no FK violations when saving Branch access / Account access in Admin UI.

**Identity / FK Orphan Fix Runner:** Use **`docs/IDENTITY_MODEL_VERIFY_AND_FIX.sql`** for STEP 0–8. Goal: auth.users = identity; public.users = profile only; user_branches/user_account_access.user_id → auth.users(id) only; delete orphan rows before re-adding constraints; block assigning branch/account to users with auth_user_id NULL (unlinked).

---

## 1. What the FK was before vs after

| State | user_branches.user_id_fkey | user_account_access.user_id_fkey |
|-------|----------------------------|----------------------------------|
| **Before (wrong)** | `REFERENCES public.users(id)` | `REFERENCES public.users(id)` |
| **After (fixed)** | `REFERENCES auth.users(id) ON DELETE CASCADE` | `REFERENCES auth.users(id) ON DELETE CASCADE` |

**Root cause of error:**  
UI or RPC was sending `public.users.id` (or an unlinked profile’s id). The table had FK to `public.users(id)`. After we switched to identity model, the **frontend** was updated to send only `auth_user_id`, but the **database** FK was still (or had been recreated as) `public.users(id)` in some environments. So: `Key (user_id)=(<uuid>) is not present in table "users"` means the constraint was checking `public.users` and the UUID was an `auth.users.id`, or the UUID was `public.users.id` and the constraint was later changed to `auth.users` — in both cases, mismatch.

**Fix applied:**  
- Clean orphan rows (user_id not in auth.users).  
- Drop both FKs.  
- Add both FKs to **auth.users(id)** only.

---

## 2. Orphan rows: what they are and what we did

**Definition:** Rows in `user_branches` or `user_account_access` where `user_id` does **not** exist in `auth.users`.

**Why they exist:**  
- Tables originally had FK to `public.users(id)` and rows stored `public.users.id`.  
- After switching FK to `auth.users(id)`, any row still holding `public.users.id` is an orphan (auth.users has no row with that id).  
- Or the auth user was deleted and the access row was left behind.

**What we did:**  
- Before adding the new constraint, we **delete** all such rows (in a single transaction with the FK change).  
- Migration: `identity_model_enforce_fk_clean_orphans.sql` (DELETE orphans then DROP old FK then ADD FK to auth.users).  
- Verification script: `docs/IDENTITY_MODEL_VERIFY_AND_FIX.sql` STEP 3 (audit) and STEP 4 (delete + recreate FK).

**Record after running STEP 3 (optional):**  
- “user_branches orphans: N rows”  
- “user_account_access orphans: M rows”  
(Then STEP 4 deletes them and recreates the FKs.)

---

## 3. Final FK definitions (target state)

Run in SQL Editor to confirm:

```sql
SELECT conname, pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conname IN ('user_branches_user_id_fkey', 'user_account_access_user_id_fkey');
```

**Expected:**  
Both rows must show `REFERENCES auth.users(id) ...` (with ON DELETE CASCADE).  
If either shows `REFERENCES public.users(id)`, run STEP 4 in `docs/IDENTITY_MODEL_VERIFY_AND_FIX.sql` (or run migration `identity_model_enforce_fk_clean_orphans.sql`).

---

## 4. Rule: access tables always use auth.users.id

- **user_branches.user_id** → must be **auth.users(id)** only.  
- **user_account_access.user_id** → must be **auth.users(id)** only.  
- **public.users.id** must **never** be used for these tables.  
- Frontend must send only **auth_user_id** (i.e. auth.users.id) when loading/saving branch or account access.  
- If the user has no auth (profile-only, `auth_user_id IS NULL`), do **not** save branch/account access; show toast: *"User is not linked to authentication. Cannot assign branch/account access."*

---

## 5. How to verify (STEP 0–8)

Use **`docs/IDENTITY_MODEL_VERIFY_AND_FIX.sql`** in Supabase SQL Editor:

| Step | What to do |
|------|------------|
| **STEP 0** | Reproduce error; copy the UUID from "Key (user_id)=(<uuid>)" and note: user_branches or user_account_access? |
| **STEP 1** | Run the single SELECT on both constraints; prove what each FK points to (public.users vs auth.users). |
| **STEP 2** | Replace `<BAD_UUID>`; run the three SELECTs (auth.users, public.users by id, public.users by auth_user_id). Interpret: profile-only? mismatch? unlinked? |
| **STEP 3** | Run both COUNT(*) orphan queries. If counts > 0, FK add to auth.users will fail until STEP 4. |
| **STEP 4** | Run the full transaction: delete orphans → drop FKs → add FKs to auth.users; COMMIT. |
| **STEP 5** | Re-run STEP 1 query; both must show `REFERENCES auth.users(id)`. |
| **STEP 6** | Fix real user linkage: create/invite user in Auth, then `UPDATE public.users SET auth_user_id = a.id FROM auth.users a WHERE p.email = a.email AND p.auth_user_id IS NULL`. |
| **STEP 7** | Frontend: only send auth_user_id; if NULL block save and show toast; log identityId and editingUser.id (never send). |
| **STEP 8** | Final test: pick a user in auth.users, assign Branch + Account in UI, save; create a Sale; no FK error. |

After STEP 4, test in UI: save Branch/Account access for a **linked** user (auth_user_id set). It should succeed.

---

## 6. Unlinked users (auth_user_id NULL) and “usman@yahoo.com” type cases

- **Reality:** A row in `public.users` with `auth_user_id IS NULL` is a profile-only user (no login / not linked to auth).  
- **Rule:** Do **not** create a fake auth user. Do **not** use `public.users.id` for branch/account access.  
- **UI:** If the selected user has no `auth_user_id`, do **not** call the RPC; show: *"User is not linked to authentication. Cannot assign branch/account access."*  
- **Data:** Create/invite the user in Supabase Auth (Dashboard → Authentication → Users). Then link profile:  
  `UPDATE public.users p SET auth_user_id = a.id FROM auth.users a WHERE p.email = a.email AND p.auth_user_id IS NULL;`  
  Then assign Branch/Account access in UI (using auth uid).

### Quick reality check (usman@yahoo.com type)

- **public.users** has a row (e.g. usman@yahoo.com) with **auth_user_id NULL** → profile exists, **no** auth identity.  
- **auth.users** has **no** row for that email → auth user does not exist.  
- Such a user **cannot** be assigned branch/account access until an auth user is created and the profile is linked.  
- If you try to add FK to auth.users and get **"key not present in table users"**, that is usually **orphan rows** (STEP 3): existing rows in user_branches/user_account_access with user_id not in auth.users. STEP 4 (delete orphans then add constraint) fixes it.

---

## 7. What we changed (summary)

1. **DB:**  
   - Orphan rows in `user_branches` and `user_account_access` deleted (user_id not in auth.users).  
   - Both FKs recreated to **auth.users(id)** ON DELETE CASCADE (no FK to public.users on these columns).

2. **Migration:**  
   - `identity_model_enforce_fk_clean_orphans.sql`: single transaction that deletes orphans, drops old FKs, adds FKs to auth.users.

3. **Verification script:**  
   - `docs/IDENTITY_MODEL_VERIFY_AND_FIX.sql`: STEP 1 (prove FK), STEP 2 (inspect bad UUID), STEP 3 (orphan audit), STEP 4 (fix in one transaction), STEP 5 (re-verify), STEP 6 (manual insert test).

4. **Frontend (STEP 7 hard rule):**  
   - Branch/account load and save use only `editingUser.auth_user_id` or `savedAuthUserId`; never `editingUser.id`.  
   - When identity is missing and user had selections, block save and show: *"User is not linked to authentication. Cannot assign branch/account access."*  
   - Console log before save: `identityId (must be auth.users.id)` and `editingUser.id (never send)` for debugging.

5. **Link-by-email (STEP 6):** After creating/inviting a user in Supabase Auth, link profile with the UPDATE in the verify script; then assign Branch/Account access in UI.

6. **RPCs:**  
   - `set_user_branches` and `set_user_account_access` take `p_user_id` as **auth.users(id)** only; no resolution to public.users.id.

**End result:** No FK violations when saving branch/account access for users who have an auth identity; UI blocks assigning access for profile-only (unlinked) users.

---

## 8. Verification run (scripted)

Run on DB (same connection as migrations):

```bash
node scripts/identity-model-verify-and-fix.js
```

- **PHASE 1:** Prints current FK definitions (must show `REFERENCES auth.users(id) ON DELETE CASCADE` for both).
- **PHASE 2:** Lists public.users with auth_user_id NULL and whether that id/email exists in auth.users.
- **PHASE 3:** Orphan counts (must be 0 for FK add to succeed).
- **PHASE 4:** If any FK pointed to public or orphans > 0, runs transaction (delete orphans, drop FKs, add FKs to auth.users).
- **PHASE 5:** Re-prints FK definitions.
- **PHASE 6:** Links public.users to auth.users by email where auth user exists.

Then prove INSERT with auth id:

```bash
node scripts/identity-model-insert-test.js
```

Must print: `INSERT user_branches: OK (no FK error)` and `INSERT user_account_access: OK (no FK error)`.

**PHASE 8 (manual UI test):** Log in as admin → Settings → User Management → Edit a **linked** user (e.g. ndm313@yahoo.com) → assign Branch access and Account access → Save. No FK error. Then create a Sale; branch should load. For **unlinked** users (admin@seed.com, salesman@seed.com), save must show toast and not call RPC.
