# User Management + Access Fix

## Root cause summary

- **Auth user not created:** Admin created users from the frontend, but only the ERP profile (`public.users`) was created; the Supabase Auth user was not, so `auth_user_id` stayed NULL.
- **Access assignment failed:** Branch/account access tables (`user_branches`, `user_account_access`) reference `auth.users(id)` only. Assigning access for profile-only users (no auth identity) caused FK errors or UI blocks.
- **Admin had to run SQL:** Linking profiles to auth and assigning access required manual SQL or multiple steps.

**Requirement:** Admin adds a user once and assigns branch/account in the same modal (1-click). No manual SQL for normal onboarding.

---

## What changed

### DB / RPC (unchanged; verified)

- **FKs:** `user_branches_user_id_fkey` and `user_account_access_user_id_fkey` reference **auth.users(id)** ON DELETE CASCADE. No `public.users.id` in access tables.
- **RPCs:** `set_user_branches(p_user_id, ...)` and `set_user_account_access(p_user_id, ...)` expect **auth.users(id)**. Used when editing existing (non-admin) linked users.
- **RLS:** Admin sees all company branches and all company accounts; no branch/account restriction for admin.

### Backend (Edge Function)

- **create-erp-user** (Supabase Edge Function):
  - **B1)** Create auth user: `inviteUserByEmail` or `createUser` with temp password.
  - **B2)** Insert profile in `public.users` with `auth_user_id` set.
  - **B3)** If `branch_ids` provided: validate branches belong to `company_id`, delete existing `user_branches` for that auth id, insert rows with `user_id = auth_user_id` (service role bypasses RLS).
  - **B4)** If `account_ids` provided: validate accounts belong to `company_id`, delete existing `user_account_access` for that auth id, insert rows with `user_id = auth_user_id`.
  - **B5)** Response: `{ success, user_id, auth_user_id, created, assignedBranchesCount, assignedAccountsCount }`.
  - No rollback of auth user if profile insert fails (log and return error); profile + access are in one flow so profile insert failure means no access rows.

### Frontend

- **AddUserModal (new user):**
  - Calls `createUserWithAuth` with `branch_ids`, `account_ids`, `default_branch_id` (selected in modal).
  - Does **not** call `setUserBranches` / `setUserAccountAccess` after create; assignment is done in the Edge Function.
  - Toast shows “User created…” and “Access assigned: N branch(es), M account(s)” when applicable.
- **AddUserModal (existing user):**
  - If **admin:** does not save branch/account (admin has full access). UI note: “Admin has full access.”
  - If **linked** (auth_user_id set) and not admin: calls `setUserBranches` and `setUserAccountAccess` with `auth_user_id` only.
  - If **unlinked** (auth_user_id NULL): does not save access; toast: “User is not linked to authentication. Use Invite first.”
- **userService.createUserWithAuth:** Accepts `branch_ids`, `account_ids`, `default_branch_id` and passes them to the Edge Function.

### Admin full access

- **RLS:** Branches SELECT and accounts SELECT already allow `get_user_role() = 'admin'` to see all (within company). No change.
- **UI:** When editing an admin, branch/account assignment is not saved; message explains admin has full access.

---

## Files changed

| File | Change |
|------|--------|
| `supabase/functions/create-erp-user/index.ts` | Request body: add `branch_ids`, `account_ids`, `default_branch_id`. After profile insert: validate and insert `user_branches` and `user_account_access` with auth_user_id (service role). Return assigned counts. |
| `src/app/services/userService.ts` | `createUserWithAuth`: add params `branch_ids`, `account_ids`, `default_branch_id`; return type includes `assignedBranchesCount`, `assignedAccountsCount`. |
| `src/app/components/users/AddUserModal.tsx` | New user: pass branch/account ids to `createUserWithAuth`; no separate RPC for access. Existing: save branch/account only when linked and not admin; admin note on Branches/Accounts tabs. |
| `docs/USER_MANAGEMENT_ACCESS_FIX.md` | This document. |

---

## PHASE A — SQL verification (captured)

**A1) FK definitions**

