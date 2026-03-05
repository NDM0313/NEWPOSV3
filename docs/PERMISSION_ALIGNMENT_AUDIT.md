# Master Permission Alignment Audit (Web → Mobile)

**Date:** 2025-03-05  
**Type:** Architecture-level audit and alignment (no quick patch).

---

## 1. Web Permission Strategy (Analysis Summary)

### 1.1 Data model

| Layer | Implementation |
|-------|----------------|
| **Permission table** | `public.role_permissions` — columns: `role` (text), `module` (text), `action` (text), `allowed` (boolean). PK: `(role, module, action)`. |
| **Role structure** | Engine roles: `owner`, `admin`, `manager`, `user`. App roles (salesman, staff, cashier, etc.) map to engine via `get_user_role()` / SettingsContext. |
| **User–role mapping** | `public.users.role` (and optional `users.permissions` JSONB for overrides). Web resolves engine role from `users.role` and fetches `role_permissions` for that engine role. |
| **role_permissions usage** | Web: `permissionService.getRolePermissions(engineRole)` → builds `UserPermissions` flags in SettingsContext. Mobile: same table via `getRolePermissions(appRole)` → PermissionContext. |

### 1.2 Permission flow (DB → frontend)

1. User logs in → `users.role` and optionally `users.permissions` loaded.
2. Engine role derived (owner/admin/manager/user).
3. **Web:** `permissionService.getRolePermissions(engineRole)` returns rows; SettingsContext maps them to `UserPermissions` (canViewSale, canUsePos, canAccessStudio, etc.).
4. **Web:** Sidebar/nav use `useCheckPermission()` → `checkPermission(currentUser, module, action)` (Admin bypass, then granular flags).
5. **Mobile:** `permissionsApi.getRolePermissions(appRole)` → PermissionContext; `hasPermission('module.view')` uses same `role_permissions` rows via `hasModuleAction` / `canViewModule`.

### 1.3 Module visibility (Web)

- **Sidebar** (`Sidebar.tsx`): Contacts, Products, Inventory, Purchases, Sales, Rentals, POS, Studio, Expenses, Accounting, Reports, ERP Permissions, Settings — each gated by `useCheckPermission()` (e.g. `canViewContacts`, `canUsePos`, `canAccessStudio`).
- **Studio:** Gated by `settingsModules.studioModuleEnabled && canAccessStudio`.
- **POS:** Gated by `settingsModules.posModuleEnabled && canUsePos`.
- **isPermissionLoaded:** Sidebar/nav wait for permissions before showing module links.

### 1.4 RLS usage

- RLS policies use `get_user_company_id()` for company isolation on: sales, purchases, payments, contacts, products, stock_movements, studio_productions, studio_production_stages, etc.
- Some policies also use `has_permission(module, action)` (e.g. in `erp_permission_engine_v1`) or `is_owner_or_admin()` and branch checks via `user_branches`.
- **Permission logic:** Backend enforced by RLS (company + branch + optional has_permission). Frontend gating is UX only; no frontend-only access without backend validation.

### 1.5 Admin permission assignment (Web)

- **ERP Permissions** (route `erp-permissions`): `MatrixTab` — select role (owner/admin/manager/user), load `getRolePermissions(role)`, show modules/actions with checkboxes; `setRolePermission(role, module, action, allowed)` on toggle. Same keys as `permissionService.MODULES_ACTIONS` (sales, pos, purchase, studio, rentals, payments, ledger, inventory, contacts, reports, users, settings).
- **RolesTab:** Read-only view of role capabilities.
- **UserPermissionsTab:** User-level overrides (if used); primary source is role_permissions.

---

## 2. RLS Verification (Requested Tables)

