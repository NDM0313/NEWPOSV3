# Full ERP Permission Engine v1.0

Enterprise role + permission + visibility engine. Replaces overlapping branch-only and created_by logic with a single, configurable model.

---

## Architecture Flow

```
USER LOGIN
   ↓
get_user_role()
   ↓
get_user_role_normalized() → owner | admin | manager | user
   ↓
has_permission(module, action)
   ↓
RLS Policy (sales, payments, journal_entries, contacts, etc.)
   ↓
Visible Data
```

---

## Phase 1 — Role Structure

| Role    | Scope        | Rules |
|---------|--------------|--------|
| **owner**  | Full company | Override everything; cannot be restricted or demoted (last owner protected). |
| **admin**  | Full company | Can manage users and configure permissions; no branch restriction. |
| **manager**| Branch       | Branch-scoped; configurable module permissions (sales.view_branch, payments.receive, ledger.view_customer, etc.). |
| **user**   | Branch / own | Visibility configurable (view_own / view_branch); limited financial permissions. |

App roles (salesman, staff, cashier, inventory, accountant) map to **user** or **manager** via `get_user_role_normalized()`.

---

## Phase 2 — Permission Data Model

**Table:** `public.role_permissions`

| Column   | Type    | Description |
|----------|---------|-------------|
| role     | text    | owner, admin, manager, user |
| module   | text    | sales, payments, ledger, inventory, contacts, reports, users, settings |
| action   | text    | e.g. view_own, view_branch, view_company, create, edit, delete |
| allowed  | boolean | true/false |

**Primary key:** `(role, module, action)`.

**RLS:** SELECT for all authenticated; INSERT/UPDATE/DELETE only for `get_user_role() IN ('owner','admin')`.

---

## Phase 3 — Permission Functions

- **get_user_role()** — Existing; returns current user’s role from `public.users`.
- **get_user_role_normalized()** — Maps to `owner` | `admin` | `manager` | `user` (accountant → manager; rest → user).
- **is_owner_or_admin()** — True if role is owner or admin (full company, unrestricted).
- **has_permission(p_module, p_action)** — True if `is_owner_or_admin()` or `role_permissions` allows that (role, module, action).

---

## Phase 4 — RLS Rewrite

Policies use `has_permission()` and `is_owner_or_admin()` instead of ad-hoc role/branch checks.

**Sales SELECT example:**

- `company_id = get_user_company_id()` AND (
  - `is_owner_or_admin()` OR
  - `has_permission('sales','view_company')` OR
  - `has_permission('sales','view_branch')` AND branch in `user_branches` OR
  - `has_permission('sales','view_own')` AND `created_by = auth.uid()`  
)

**Tables updated:** sales, payments, journal_entries, journal_entry_lines, contacts, rentals, stock_movements, ledger_master.

Ledger remains **customer-based** (no created_by filter in ledger RPCs).

---

## Phase 5 — Settings UI

**Settings → Permission Management** (admin/owner only):

- **Role editor** — Select role (owner, admin, manager, user); toggle module/action permissions.
- **Sales visibility** — Own only / Branch / Company.
- **Payment permissions** — Can receive, edit, delete.
- **Ledger permissions** — View customer ledger, supplier ledger, full accounting.
- **Other modules** — inventory, contacts, reports, users, settings.

Changes are written to `role_permissions`. Owner and admin retain full access regardless of toggles.

---

## Phase 6 — User Management

- **Role selector** — Includes Owner, Administrator, Manager, Staff, Salesman, Cashier, Inventory Clerk.
- **Branch assignment** — Via User Management (existing); admin/owner do not need branch/account assignment (full access).
- **Account access** — Existing account-access flow; all access still derives from role + `role_permissions` for RLS.

No manual SQL required; all access flows from role + `role_permissions`.

---

## Phase 7 — Owner Protection

- **Trigger:** `check_owner_protection()` on `public.users` BEFORE UPDATE OR DELETE.
- **Update:** Cannot demote the last owner (role changed from owner to something else) per company.
- **Delete:** Cannot delete the last owner per company.
- Error message: *"Cannot demote/delete the last owner. Assign another owner first."*

---

## Phase 8 — Health Dashboard Integration

**Component:** "Permission Engine Integrity" (in ERP Health Dashboard, admin/owner only).

Checks:

- `role_permissions` has rows for all four engine roles (owner, admin, manager, user).
- Each role has at least one base sales visibility (view_own / view_branch / view_company) allowed.
- No user has null or empty role.
- Every company has at least one owner.

Implemented in `get_erp_health_dashboard_permission_checks()`. The dashboard view is `SELECT * FROM get_erp_health_dashboard() UNION ALL SELECT * FROM get_erp_health_dashboard_permission_checks()`.

---

## Phase 9 — Migration Plan

1. **erp_permission_engine_v1.sql**
   - Create `role_permissions` table and RLS.
   - Seed default permissions (owner/admin all true; manager/user as specified in task).
   - Create `get_user_role_normalized()`, `is_owner_or_admin()`, `has_permission()`.
   - Rewrite RLS on sales, payments, journal_entries, journal_entry_lines, contacts, rentals, stock_movements, ledger_master.
   - Add owner protection trigger on `public.users`.

2. **erp_health_permission_engine_integrity.sql** (run after v1)
   - Create `get_erp_health_dashboard_permission_checks()`.
   - Recreate view `erp_health_dashboard` as union of original health function and permission checks.

**Order:** Run after `erp_permission_architecture_global.sql`, `identity_model_auth_user_id.sql`, and `create_erp_health_dashboard_view.sql`.

---

## Phase 10 — Rules

- No frontend-only filtering hacks; visibility is enforced by RLS.
- No mixed branch + created_by logic outside the permission engine; all gated by `has_permission()` / `is_owner_or_admin()`.
- Ledger stays customer-based (customer_id + company_id).
- Admin and owner always have full company access in RLS.
- Owner is always unrestricted and protected (last-owner guard).
- Permission toggles are configurable from Settings → Permission Management.

---

## Deliverables

| Item | Location |
|------|----------|
| SQL migration (table, seed, functions, RLS, owner protection) | `migrations/erp_permission_engine_v1.sql` |
| Health integration migration | `migrations/erp_health_permission_engine_integrity.sql` |
| Permission service | `src/app/services/permissionService.ts` |
| Settings UI | `src/app/components/settings/PermissionManagementPanel.tsx`; tab in `SettingsPageNew.tsx` |
| User Management (role + owner in dropdown, admin/owner branch note) | `src/app/components/users/AddUserModal.tsx` |
| Health dashboard (view union + frontend uses view) | View updated; `healthService.ts` uses `from('erp_health_dashboard').select()` |
| Documentation | This file: `docs/ERP_PERMISSION_ENGINE_V1.md` |

---

## Final Result

- **User (view_own):** Sees only own sales.
- **Manager (view_branch):** Sees branch data.
- **Admin:** Full company.
- **Owner:** Unrestricted; cannot be demoted or removed if last owner.

No repeated patching; no hidden filtering; single source of truth in `role_permissions` and RLS.
