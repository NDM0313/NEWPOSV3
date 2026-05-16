# Permission system inventory

Single reference for **data sources**, **read/write paths**, **UI entry points**, **mobile parity**, and **delete candidates** (detailed sign-off list: `docs/PERMISSION_DELETE_CANDIDATES.md`).

## Source of truth (Postgres)

| Artifact | Purpose | RLS / notes |
|----------|---------|-------------|
| `public.role_permissions` | Engine: `(role, module, action) → allowed` for `owner` \| `admin` \| `manager` \| `user` | `role_permissions_select_authenticated` (SELECT for authenticated); `role_permissions_admin_all` (ALL for authenticated) in `migrations/erp_permission_engine_v1.sql` and replica seed. **Upsert requires authenticated session** with policy allowing write (same as web when using Supabase anon + logged-in user JWT). |
| `public.user_branches` | Branch scope for non–owner/admin users | Consumed by web + mobile for branch pickers / `hasBranchAccess`. |
| `public.users` (role, company, etc.) | App role string → mapped to engine role | Drives which `role_permissions` rows apply. |

## Web ERP — read path (runtime checks)

| Step | Location | Notes |
|------|----------|--------|
| Load `role_permissions` | `src/app/services/permissionService.ts` | `getRolePermissions`, `setRolePermission` (writes). |
| Cache + derive `UserPermissions` | `src/app/services/permissionEngine.ts` | `loadPermissions` → `deriveFromRows` → shape consumed by `checkPermission`. **Invalidation:** `setRolePermission` / bulk in `permissionService.ts` calls `permissionEngine.invalidateForRole(role)`. |
| Session context | `src/app/context/SettingsContext.tsx` (~720–827) | On settings load: maps `userData.role` → `EngineRole` + UI `Admin` \| `Manager` \| `Staff`, then `permissionEngine.loadPermissions(userId, companyId, engineRole, role)` overlays flags into `currentUser`. **No read** of `settings` key `user_permissions` on this path. |
| UI checks | `src/app/utils/checkPermission.ts` + `useCheckPermission.ts` | **ACTIVE PERMISSION ENGINE – DO NOT MODIFY** without tests and explicit approval. Admin bypass: `permissions.role === 'Admin'` → full allow in `checkPermission`. |

## Web ERP — write path (`role_permissions`)

| Writer | Location |
|--------|----------|
| Matrix / bulk saves | `src/app/components/erp-permissions/MatrixTab.tsx` → `permissionService.setRolePermission` / bulk |
| Legacy panels (same service) | `UserPermissionsTab.tsx`, `PermissionManagementPanel.tsx` (not routed — see delete doc) |
| Inspector / tooling | `PermissionInspectorPage.tsx` (diagnostic) |

## `settings.user_permissions` vs permission engine

| Aspect | Detail |
|--------|--------|
| **Write** | `SettingsContext.updatePermissions` → `settingsService.setSetting(companyId, 'user_permissions', updated, ...)` (`src/app/context/SettingsContext.tsx`). |
| **Read in `src/`** | **None** for `user_permissions` on the main load path; grep shows only the write above (plus markdown docs). |
| **Who calls `updatePermissions`?** | `SettingsPageComplete.tsx` only (legacy settings UI). |
| **Verdict** | **Legacy / parallel store:** may still persist JSON for old flows but **does not drive** `permissionEngine` or `checkPermission`. Runtime flags come from **`role_permissions` → permissionEngine → SettingsContext `currentUser`**. |

## Web UI entry map

| UI | File | Route / entry |
|----|------|----------------|
| **Access → Roles & Permissions** (product) | `SettingsPageNew.tsx` | Embedded `ErpPermissionArchitecturePage` when Access content shows roles/permissions area. |
| **Nav: Roles** | `App.tsx` `currentView === 'roles'` | `ErpPermissionArchitecturePage` |
| **Nav: erp-permissions** | `App.tsx` `currentView === 'erp-permissions'` | Same page |
| **Users list** (operational) | `SettingsPageNew` `contentKey === 'users'` | Branches, activate user — **not** the full matrix. |
| **Permission Inspector** | `PermissionInspectorPage.tsx` | `/admin/permission-inspector` or `currentView === 'permission-inspector'` — **admin/diagnostic**. |

## Mobile ERP — parity

| Concern | Location | Notes |
|---------|----------|--------|
| Read `role_permissions` + `user_branches` | `erp-mobile-app/src/api/permissions.ts`, `PermissionContext.tsx` | Gated by `FEATURE_MOBILE_PERMISSION_V2` (default on unless localStorage disables). |
| Matrix helpers | `hasModuleAction`, `canViewModule` in `permissions.ts` | Should stay aligned with web visibility semantics (scoped `view_*` for contacts/studio, etc.). |
| Write `role_permissions` | `setRolePermission` in `permissions.ts` | Same table as web; **RLS** same as web authenticated client. |
| **Safe product scope (implemented)** | `UserPermissionsScreen.tsx` + `FEATURE_MOBILE_ROLE_MATRIX_EDITOR` | Admin/owner may edit **only** `manager` and `user` engine roles on mobile; **owner/admin** engine rows are **not** editable from mobile (`setRolePermission` guard). Opt-in: `localStorage.setItem('erp_mobile_feature_role_matrix_editor', 'true')` then reload (see `featureFlags.ts`). |
| Cache after save | `UserPermissionsScreen` | After successful toggle: refetch matrix for `editRole`; if edited role matches signed-in engine role, `reload(...)` on `PermissionContext`. |

## Delete candidate column (summary)

| Item | Delete candidate? |
|------|-------------------|
| `ErpPermissionArchitecturePage` | **N** — primary product UI. |
| `PermissionInspectorPage` | **N** — keep; gate by admin/dev route. |
| `UserPermissionsTab`, `PermissionManagementPanel` | **Y (pending sign-off)** — no imports from `SettingsPageNew` / `App.tsx`; duplicate matrix writers. See `docs/PERMISSION_DELETE_CANDIDATES.md`. |
| `settings.user_permissions` writes | **TBD** — deprecate after confirming `SettingsPageComplete` unused or migrated. |

## Related docs

- `docs/PERMISSION_DELETE_CANDIDATES.md` — approval checklist for removals.
- `docs/PERMISSION_ENGINE_AUDIT.md`, `docs/PERMISSION_ALIGNMENT_AUDIT.md` — historical audits.
