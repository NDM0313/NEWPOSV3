# 02 — User / Role / Permission Engine

**Last updated:** 2026-04-12
**Domain:** Multi-tenant access control — user management, role assignment, granular permission checks
**Key files:**
- `src/app/services/permissionEngine.ts`
- `src/app/services/permissionService.ts`
- `src/app/services/userService.ts`
- `src/app/hooks/usePermissions.ts`
- `src/app/hooks/useCheckPermission.ts`
- `src/app/utils/checkPermission.ts`

---

## Business Purpose

Every user in the ERP belongs to exactly one company (`company_id`) and has a role (`owner`, `admin`, `manager`, `user`). Roles control what modules a user can see and what actions they can perform. Permissions are defined per-role in the `role_permissions` table (not per-user), meaning changing a role's permissions affects all users in that role immediately (after cache expiry).

The permission engine loads and caches this data once at login, then answers all UI checks from in-memory state without further DB hits. The DB's RLS policies enforce the same restrictions at the data layer.

---

## UI Entry Points

| View key | Component | Purpose |
|----------|-----------|---------|
| `users` | `src/app/components/users/UserDashboard.tsx` | List all company users; add/edit/deactivate |
| `users` | `src/app/components/erp-permissions/UsersTab.tsx` | Users tab within ERP Permissions admin panel |
| `users` | `src/app/components/users/AddUserModal.tsx` | Create a new ERP user with auth + branch + account access |
| `users` | `src/app/components/users/UserProfilePage.tsx` | View/edit a single user's profile and branch access |
| `roles` | `src/app/components/settings/UserPermissionsTab.tsx` | Per-role permission matrix UI (consumed by admins) |
| `erp-permissions` | `src/app/components/erp-permissions/ErpPermissionArchitecturePage.tsx` | Audit/architecture view of the full permission system |
| `erp-permissions` | `src/app/components/admin/PermissionInspectorPage.tsx` | Inspect live derived permissions for any role |
| `erp-permissions` | `src/app/components/settings/PermissionManagementPanel.tsx` | Toggle individual module.action permissions per role |

---

## Frontend Files

| File | Role |
|------|------|
| `src/app/services/permissionEngine.ts` | Session-scoped permission cache. Loads once from DB, answers all UI checks from memory/localStorage. |
| `src/app/services/permissionService.ts` | DB layer: fetch `role_permissions` rows, upsert permission changes. Defines all valid modules and actions. |
| `src/app/services/userService.ts` | User CRUD: create via Edge Function, update profile, manage branch/account access via RPC. |
| `src/app/hooks/usePermissions.ts` | React hook: reads `getDerivedPermissions()` from engine + `SettingsContext.currentUser`. |
| `src/app/hooks/useCheckPermission.ts` | React hook: flat boolean getters (`canEditSale`, `canAccessAccounting`, etc.) for direct JSX use. |
| `src/app/utils/checkPermission.ts` | Pure function `checkPermission(permissions, module, action)` — shared by Web and Mobile. |

---

## Backend Services (with key functions)

### `permissionService` (`permissionService.ts`)

| Function | Purpose |
|----------|---------|
| `getRolePermissions(role: EngineRole)` | Fetches all `role_permissions` rows for a role. Cached in `rolePermissionsCache` Map per session. |
| `getAllRolePermissions()` | Fetches all rows for all roles (admin only). Used by the permission management UI. |
| `setRolePermission(role, module, action, allowed)` | Upserts a single permission row. Conflict key: `role,module,action`. Calls `invalidateRoleCache(role)` and `permissionEngine.invalidateForRole(role)` after write. |
| `setRolePermissionsBulk(role, updates[])` | Iterates `setRolePermission` for batch updates (no bulk upsert). |
| `getActionsForModule(module)` | Returns valid action strings for a module from `MODULES_ACTIONS`. |
| `isVisibilityScopeModule(module)` | Type guard — true for `sales`, `purchase`, `inventory`, `contacts`, `ledger`, `studio`, `rentals`, `payments`. |