```
user_account_access_user_id_fkey -> FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
user_branches_user_id_fkey -> FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
```

**A2) Profile-only users (auth_user_id NULL)**

Example output (from script run):

- admin@seed.com, public.id=…, in auth by id? false, in auth by email? false  
- salesman@seed.com, public.id=…, in auth by id? false, in auth by email? false  

These cannot be assigned branch/account until an auth user exists and the profile is linked.

**A3) Orphan counts**

- orphans_user_branches: 0  
- orphans_user_account_access: 0  

---

## How to use (admin workflow)

1. **Add new user (1-click)**  
   Settings → User Management → Add User.  
   Fill email, name, role, password option (temp or invite).  
   Open **Branches** and **Accounts** tabs and select access.  
   Save.  
   - Auth user is created (or invite sent).  
   - Profile is created with `auth_user_id` set.  
   - Branch and account access are created with **auth_user_id** only.  
   - No manual SQL.

2. **Edit existing user**  
   Edit user → change role/details.  
   - If **admin:** branch/account are not saved (admin has full access).  
   - If **non-admin** and **linked:** change Branches/Accounts and Save; RPCs run with auth_user_id.  
   - If **unlinked:** Save shows “User is not linked to authentication. Use Invite first.” Create/invite auth user, then link profile (e.g. by email), then assign access.

3. **Profile-only users (Invite/Link)**  
   If a profile exists with `auth_user_id` NULL:  
   - Create or invite that email in Supabase Auth (Dashboard → Authentication → Users).  
   - Link profile: `UPDATE public.users p SET auth_user_id = a.id FROM auth.users a WHERE p.email = a.email AND p.auth_user_id IS NULL;`  
   - Then in the UI, edit that user and assign branch/account and save.

---

## Test plan (PHASE F)

- **F1) New user from UI**  
  Add user with branches and accounts selected → Save.  
  - `auth.users` contains the email.  
  - `public.users` has that user with `auth_user_id` set.  
  - `user_branches` and `user_account_access` have rows with `user_id = auth_user_id`.  
  - No FK errors.

- **F2) Sale with that user**  
  Log in as the new user → Create Sale.  
  - Branch loads from assigned branches.  
  - Save works (no “not assigned to any branch”).

- **F3) Admin**  
  - Admin can create/edit sales without branch restriction (or with default branch).  
  - Admin sees all branches/accounts.  
  - Editing an admin user does not save branch/account; UI shows admin full access note.

---

## Created By Identity Standard

**Rule:** `created_by` on sales, purchases, payments, rentals, stock_movements, journal_entries must store **auth.users(id)** (identity), not **public.users.id** (profile).

- **Why auth.uid():** The creating user is the logged-in identity. Storing `auth.uid()` keeps a single standard and avoids mixing profile id with identity id.
- **Why join on auth_user_id:** To show creator name, resolve `created_by` via `public.users.auth_user_id = &lt;table&gt;.created_by`. **Never** join `public.users.id = created_by` when `created_by` is meant to be identity — that causes "Created By" to show "-" or blank because the UUIDs differ.
- **Frontend:** Sales and purchases lists enrich creator names by looking up `users` where `auth_user_id IN (created_by values)` (with fallback to `id` for legacy rows). New inserts set `created_by = user.id` (Supabase session user id = auth.uid()).
- **Backfill:** Run `migrations/backfill_created_by_auth_user_id.sql` once to set `created_by = users.auth_user_id` where it was previously `users.id` on sales, purchases, rentals, stock_movements, journal_entries, payments.

---

## Global Identity & Document Standard

**Rule:** One system-wide standard for who did what and how documents are numbered.

### Identity (who did it)

- **created_by:** Always store **auth.uid()** (never `public.users.id`) on sales, purchases, payments, rentals, stock_movements, journal_entries. Resolve to display name via `public.users.auth_user_id = created_by`.
- **received_by (payments):** Store **auth.uid()** for the user who received/recorded the payment. Column: `payments.received_by` REFERENCES `auth.users(id)`. Show "Received By: &lt;full_name&gt;" in Payment History; resolve via `users.auth_user_id = payments.received_by`.
- **performed_by (activity_logs):** Store **auth.uid()**. FK: `activity_logs.performed_by` REFERENCES `auth.users(id)`. Timeline shows e.g. "Payment of Rs 1000 recorded by Nadeem" using `performed_by_name` or lookup by `auth_user_id`.