| Table | SELECT | INSERT | UPDATE | DELETE | Company-scoped (get_user_company_id) | Notes |
|-------|--------|--------|--------|--------|-------------------------------------|------|
| **sales** | ✅ | ✅ | ✅ | ✅ | ✅ | `erp_permission_engine_v1.sql` + branch/view_own. |
| **studio_sales** | ✅ | ✅ | ✅ | ✅ | ✅ (via branch) | Optional migration added: `studio_sales_rls_company_scoped.sql` (company-scoped via `branches.company_id`). Run if table is in use. |
| **studio_productions** | ✅ | ✅ | ✅ | ✅ | ✅ | `studio_productions_rls_company_scoped.sql`. |
| **studio_production_stages** | ✅ | ✅ | ✅ | ✅ | ✅ (via parent) | Same migration; uses EXISTS on studio_productions.company_id. |
| **products** | ✅ | ✅ | ✅ | ✅ | ✅ | `sales_products_rls_role_based.sql` — company_id only. |
| **stock_movements** | ✅ | ✅ | ✅ | N/A | ✅ | `stock_movements_rls_branch_based.sql` — company_id + branch/user_branches. |

**Conclusion:** All requested tables except **studio_sales** have RLS with company scoping in migrations. If `studio_sales` is in use, add RLS policies (SELECT/INSERT/UPDATE/DELETE) with `company_id = get_user_company_id()` (and optional branch/permission checks).

---

## 3. Mobile Permission Strategy (Same as Web)

- **Source of truth:** Same `role_permissions` table; same engine roles (owner, admin, manager, user); app role → engine role mapping in `erp-mobile-app/src/api/permissions.ts` (`mapAppRoleToEngine`).
- **Keys:** No new permission names; mobile uses same module/action codes (sales, purchase, pos, studio, rentals, ledger, inventory, contacts, reports, users, settings, payments) via `permissionModules.ts` screen→module map.
- **HomeScreen:** Modules filtered by `hasPermission(\`${getPermissionModuleForScreen(m.id)}.view\`)` when FEATURE_MOBILE_PERMISSION_V2 is on.
- **Studio:** Shown only if `hasPermission('studio.view')` (studio screen → studio module).
- **POS:** Shown only if `hasPermission('pos.view')` (pos screen → pos module).
- **Navigation guard:** `canAccessScreen(screen, branchId)` in App.tsx uses `hasPermission(\`${module}.view\`)` and `hasBranchAccess(branchId)`.

No duplicate permission system; mobile is UI shell over same DB.

---

## 4. Admin Settings (Mobile)

- **Role Management UI:** Implemented in `UserPermissionsScreen.tsx` — list roles (owner, admin, manager, user), view assigned permissions per role, toggle permission checkboxes, save via `setRolePermission(role, module, action, allowed)`.
- **Permission groups:** Shown by module (sales, pos, purchase, studio, rentals, payments, ledger, inventory, contacts, reports, users, settings) — same as Web.
- **Access:** Screen is reachable from Settings → "User Permissions". When FEATURE_MOBILE_PERMISSION_V2 is on, this row should be visible only to users with `settings.modify` (e.g. hasPermission('settings.view') or dedicated admin check) so it matches Web’s ERP Permissions gating.

---

## 5. Consistency Rules Applied

- No new permission names; mobile uses same keys as Web and DB.
- No duplicate logic; single role_permissions source.
- Frontend gating is UX only; RLS enforces at backend.
- Backend permission gaps (e.g. studio_sales RLS) are flagged, not silently ignored.

---

## 6. Risk Audit (Summary)

| Risk | Mitigation |
|------|------------|
| studio_sales table without RLS in migrations | Add RLS migration if table is used; otherwise document as legacy/unused. |
| Mobile admin sees Role Permissions without settings permission | Gate "User Permissions" row by hasPermission('settings.modify') when V2 on. |
| Console logs in PermissionContext | Optional: reduce or remove in production build. |
| get_user_company_id() NULL (user not in public.users) | Already documented in STUDIO_SALE_LEDGER_FIX; RPC null-safe pattern in place where needed. |

---

*End of audit. Implementation details: see PERMISSION_ENGINE_AUDIT.md and code references above.*