**`EngineRole` type:** `'owner' | 'admin' | 'manager' | 'user'`

**`MODULES_ACTIONS` registry** (defines the full permission surface):

| Module | Valid Actions |
|--------|--------------|
| `sales` | `view_own`, `view_branch`, `view_company`, `create`, `edit`, `delete` |
| `pos` | `view`, `use` |
| `purchase` | `view_own`, `view_branch`, `view_company`, `create`, `edit`, `delete` |
| `studio` | `view_own`, `view_branch`, `view_company`, `view`, `create`, `edit`, `delete` |
| `rentals` | `view_own`, `view_branch`, `view_company`, `create`, `edit`, `delete` |
| `payments` | `view_own`, `view_branch`, `view_company`, `receive`, `edit`, `delete` |
| `ledger` | `view_own`, `view_branch`, `view_company`, `view_customer`, `view_supplier`, `view_full_accounting` |
| `inventory` | `view_own`, `view_branch`, `view_company`, `view`, `adjust`, `transfer` |
| `contacts` | `view_own`, `view_branch`, `view_company`, `create`, `edit`, `delete` |
| `reports` | `view` |
| `users` | `create`, `edit`, `delete`, `assign_permissions` |
| `settings` | `modify` |

### `permissionEngine` (`permissionEngine.ts`)

| Function | Purpose |
|----------|---------|
| `loadPermissions(userId, companyId, role, uiRole)` | Main loader. Checks memory cache → localStorage → DB (via `getRolePermissions`). Calls `deriveFromRows()` to produce `UserPermissions`. Stores result in both caches. Cache TTL: 24 hours. |
| `getDerivedPermissions()` | Returns the in-memory `UserPermissions` if non-stale. Returns `null` if not loaded or expired. |
| `has(module, action)` | Fast boolean check against cached `UserPermissions`. Called without awaiting. |
| `clear()` | Called on logout. Clears memory cache and all `erp_perm_*` keys from localStorage. |
| `invalidateForRole(role)` | Called after `setRolePermission`. Clears memory cache if role matches; removes matching localStorage keys. |
| `deriveFromRows(rolePerms, uiRole)` | Private. Reduces an array of `RolePermissionRow` into a flat `UserPermissions` object. |

**Cache key format:** `erp_perm_${userId}_${companyId}_${role}` (localStorage)

### `userService` (`userService.ts`)

| Function | Purpose |
|----------|---------|
| `createUserWithAuth(params)` | Primary user creation path. Invokes `create-erp-user` Edge Function with `Authorization: Bearer <session.access_token>`. Returns `{ success, user_id, auth_user_id, assignedBranchesCount, assignedAccountsCount }`. |
| `createUser(user)` | Legacy fallback: direct insert into `users` table (no auth account created). |
| `updateUser(id, updates)` | Updates `public.users` row. Passes `permissions` JSONB column through unchanged. |
| `deleteUser(id)` | Soft delete: sets `is_active = false`. |
| `generateUserCode(companyId)` | Reads last `user_code` matching `USR-NNN`, increments, returns `USR-001` as default. |
| `getUserBranches(userId)` | Reads `user_branches` where `user_id = userId` (userId = `auth_user_id`). |
| `setUserBranches(userId, branchIds, defaultBranchId, companyId)` | Calls `set_user_branches` RPC (auth_user_id only). |
| `getUserAccountAccess(userId)` | Reads `user_account_access` where `user_id = userId` (auth_user_id). |
| `setUserAccountAccess(userId, accountIds, companyId)` | Calls `set_user_account_access` RPC (auth_user_id only). |
| `resolvePublicUserId(companyId, maybeId)` | Calls `get_public_user_id` RPC or falls back to OR query. Converts `auth_user_id` to `public.users.id`. |
| `getSalesmen(companyId)` | Filters active users by `can_be_assigned_as_salesman`, `role`, or `permissions.canCreateSale`. Joins `employees` table for `commission_rate`. |
| `getUsersForSalary(companyId)` | Returns users with roles in `['admin', 'manager', 'staff', 'salesman', 'operator', 'cashier', 'inventory']`. Workers excluded. |
| `sendResetEmail(userId)` | Invokes `user-admin-actions` Edge Function with `{ action: 'send_reset_email' }`. |
| `resetPassword(userId, newPassword)` | Invokes `user-admin-actions` Edge Function with `{ action: 'reset_password' }`. |