### Document numbers (DB only)

- **No frontend serial logic.** Invoice numbers (SL-0001) and payment numbers (PAY-0001) must **not** be generated in the frontend. They are generated in the database only.
- **Table:** `document_sequences_global(company_id, document_type, current_number)` with types SL, PUR, PAY, RNT (and optionally STD).
- **Function:** `get_next_document_number_global(p_company_id, p_type)` returns the next value (e.g. `SL-0001`, `PAY-0001`) atomically. Call from the app **before** insert; do not generate or guess numbers in the UI.
- **Numbering is per company only.** No numbering per user or per role (e.g. no "if salesman then reset numbering"). Sequential and unique per company even when two users save at the same time.

### Migrations

- `migrations/global_identity_and_received_by.sql`: adds `payments.received_by`, activity_logs FK to auth.users, backfill, and `log_activity` RPC fix for performed_by name resolution.
- `migrations/global_document_sequences_company.sql`: creates `document_sequences_global` and `get_next_document_number_global()`.

---

## Contact Isolation & Global Customer Standard

**Rule:** Customer codes are per-company global; walk-in is one system record per company; users see only their customers (admin sees all).

### Customer code (DB only)

- **No frontend generation.** Codes like CUS-0001, CUS-0002 must **not** be generated in the UI. They come from `get_next_document_number_global(company_id, 'CUS')` before inserting a contact (type = customer/both).
- **Unique:** `contacts(company_id, code)` is unique. One walk-in per company has reserved code **CUS-0000**.
- **Sequence:** `document_sequences_global` with `document_type = 'CUS'`; app calls the RPC and sets `code` on insert. Admin and user both get the next number (e.g. Admin → CUS-001, User → CUS-002).

### Walk-in customer (system-level)

- **Exactly one per company.** Single record: `type = customer`, `is_default = true`, `is_system_generated = true`, `system_type = 'walking_customer'`, **code = 'CUS-0000'**.
- **Sales:** When no customer is selected, sale must use this walk-in `customer_id` (never null or temporary).
- **Ledger:** Customer ledger list and queries **must include** walk-in (do not filter out `is_system_generated`). Ledger is always linked via `customer_id`.
- **Backfill:** `UPDATE sales SET customer_id = (walk-in id) WHERE customer_id IS NULL` per company.

### RLS (contacts)

- **SELECT:** `get_user_role() = 'admin'` → all company contacts; else `created_by = auth.uid()` OR `is_system_generated = true` (so user sees own + walk-in).
- **INSERT:** Same company (code assigned by app/DB).
- **UPDATE:** Admin all; non-admin own or system (for read-only system fields).
- **DELETE:** Admin or own only; never default/walk-in.

### Migration

- `migrations/contacts_global_customer_code_and_walkin.sql`: adds `contacts.code`, CUS in `get_next_document_number_global`, walk-in backfill and CUS-0000, RLS policies, backfill sales with null `customer_id`, backfill existing customer codes.

---

## Walk-in Customer Integrity Enforcement

**Rule:** Exactly one walk-in customer per company; all sales and ledger use that single ID. No duplicate system walk-ins.

### Why it matters

- Multiple walk-ins (e.g. branch-level vs company-level vs user-level) create different contact IDs.
- Sales may link to one walk-in ID while the ledger or admin view uses another → sales appear in list but not in walk-in ledger.
- Fix: one **primary** walk-in per company; reassign all references to it; then remove duplicates; enforce at DB level.

### Behaviour after fix

| Feature | Result |
|--------|--------|
| Walk-in count | 1 per company |
| Code | CUS-0000 |
| Ledger | All walk-in sales visible (same `customer_id`) |
| Admin / User | Same walk-in record |
| Future creation | Impossible to duplicate (unique index) |

### Consolidation migration

