# ERP Permission Engine – Final Architecture (v1)

## 1. Active Permission Engine (Production)

**Status:** ACTIVE PERMISSION ENGINE – DO NOT MODIFY

This is the only permission engine used in production by all ERP modules (Web + Mobile).

- **Core table:** `public.role_permissions` (role, module, action, allowed)
- **Engine roles:** `owner`, `admin`, `manager`, `user`
- **Main DB functions:** `is_owner_or_admin()`, `has_permission(module, action)`
- **RLS:** Sales, Purchases, Payments, Ledger, Inventory, Contacts, and other ERP tables call `is_owner_or_admin()` and `has_permission()` to enforce row visibility and write access.
- **Web UI:**
  - `SettingsContext` loads `role_permissions` for the current user’s engine role and derives `UserPermissions` flags.
  - `checkPermission()` in `src/app/utils/checkPermission.ts` and `useCheckPermission()` in `src/app/hooks/useCheckPermission.ts` gate all modules and actions.
  - Navigation (Sidebar, MobileNavDrawer, BottomNav), dashboards, and pages (Sales, Purchases, POS, Studio, Accounting, Inventory, Contacts, Reports, Users, Settings, Rentals, Expenses) all depend on these helpers.
- **Admin tools:**
  - Settings → Permission Management panel (`PermissionManagementPanel`) – edits `role_permissions` per engine role.
  - Settings → User Permissions tab (`UserPermissionsTab`) – branch access + role matrix using `role_permissions`.
  - ERP Permissions page (`ErpPermissionArchitecturePage` with Dashboard, Roles, Matrix, Users, Branch, RLS tabs) – visualizes the same engine.
  - Permission Inspector (`PermissionInspectorPage`) – reads `users`, `role_permissions`, `user_branches`, and effective branch to show the final matrix.

## 2. Role System

Logical *engine roles* (used by `role_permissions` and RLS):

1. **owner**  
   - Full company access.  
   - All branches, all modules, all actions allowed.  
   - Bypasses most checks via `is_owner_or_admin()`.

2. **admin**  
   - Full company access for day‑to‑day operations.  
   - Can manage users and system configuration.  
   - Has nearly all module actions, with a few high‑risk deletes optionally restricted.

3. **manager**  
   - Branch / department leadership.  
   - Typically has branch‑level sales visibility (`sales.view_branch`) and can create/edit records.  
   - Limited ledger scope, payment deletion and full‑accounting flags may be false.

4. **user** (salesman / staff)  
   - Frontline operators.  
   - Only assigned branches.  
   - Sales visibility controlled by `sales.view_own` / `sales.view_branch` flags.  
   - Payments receive only; minimal ledger access.

**Mapping from app/user roles → engine roles** is handled in `SettingsContext` (`EngineRole`):

- `owner` → `owner`
- `admin`, `super admin`, `superadmin` → `admin`
- `manager`, `accountant` → `manager`
- everything else → `user`

## 3. Branch Access Model

Branch access is enforced via:

- Table: `public.user_branches` – maps `auth.uid()` to one or more branch ids.
- Function: `get_effective_user_branch()` (see RLS helpers).
- RLS examples (from `migrations/erp_permission_engine_v1.sql`):
  - Sales view and write policies check:
    - `is_owner_or_admin()` **OR**
    - `has_permission('sales', 'view_company')` **OR**
    - `has_permission('sales', 'view_branch')` **AND** user has that branch via `user_branches` **OR**
    - `has_permission('sales', 'view_own')` **AND** `created_by = auth.uid()`.
  - Payments, inventory, and other modules follow the same pattern: branch‑scoped policies only allow actions when the user has the branch in `user_branches`.

The Web UI to manage branch access lives in:

- Settings → **User Permissions** tab (`UserPermissionsTab`) → per‑user branch checkboxes stored in `user_branches`.

## 4. Module Permissions

**Source of truth:** `public.role_permissions` with columns:

- `role`   – engine role (`owner`, `admin`, `manager`, `user`)
- `module` – logical module name (see below)
- `action` – module‑specific action
- `allowed` – boolean flag