---

## DB Tables

### `public.users`
The ERP user profile table. One row per user per company.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | ERP profile id (distinct from `auth_user_id`) |
| `company_id` | uuid FK | Tenant isolation key |
| `email` | text | Mirrors auth email |
| `full_name` | text | Display name |
| `role` | text | One of: `owner`, `admin`, `manager`, `user`, `staff`, `salesman`, `operator`, `cashier`, `inventory` |
| `code` / `user_code` | text | Auto-generated `USR-NNN` (trigger or `generateUserCode`) |
| `is_active` | boolean | Soft-delete flag |
| `auth_user_id` | uuid | Links to `auth.users.id`. Null = no login credentials yet |
| `can_be_assigned_as_salesman` | boolean | Controls salesman dropdown visibility |
| `default_commission_percent` | numeric | Default commission for sale forms |
| `permissions` | jsonb | Legacy per-user permission flags (`canCreateSale`, `canBeAssignedAsSalesman`, etc.) |
| `last_login_at` | timestamptz | Updated by auth trigger |

### `public.user_branches`
Maps which branches a user can access.

| Column | Notes |
|--------|-------|
| `user_id` | `auth.users.id` (NOT `public.users.id`) |
| `branch_id` | FK to `branches` |
| `is_default` | True for the user's home branch |

RLS-filtered by `auth.uid()` so users can only read their own rows.

### `public.user_account_access`
Maps which GL accounts a user can see in accounting views.

| Column | Notes |
|--------|-------|
| `user_id` | `auth.users.id` |
| `account_id` | FK to `accounts` |

### `public.role_permissions`
The authoritative permission configuration table.

| Column | Type | Notes |
|--------|------|-------|
| `role` | text | `owner`, `admin`, `manager`, `user` |
| `module` | text | One of the 12 modules in `MODULES_ACTIONS` |
| `action` | text | Action string (e.g. `create`, `view_branch`, `use`) |
| `allowed` | boolean | Whether this role has this permission |

Unique constraint on `(role, module, action)`. Upserted by `setRolePermission`.

### `erp_feature_flags` / `feature_flags` (localStorage)
Feature flags are stored in localStorage as `erp_feature_permission_v2` (boolean). Not a DB table — controlled by `FeatureFlagContext`. See Feature Flag section below.

---

## User Create Flow

1. Admin opens **Add User** modal (`AddUserModal.tsx`).
2. Fills: email, full name, role, branches, accounts, temporary password.
3. On submit: `userService.createUserWithAuth(params)` is called.
4. This calls the **`create-erp-user` Edge Function** (server-side, bypasses RLS):
   - Creates `auth.users` entry (Supabase Auth).
   - Inserts `public.users` row with `auth_user_id` linked.
   - Calls `set_user_branches` RPC to assign branch access.
   - Calls `set_user_account_access` RPC to assign account access.
   - Returns `{ success, user_id, auth_user_id, assignedBranchesCount, assignedAccountsCount }`.
5. If Edge Function unavailable: `userService.createUser()` is used as fallback (ERP profile only; no auth account).

**User code generation:** `generateUserCode(companyId)` queries the max `user_code` matching `USR-(\d+)`, increments, returns `USR-001` if none found. A DB trigger may also set this automatically.

---

## Role Assignment Flow

Roles are a field on the `users` row (`users.role`). Changing a user's role is done via `userService.updateUser(id, { role: 'manager' })`. There is no role-assignment RPC; it is a direct update.