- **`migrations/walkin_consolidation_single_per_company.sql`**:
  1. **Analyse:** Find companies with more than one walk-in (`is_system_generated` / `system_type = 'walking_customer'` / `is_default`).
  2. **Primary:** For each company, primary = oldest walk-in by `created_at`.
  3. **Reassign (then delete):** For each duplicate walk-in: update `sales`, `sale_returns`, `rentals`, `studio_orders`, `credit_notes`, `payments.contact_id`, and `ledger_master` (if present) from duplicate ID to primary; then delete duplicate contacts.
  4. **Enforce:** Partial unique index `unique_walkin_per_company` on `contacts(company_id)` WHERE `is_system_generated = true` and type customer/both.
  5. **Normalise:** Set `code = 'CUS-0000'`, `is_default = true`, `is_system_generated = true`, `system_type = 'walking_customer'` for the single walk-in per company.
  6. **Backfill:** Sales with null `customer_id` → walk-in for same company.

Run this migration once after `contacts_global_customer_code_and_walkin.sql` to fix existing duplicate walk-in data. After that, ledger and sales always use the same walk-in ID.

---

## Strict Walk-in Enforcement Mode

**Rule:** One and only one walk-in per company. No branch-level or user-level walk-in. No duplicate possible. Sales and ledger always use the same walk-in ID.

### Database (hard enforcement)

- **Unique index:** `unique_walkin_per_company_strict` on `contacts(company_id)` WHERE `system_type = 'walking_customer'`. Prevents a second walk-in per company (DB error on insert).
- **CHECK constraint:** `walkin_code_must_be_reserved`: if `system_type = 'walking_customer'` then `code` must be `'CUS-0000'`; otherwise no restriction. Ensures walk-in always has reserved code.
- **Migration:** `migrations/walkin_strict_enforcement.sql` (run after consolidation).

### Application

- **Lookup:** Walk-in is selected by **company_id only**. No `branch_id`, no `created_by`.  
  `contactService.getWalkingCustomer(companyId)` and `getDefaultCustomer(companyId)` use `WHERE company_id = ? AND system_type = 'walking_customer'` (with legacy fallback on `is_default`).
- **Sale save:** When user selects "Walk-in Customer", the app resolves the company walk-in ID and saves `customer_id = <walk-in id>`. Never save `customer_id = null` for walk-in.
- **Ledger:** Customer list and ledger queries use **company_id** and **customer_id** only. No `is_system_generated` or `created_by` filter so walk-in is always included and all walk-in sales are visible.

### Expected behaviour

| Condition | Result |
|----------|--------|
| Admin sale | Same walk-in ID |
| User sale | Same walk-in ID |
| Ledger | All walk-in sales visible |
| Duplicate create attempt | DB error (unique index) |
| Walk-in code | Always CUS-0000 |

---

## Global ERP Permission Architecture Enforcement

**Rule:** Owner and Admin have full company visibility. User (all other roles) is restricted by branch only. No `created_by`-based filtering in financial or ledger views. Ledger is customer-based.

### Role definitions

| Role   | Access |
|--------|--------|
| owner  | Full company (all branches, all records) |
| admin  | Full company (all branches, all records) |
| user   | Branch-scoped: only branches in `user_branches` for `auth.uid()` |

### RLS standard

- **Admin/Owner:** `company_id = get_user_company_id()` only. No `branch_id` filter, no `created_by` filter.
- **User:** `company_id = get_user_company_id()` AND `(branch_id IS NULL OR branch_id IN (SELECT branch_id FROM user_branches WHERE user_id = auth.uid()))`.

Helper: `is_admin_or_owner()` returns true when `get_user_role()::text IN ('admin', 'owner')`.

### Tables enforced (migration)

- **sales** — Admin/Owner: company; User: company + branch in user_branches.
- **payments** — Same.
- **journal_entries** — Same.
- **journal_entry_lines** — Allowed if parent journal_entry is visible (company + admin or branch).
- **contacts** — Admin/Owner: full company; User: own (`created_by = auth.uid()`) + system (walk-in).
- **rentals** — Same as sales (branch-scoped for user).
- **stock_movements** — Same.
- **ledger_master** — Company-scoped (all authenticated in company).

