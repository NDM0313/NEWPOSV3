# 04 — Permissions and RLS Rules

Flutter must match **web ERP** and **Capacitor mobile** permission behavior. Client-side hiding is UX only; **Postgres RLS** enforces data access.

## Two-layer gating

### Layer 1: Company module toggles (`modules_config`)

- Table: `modules_config(company_id, module_name, is_enabled)`
- RLS: all company users read; admin/owner write ([`modules_config_rls_all_company_users.sql`](../../migrations/modules_config_rls_all_company_users.sql))
- Web registry: [`src/app/config/companyBootstrapRegistry.ts`](../../src/app/config/companyBootstrapRegistry.ts)
- Mobile load: [`erp-mobile-app/src/api/settings.ts`](../../erp-mobile-app/src/api/settings.ts) → `getModuleConfigs()`

Mobile `MODULE_CONFIG_NAMES`: `rentals`, `studio`, `accounting`, `production`, `pos`, `combos`.

`PermissionContext.isModuleEnabled(screen)` gates:

- `rental` → `rentalModuleEnabled`
- `studio` → `studioModuleEnabled`
- `pos` → `posModuleEnabled`
- `accounts` → `accountingModuleEnabled`

On load failure, mobile uses **safe fail-closed** toggles (all false) for toggleable modules — [`PermissionContext.tsx`](../../erp-mobile-app/src/context/PermissionContext.tsx).

### Layer 2: Role permissions (`role_permissions`)

- Table: `role_permissions(role, module, action, allowed)`
- Engine roles: `owner | admin | manager | user` ([`functionalRoles.ts`](../../erp-mobile-app/src/config/functionalRoles.ts))
- DB helpers: [`migrations/erp_permission_engine_v1.sql`](../../migrations/erp_permission_engine_v1.sql)
  - `get_user_role_normalized()`
  - `is_owner_or_admin()` — bypass
  - `has_permission(module, action)`

Mobile loads via [`api/permissions.ts`](../../erp-mobile-app/src/api/permissions.ts) → `getRolePermissions(appRole)`.

Feature flag: `FEATURE_MOBILE_PERMISSION_V2` defaults **on** ([`config/featureFlags.ts`](../../erp-mobile-app/src/config/featureFlags.ts)). When off, mobile treats user as admin (legacy dev mode).

## App role → engine role mapping

From [`erp-mobile-app/src/config/functionalRoles.ts`](../../erp-mobile-app/src/config/functionalRoles.ts):

| App role(s) | Engine role |
|-------------|-------------|
| `owner` | `owner` |
| `admin`, `super admin` | `admin` |
| `manager`, `accountant` | `manager` |
| `staff`, `salesman`, `cashier`, `viewer`, `user`, … | `user` |

`canViewFinancialBalances`: owner, admin, manager only.

## Visibility scopes (mutually exclusive)

From [`migrations/module_visibility_scope_rls.sql`](../../migrations/module_visibility_scope_rls.sql):

| Scope | Meaning |
|-------|---------|
| `view_company` | All rows in company (if permitted) |
| `view_branch` | Rows where `branch_id` in user's `user_branches` |
| `view_own` | Rows where `created_by = auth.uid()` |

Mobile `hasModuleAction()` treats `view` as matching any of: `view`, `view_own`, `view_branch`, `view_company` ([`permissions.ts`](../../erp-mobile-app/src/api/permissions.ts)).

**Owner/admin:** bypass all scope checks in RLS via `is_owner_or_admin()`.

## Role behavior summary

| Role | Branch picker | Data visibility | Balances / GL |
|------|---------------|-----------------|---------------|
| **Admin / owner** | All branches (`canPickAllCompanyBranches`) | Company-wide | Full |
| **Manager** | Assigned branches | Per `role_permissions` scopes | Yes (balances) |
| **Salesman / user** | Usually one branch | Often `view_own` on sales/contacts | No GL balances by default |

Admin branch behavior in [`App.tsx`](../../erp-mobile-app/src/App.tsx): `canPickAllCompanyBranches(role)` → all active branch IDs.

## Walk-in customer rules

- Default walk-in contact: `is_system_generated`, `is_default` on `contacts`
- Salesman contact RLS: [`contacts_rls_salesman_strict_isolation.sql`](../../migrations/contacts_rls_salesman_strict_isolation.sql) — salesman sees default walk-in + **own** customers only
- Payment walk-in override: [`20260508210000_record_customer_payment_walkin_reference_override.sql`](../../migrations/20260508210000_record_customer_payment_walkin_reference_override.sql)