Granular permissions are configured per-role (not per-user) via `permissionService.setRolePermission(role, module, action, allowed)`. After a change:
1. `invalidateRoleCache(role)` clears the `rolePermissionsCache` in-memory Map.
2. `permissionEngine.invalidateForRole(role)` clears memory cache and localStorage entries for that role.
3. The next session load for any user in that role will re-fetch from `role_permissions`.

---

## Permission Check Flow (how `permissionEngine.ts` works at runtime)

```
Login
  └─ SettingsContext mounts
       └─ loadPermissions(userId, companyId, role, uiRole) called
            ├─ Check memoryCache (PermissionCacheEntry) — if non-stale: return derived
            ├─ Check localStorage key erp_perm_{userId}_{companyId}_{role} — if non-stale: restore to memoryCache, return
            └─ DB fetch: getRolePermissions(role) → public.role_permissions
                 └─ deriveFromRows(rolePerms, uiRole) → UserPermissions
                      └─ Store in memoryCache + localStorage (24h TTL)

Component render
  ├─ useCheckPermission() → reads SettingsContext.currentUser (UserPermissions) → checkPermission(permissions, module, action)
  ├─ usePermissions() → getDerivedPermissions() || currentUser → checkPermission() or has()
  └─ permissionEngine.has(module, action) → getDerivedPermissions() → inline switch logic
```

`checkPermission(permissions, module, action)` in `checkPermission.ts` is the canonical UI check function:
- **Admin role bypass:** `if (permissions.role === 'Admin') return true` — Admins always pass all checks.
- All other roles use the boolean flags on `UserPermissions` (e.g. `canCreateSale`, `canViewContacts`).
- The `accounting.create` action is restricted to `Manager` role even if they have accounting access.

---

## Feature Flag vs Module Toggle vs Role Permission (three-layer access control)

The system has three distinct layers. All three must pass for a user to reach a feature.

### Layer 1: Feature Flag (`FeatureFlagContext`)
- Stored in localStorage as `erp_feature_permission_v2` (boolean, defaults `true`).
- A global on/off switch for the new permission engine.
- If `false`, the system may fall back to legacy role-based access without granular `role_permissions` checks.
- Controlled by `FeatureFlagContext.tsx`.

### Layer 2: Module Toggle (company-level settings)
- Stored in the `company_settings` or `companies` table (e.g. `has_studio`, `has_rentals`).
- Hides entire modules from the navigation for companies that have not enabled that module.
- Controlled by `SettingsContext` on load.

### Layer 3: Role Permission (`role_permissions` table)
- Granular allow/deny per `(role, module, action)`.
- Loaded once at login via `loadPermissions()`, cached for 24 hours.
- Checked at every UI gate via `checkPermission()`, `useCheckPermission()`, or `permissionEngine.has()`.
- Also enforced at the DB level via RLS policies that call `has_permission(module, action)` or `get_user_role()` RPCs.

**Summary:** Feature flag gates the engine itself. Module toggle gates company-level feature availability. Role permissions gate per-user action within an available module.

---

## RLS (Row Level Security) — how Supabase enforces company isolation

All data tables have RLS enabled. Policies follow this pattern:

```sql
-- Read: user must belong to the same company
USING (company_id = (SELECT company_id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1))

-- Write: same company check + role check via DB function
WITH CHECK (
  company_id = get_current_company_id()
  AND has_permission('sales', 'create')
)
```

Key RLS helper functions:
- `get_current_company_id()` — returns the `company_id` of the authenticated user from `public.users` where `auth_user_id = auth.uid()`.
- `get_user_role()` — returns the `role` string for the current auth user.
- `has_permission(module, action)` — queries `role_permissions` for the current user's role.

The `role_permissions` table itself is readable only by `owner`/`admin` roles (RLS policy on that table).

The `user_branches` table is readable by the user for their own `user_id` (auth_user_id), ensuring users can only see branches assigned to them.

---

## Branch Access (`user_branches` table — which branches a user can see)

Each user can be assigned to one or more branches. Branch access controls which branch's data appears in branch-filtered queries.