### Ledger: no created_by

- **Customer ledger** is driven by `customer_id` and `company_id` only.
- RPCs `get_customer_ledger_sales` and `get_customer_ledger_payments` use `p_company_id` and `p_customer_id` (or sale IDs); no `created_by` or user filter.
- App: `customerLedgerAPI.getCustomers()` and ledger fetches use company_id/customer_id only; no `is_system_generated` or `created_by` filter so walk-in and all sales are visible.

### Contact visibility

- Admin/Owner: all company contacts.
- User: own contacts (`created_by = auth.uid()`) + system (e.g. walk-in `is_system_generated = true`). Walk-in is never hidden from admin.

### Test matrix

| Test | Expected |
|------|----------|
| User creates sale | Sale visible to that user (branch) and to Admin in sales list and customer ledger. |
| Admin creates sale | Admin sees it; User sees it only if sale’s branch is in user_branches. |
| Walk-in sale by user | Admin sees it in customer ledger (same walk-in ID, no created_by filter). |

### Migration

- **`migrations/erp_permission_architecture_global.sql`**: adds `is_admin_or_owner()`, optional `user_role` value `owner`, and RLS policies on sales, payments, journal_entries, journal_entry_lines, contacts, rentals, stock_movements, ledger_master. Run once to apply the global permission standard.

---

## ERP Health Dashboard

Real-time health dashboard for admins/owners. **Access:** only users with role `admin` or `owner` can see data.

- **Migration:** `migrations/create_erp_health_dashboard_view.sql`
  - Defines **view** `public.erp_health_dashboard` (SELECT from function).
  - Defines **function** `public.get_erp_health_dashboard()` (SECURITY DEFINER, returns `component`, `status`, `details`). Checks `get_user_role() IN ('admin','owner')`; others get no rows.
  - No DO blocks, no temporary tables. Defensive: uses `information_schema` before querying tables so missing tables do not crash.
- **Components:** Walk-in Integrity (1 per company), Orphan Users, Orphan Sales, Negative Stock, Document Sequence Validity, Sales created_by integrity, Payments received_by integrity.
- **Frontend:** Settings → **System Health** tab (tab visible only to admin/owner). Table shows Component | Status | Details; OVERALL = FAIL if any component is FAIL, else PASS. Color coding: green (OK), red (FAIL), gray (SKIP).
- **Backend:** `healthService.getHealthDashboard()` calls RPC `get_erp_health_dashboard()`, returns `{ rows, overall, error? }`. Never throws.

---

## Notes

- **Identity model:** Only **auth.users(id)** is stored in `user_branches.user_id` and `user_account_access.user_id`. Never use `public.users.id` for access.
- **Unlinked users:** Until `auth_user_id` is set, branch/account access cannot be assigned. Use Invite/Create in Auth and link profile, then assign in UI.
- **Edge Function:** Deploy `create-erp-user` after changes. Self-hosted Supabase: ensure `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_URL` are set for the function.

---

## Fix: "user_branches_user_id_fkey" on branch assignment

If you see **"insert or update on table user_branches violates foreign key constraint user_branches_user_id_fkey"** when saving branch/account access:

1. **Cause:** `user_branches.user_id` must be **auth.users(id)**. Passing **public.users.id** (profile id) or a profile-only user (no auth account) causes this.
2. **Apply migration:** Run `migrations/rpc_user_branches_validate_auth_user.sql` (via `node scripts/run-migrations.js` or Supabase SQL Editor). It:
   - Ensures `set_user_branches` / `set_user_account_access` expect **auth.users(id)** only.
   - Validates that `p_user_id` exists in `auth.users` before insert; raises a clear `USER_NOT_LINKED` error otherwise.
3. **Frontend:** Add User modal now never sends profile id: if `auth_user_id` equals profile `id`, it treats the user as unlinked and shows "Use Invite first."
4. **For profile-only users:** Create/invite the user in Auth, link profile (`UPDATE public.users SET auth_user_id = <auth.id> WHERE ...`), then assign branches/accounts in the UI.