### 4.1 Module codes

These codes are used consistently across DB, Web, and Mobile:

- `sales`
- `purchase`
- `pos`
- `studio`
- `rentals`
- `payments`
- `ledger`
- `inventory`
- `contacts`
- `reports`
- `users`
- `settings`
- (plus supporting modules like `expenses` and `products` mapped from `inventory/payments` in the UI layer)

The Web service `permissionService.MODULES_ACTIONS` defines the canonical actions per module, and the Permission Management panel iterates over this list to save `role_permissions` for each engine role.

### 4.2 Example seeds

See `migrations/erp_permission_engine_v1.sql` for full seed data. Highlights:

- Owners/Admins: full access across all modules.
- Managers: branch‑level sales view, can create/edit sales, but limited delete and accounting scope.
- Users: own‑level sales visibility, can receive payments, minimal ledger access.

## 5. Action Permissions

**UI‑level actions** (final normalized view for components):

- `view`
- `create`
- `edit`
- `delete`
- `cancel`
- `use` (for POS and similar flows)

These are mapped from `role_permissions` in `SettingsContext`:

- Sales: `sales.view_*`, `sales.create`, `sales.edit`, `sales.delete`
- Purchases: `purchase.view`, `purchase.create`, `purchase.edit`, `purchase.delete`
- POS: `pos.view`, `pos.use`
- Studio: `studio.view/create/edit/delete`
- Rentals: `rentals.view/create/edit/delete`
- Reports: `reports.view`
- Users: `users.create/edit/delete/assign_permissions`
- Settings: `settings.modify`
- Accounting: `ledger.view_customer/view_supplier/view_full_accounting`
- Inventory: `inventory.view/adjust/transfer`
- Contacts: `contacts.view/create/edit/delete`
- Payments/Expenses: `payments.receive/edit/delete`

`SettingsContext` converts these DB rows into `UserPermissions` flags (e.g. `canCreateSale`, `canEditSale`, `canViewReports`, etc.), and `checkPermission()` turns those flags into per‑module decisions for the UI.

## 6. Visibility Rules (Module‑Level, Generic)

Visibility is **module‑level and generic**: the same three scopes apply to every module that has record‑level data (not Sales‑specific).

### 6.1 Visibility scope (all relevant modules)

Each of these modules supports **mutually exclusive** visibility actions:

- **view_own** — only records where `created_by = auth.uid()` (or branch‑scoped if no `created_by`).
- **view_branch** — records where `branch_id IN user_branches`.
- **view_company** — all company records.

**Modules with visibility scope:** `sales`, `purchase`, `inventory`, `contacts`, `ledger`, `studio`, `rentals`, `payments`.  
**Priority in RLS:** company > branch > own (only one scope applies; see `migrations/module_visibility_scope_rls.sql`).

**Actions** (create, edit, delete, receive, view_customer, etc.) are **separate** from visibility and configured via checkboxes per module.

### 6.2 UI and RLS

- **UI:** Settings → Permission Management and ERP Permissions → Matrix tab show, for each of the above modules, a **radio group** (Own records only | Assigned branches | Full company) plus module‑specific action checkboxes.
- **RLS:** One policy pattern for all: `has_permission(module, 'view_company')` OR (`has_permission(module, 'view_branch')` AND branch in `user_branches`) OR (`has_permission(module, 'view_own')` AND `created_by = auth.uid()`), with priority so only one scope applies.
- **Helpers:** `checkPermission()`, `useCheckPermission()`; `SettingsContext` derives “can view” from any of the three visibility actions per module.

## 7. Experimental / Legacy Systems

The audit found several experimental or legacy artifacts. They are **NOT** used by production modules but are kept temporarily for reference.

Marking rules:

- Files and components that do **not** touch `role_permissions`, `permissionService`, `SettingsContext.currentUser`, `useCheckPermission()`, or DB helpers are considered experimental.

### 7.1 Web experimental UI