Flutter: do not filter walk-in out of customer pickers for sales; RLS still applies on contact list queries.

## Branch rules

| Rule | Implementation |
|------|----------------|
| Branch assignment | `user_branches`; RPC `get_effective_user_branch` |
| Admin all branches | `canPickAllCompanyBranches()` in `permissions.ts` |
| Branch access check | `hasBranchAccess(branchId)` — user's `branchIds` includes branch |
| Single-branch company | If one branch in company and no assignments → auto-select |
| Stock reads | Include `branch_id = X OR branch_id IS NULL` for legacy opening stock (web [`branchScope.ts`](../../src/app/utils/branchScope.ts)) |
| Session cache | `BRANCH_STORAGE_KEY = 'erp_mobile_branch'` in `App.tsx` |

## Screen → permission gate table

| Screen | Module | Typical actions |
|--------|--------|-----------------|
| `sales` | `sales` | `view`, `create`, `edit`, `delete`, `finalize` |
| `pos` | `pos` | `view`, `create` |
| `purchase` | `purchase` | `view`, `create`, `edit` |
| `rental` | `rentals` | `view`, `create`, `edit` |
| `studio` | `studio` | `view`, `create`, `edit`; `shouldScopeStudioToOwnOnly` |
| `accounts` | `ledger` | `view`, `create` (manual entries) |
| `expense` | `payments` | `view`, `create` (mapped to payments module) |
| `products`, `inventory` | `inventory` | `view`, `create`, `edit` |
| `contacts` | `contacts` | `view`, `create`, `edit` |
| `reports`, `dashboard` | `reports` | `view` |
| `ledger` | `ledger` | `view`; `canViewCustomerLedger`, `canViewSupplierLedger` |
| `settings` | `settings` | `view`; shell skips module.view gate |
| `packing` | `sales` | `view` (sales wholesale workflow) |

Mobile helpers in [`permissions.ts`](../../erp-mobile-app/src/api/permissions.ts):

- `canUseFullAccounting(perms, isAdminOrOwner)`
- `canViewCustomerLedger(perms, isAdminOrOwner)`
- `canViewSupplierLedger(perms, isAdminOrOwner)`
- `shouldScopeStudioToOwnOnly(perms, isAdminOrOwner)`

## Counter-worker mode

Files: [`CounterWorkerContext.tsx`](../../erp-mobile-app/src/context/CounterWorkerContext.tsx), [`sharedCounterMode.ts`](../../erp-mobile-app/src/lib/sharedCounterMode.ts).

- Shared POS device: admin logs in once; workers switch via PIN
- Effective worker profile drives `created_by`, salesman metrics, dashboard (`useEffectiveWorkerProfile`)
- Flutter Phase 6 unless user requests Phase 1 parity

## RLS risks for Flutter

| Risk | Mitigation |
|------|------------|
| UI shows records user cannot insert | Gate create buttons with same permission codes |
| Salesman creates sale on wrong branch | Validate `hasBranchAccess(branchId)` before submit |
| Payment insert denied | Check `payments.receive` + branch |
| Contact list empty for salesman | Expected if no own customers; walk-in still available for sales |
| Journal entry visibility | `journal_entries` follows same visibility scopes |
| Invited users (`auth_user_id` ≠ `users.id`) | `get_user_company_id()` resolves both id paths |

RLS policy sources:

- [`erp_permission_engine_v1.sql`](../../migrations/erp_permission_engine_v1.sql)
- [`module_visibility_scope_rls.sql`](../../migrations/module_visibility_scope_rls.sql)
- Legacy salesman policies may coexist — audit live DB policy list

## Web parity references

| File | Role |
|------|------|
| [`src/app/services/permissionEngine.ts`](../../src/app/services/permissionEngine.ts) | Cached permissions |
| [`src/app/services/permissionService.ts`](../../src/app/services/permissionService.ts) | DB read/write |
| [`src/app/utils/checkPermission.ts`](../../src/app/utils/checkPermission.ts) | `checkPermission(permissions, module, action)` |
| [`src/app/hooks/useCheckPermission.ts`](../../src/app/hooks/useCheckPermission.ts) | Documented as shared with mobile |

Flutter `hasPermission('module.action')` must use **identical** module and action strings as web.

## Account access for payments

Non-admin users may be restricted to specific GL accounts via `user_account_access` ([`user_account_access_and_rbac_rls.sql`](../../migrations/user_account_access_and_rbac_rls.sql)). Payment account pickers must load only allowed accounts for operators.
