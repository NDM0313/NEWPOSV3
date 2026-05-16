# Permission UI / store — delete & consolidation candidates

**Status:** Awaiting explicit **sign-off** before deleting files or dropping DB columns. This list is derived from route/import analysis (see `docs/PERMISSION_SYSTEM_INVENTORY.md`).

## High confidence — duplicate matrix UIs (unused in router)

| Candidate | Path | Evidence | Recommendation |
|-----------|------|----------|----------------|
| **UserPermissionsTab** | `src/app/components/settings/UserPermissionsTab.tsx` | **Not** imported by `SettingsPageNew.tsx` or `App.tsx`. Comment references in `RolesDashboard.tsx` / docs only. | **Remove after sign-off**, or re-link only if product wants a second matrix entry (not recommended). |
| **PermissionManagementPanel** | `src/app/components/settings/PermissionManagementPanel.tsx` | Same — no router/settings parent import. | **Remove after sign-off**; functionality superseded by `ErpPermissionArchitecturePage` / `MatrixTab`. |

## Keep — diagnostics / product

| Item | Reason |
|------|--------|
| `ErpPermissionArchitecturePage` | Canonical web matrix + roles + branch tooling. |
| `PermissionInspectorPage` | `/admin/permission-inspector` — diagnostics; keep behind admin. |
| `permissionService` / `permissionEngine` | Core engine; `invalidateForRole` already wired on `setRolePermission`. |

## Legacy settings store

| Candidate | Path | Risk |
|-----------|------|------|
| `updatePermissions` + `user_permissions` setting | `SettingsContext.tsx`, consumer `SettingsPageComplete.tsx` | Low read usage on main path; removing write without migrating any remaining UI could strand one old screen. **Sign-off:** confirm no production use of `SettingsPageComplete` for permissions. |

## Consolidation (optional, not delete)

| Idea | Detail |
|------|--------|
| Developer menu | Link `PermissionInspectorPage` only from Developer/Admin nav to avoid duplicate “permission” names in normal Settings copy. |
| Docs sweep | Several `docs/*.md` still mention `UserPermissionsTab` / `PermissionManagementPanel` as active; update after code removal. |

## Sign-off block (copy for PR / ticket)

- [ ] Confirmed no deep links or bookmarks to old settings tabs that mount `UserPermissionsTab` / `PermissionManagementPanel`.
- [ ] Confirmed `SettingsPageComplete` permission form not used in production.
- [ ] Stakeholder OK to remove duplicate files and adjust `RolesDashboard` comments.