**Key points:**
- `user_branches.user_id` stores `auth.users.id` (the `auth_user_id`), **not** `public.users.id`.
- The `set_user_branches` RPC accepts `p_user_id` (auth_user_id), `p_branch_ids[]`, `p_default_branch_id`, `p_company_id`.
- `getUserBranches(userId)` reads `user_branches` where `user_id = userId` (must pass `auth_user_id`).
- Admin sets branch access in **Edit User → Branch Access** tab, which calls `setUserBranches()`.
- `REQUIRE_RPCS_FOR_ACCESS_SETTINGS = true` in `userService.ts` — if the `set_user_branches` RPC is missing (code `42883`), an informative error is thrown with migration instructions.

Migration required: `identity_model_auth_user_id.sql` then `rpc_user_branches_accounts_auth_id_only.sql`.

---

## Known Failure Points

1. **`auth_user_id` vs `public.users.id` confusion.** `user_branches.user_id` and `user_account_access.user_id` store `auth_user_id`. If a caller passes `public.users.id` instead, branch/account assignment silently writes to the wrong row or fails the RLS check. Use `resolvePublicUserId()` only when a public profile id is explicitly needed; pass `auth_user_id` directly for branch/account RPCs.

2. **Cache not invalidated on role change.** If an admin changes a user's `users.role` field, the permission engine cache is NOT invalidated (it is keyed on the role at login time). The affected user must log out and back in to pick up the new role's permissions. `invalidateForRole` only clears cache for the old role — users already in the new role are unaffected.

3. **`setRolePermissionsBulk` is serial, not atomic.** It calls `setRolePermission` in a loop. A failure mid-way leaves permissions in a partial state. There is no transaction or rollback.

4. **Legacy `users.permissions` JSONB column.** Some paths (especially salesman checks) still read from `users.permissions.canBeAssignedAsSalesman` and `users.permissions.canCreateSale`. If `role_permissions` grants `sales.create` but `users.permissions.canBeAssignedAsSalesman` is absent or false, the user may not appear in the salesman dropdown. These two systems can diverge.

5. **`deriveFromRows` uses `??` fallbacks that mask missing permissions.** For example: `canUsePos: hasPos ?? (role === 'Admin' || role === 'Manager')`. If no `pos.use` or `pos.view` row exists in `role_permissions`, Manager and Admin still get POS access. This means permission gaps in the DB table do not produce denials for senior roles.

6. **Edge Function dependency.** `createUserWithAuth` and `sendResetEmail`/`resetPassword` require deployed Edge Functions (`create-erp-user`, `user-admin-actions`). If Edge Functions are not deployed, user creation falls back to the legacy `createUser()` which creates an ERP profile without an auth account (user cannot log in).

7. **24-hour cache TTL.** Permission changes take effect for existing sessions only after cache expiry or explicit logout. There is no server-push invalidation mechanism.

---

## Recommended Standard

1. **Always pass `auth_user_id` to branch/account RPCs.** Never use `public.users.id` for `set_user_branches` or `set_user_account_access`. Resolve ambiguity with `resolvePublicUserId()` only when the public profile id is specifically required.

2. **Use `useCheckPermission()` for all JSX permission gates.** Do not read `users.permissions` JSONB directly in components. The flat boolean getters (`canEditSale`, `canAccessAccounting`) are the stable API.

3. **Call `permissionEngine.clear()` on logout.** Do not rely on TTL expiry for security-sensitive transitions.

4. **After calling `setRolePermission` or `setRolePermissionsBulk`, force-reload the affected user's session** (or instruct them to log out/in) if permission change must take effect immediately.

5. **Do not read `contacts.current_balance` or `users.permissions` for financial or access decisions.** Use the GL (`journal_entry_lines`) for balances and `role_permissions` for access.

6. **Migrate before enabling REQUIRE_RPCS_FOR_ACCESS_SETTINGS.** Ensure both `identity_model_auth_user_id.sql` and `rpc_user_branches_accounts_auth_id_only.sql` are applied before deploying to production.