- `src/app/components/users/RolesDashboard.tsx`  
  - Uses mock data only.  
  - Commented as: `EXPERIMENTAL / UNUSED – Safe to remove after verification`.
- Any standalone design playgrounds under `Create ERP Permission Architecture/`  
  - These are design sandboxes, not wired to live ERP or Supabase.

### 7.2 Feature flags

- Web: `FEATURE_PERMISSION_V2` in `src/app/config/featureFlags.ts` drives theme/layout only; it does **not** introduce a second backend permission engine.  
- Mobile: `FEATURE_MOBILE_PERMISSION_V2` gates the **UI experience** but still reads from the same `role_permissions` table via `PermissionContext`.

## 8. Module‑to‑Engine Mapping (Production)

All listed modules below resolve permissions from the **same** engine (`role_permissions` + `checkPermission()`):

- **Sales** – `SalesPage.tsx` uses `useCheckPermission()` → `canCreateSale`, `canEditSale`, `canDeleteSale`, `canCancelSale`; RLS uses `has_permission('sales', ...)` and `user_branches`.
- **Purchases** – `PurchasesPage.tsx` uses `canDeletePurchase` and other flags from `useCheckPermission()`; RLS uses `has_permission('purchase', ...)`.
- **Inventory & Products** – Sidebar visibility via `hasPermission('inventory.view')`; RLS on stock/ledger uses `has_permission('inventory', ...)`.
- **POS** – `hasPermission('pos.use')`; RLS and RPC enforce via `has_permission('pos', 'use')`.
- **Studio Production** – `hasPermission('studio.view')` and related actions.
- **Accounting (Ledger)** – `AccountingDashboard` uses `canAccessAccounting`; RLS on ledger tables uses ledger module actions.
- **Contacts** – `canViewContacts`, `canCreateContact`, `canDeleteContact` derived from `role_permissions` contacts.* rows.
- **Reports** – `ReportsDashboardEnhanced` uses `canViewReports`.
- **Users** – User management UI gated via `canManageUsers`, derived from `users.*` module actions.
- **Settings** – Settings and Permission pages gated via `canManageSettings` / `settings.modify`.
- **Rentals / Expenses** – Rentals and expenses pages read `canManageRentals` / `canManageExpenses` (from rentals/payments modules).

## 9. Cleanup Phases

To keep production safe, cleanup follows three phases:

1. **Phase 1 – Marking (current state)**  
   - Core engine and helpers marked as:
     - `ACTIVE PERMISSION ENGINE – DO NOT MODIFY` in:
       - `migrations/erp_permission_engine_v1.sql`
       - `src/app/services/permissionService.ts`
       - `src/app/utils/checkPermission.ts`
       - (and referenced via `useCheckPermission()` / `SettingsContext`)
   - Experimental components marked as:
     - `EXPERIMENTAL / UNUSED – Safe to remove after verification`.

2. **Phase 2 – Verification**  
   - Confirm each production module (Sales, Products/Inventory, Purchases, POS, Studio, Accounting, Contacts, Rentals, Reports, Users, Settings) uses only:
     - `useCheckPermission()` / `checkPermission()` / `SettingsContext.currentUser`, and
     - DB helpers (`has_permission`, `is_owner_or_admin`, `role_permissions`, `user_branches`).
   - Ensure no code paths rely solely on `users.permissions` JSON without `role_permissions`.

3. **Phase 3 – Removal**  
   - After verification, remove or archive:
     - Mock‑based role dashboards (e.g. `RolesDashboard.tsx`).
     - Old design sandboxes not referenced by the main app.
   - Keep all DB‑level objects (`role_permissions`, `user_branches`, functions, RLS) intact.

---

This document is the authoritative reference for the ERP permission system going forward. Any new module must:

1. Add its module + actions to `permissionService.MODULES_ACTIONS` and seed `role_permissions` for all engine roles.
2. Use `has_permission(module, action)` and `is_owner_or_admin()` in RLS or RPCs.
3. Consume `useCheckPermission()` or `checkPermission()` in the UI, never bypassing these helpers.
