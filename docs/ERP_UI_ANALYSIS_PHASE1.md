# ERP UI — Phase 1: Full Analysis Report

**Scope:** `src/app` (components, layout, settings, users). Analysis only; no code changes.

---

## 1. Folder structure (high level)

- **components/** — 347+ TSX files
  - **layout/** — Sidebar, TopHeader, GlobalDrawer, BranchSelector, MobileNavDrawer
  - **settings/** — SettingsPage, SettingsPageNew, SettingsPageComplete, SettingsPageClean, PermissionManagementPanel, ModuleSettings, LeadTools, inventory/, etc.
  - **users/** — UserDashboard, AddUserModal, RolesDashboard
  - **auth/** — LoginPage, CreateBusinessWizard, ChangePasswordDialog
  - **sales/, purchases/, products/, contacts/, accounting/, inventory/, rentals/, studio/, reports/, dashboard/, payments/, transactions/, packing/, production/, branches/, demo/, test/, github/, customize/, shared/, public/**
  - **ui/** — Buttons, inputs, dialogs, cards, tables, tabs, etc.

---

## 2. Border styles

- **Thick / emphasis:** `border-2`, `border-2 border-dashed`, `border-2 border-blue-500`, `border-2 border-blue-500/30`
- **Standard:** `border`, `border border-gray-700`, `border border-gray-800`, `border-gray-800`
- **Colored accents:** `border-blue-500/30`, `border-blue-500/50`, `border-purple-500/20`, `border-purple-900/50`, `border-red-500/20`, `border-green-500/20`, `border-l border-gray-800`
- **Common:** `rounded-lg border border-gray-800`, `rounded-xl ... border border-gray-800`, cards/drawers use `border border-gray-800` or `border-gray-700`

---

## 3. Shadow styles

- **Heavy:** `shadow-2xl` (drawers, modals, panels)
- **Medium:** `shadow-lg`, `shadow-lg shadow-blue-600/20`, `shadow-lg shadow-blue-900/20`, `shadow-lg shadow-purple-900/20`, `shadow-xl`
- **Light:** `shadow-md`, `shadow-sm`
- **Custom:** `shadow-[0_-10px_40px_rgba(0,0,0,0.5)]`
- **None:** `shadow-none` (e.g. ThermalReceiptPreviewModal)

---

## 4. Padding / spacing

- **Card/content:** `p-6`, `p-8`, `p-4`, `px-6 py-4`, `px-6 py-5`, `p-3`
- **Grid/gaps:** `gap-6`, `gap-8`, `gap-4`, `gap-3`, `gap-2`
- **Vertical:** `space-y-6`, `space-y-4`, `space-y-2`, `space-y-8`
- **Settings content:** `rounded-xl p-8` (main content area), tabs `px-4 py-3`
- **Modals/drawers:** `p-6 space-y-6`, `px-6 py-4`, `p-4`

---

## 5. Border radius

- **Large:** `rounded-2xl`, `rounded-xl` (cards, content areas, modals)
- **Medium:** `rounded-lg` (inputs, buttons, small cards)
- **Small:** `rounded-md`, `rounded`

---

## 6. Color accent usage

- **Blue:** Primary CTAs, active tab (e.g. `bg-blue-600`, `text-blue-400`, `border-blue-500/30`, `bg-blue-500/10`)
- **Purple:** Secondary/studio (e.g. `bg-purple-500/10`, `border-purple-500/20`, `purple-600`)
- **Green:** Success, active (e.g. `bg-green-500/20`, `text-green-400`, `bg-green-600`)
- **Amber / Yellow:** Warnings, permission (e.g. `bg-amber-500/10`, `text-amber-400`)
- **Red:** Destructive, admin badge (e.g. `bg-red-500/20`, `text-red-400`, delete buttons)
- **Gray:** Neutrals (e.g. `bg-gray-900`, `border-gray-800`, `text-gray-400`)
- **Emerald, cyan, indigo, pink:** Used in studio/dashboard cards and secondary accents

---

## 7. Role / permission related components

- **settings/PermissionManagementPanel.tsx** — Role editor, sales visibility, payment/ledger toggles; uses `role_permissions`
- **settings/SettingsPageNew.tsx** — Tabs include Permission Management (admin/owner), System Health (admin/owner)
- **settings/SettingsPage.tsx** — System Health tab, role check `isAdminOrOwner`
- **users/AddUserModal.tsx** — Role dropdown (owner, admin, manager, staff, salesman, …), branch/account assignment, admin/owner messaging
- **users/UserDashboard.tsx** — User list, role badges
- **users/RolesDashboard.tsx** — Roles UI
- **layout/BranchSelector.tsx** — Branch selection, `isAdmin` from role
- **layout/Sidebar.tsx** — Nav; may gate by role/module
- **layout/GlobalDrawer.tsx** — Drawer; role-based styling (blue/purple/green borders)
- **auth/LoginPage.tsx**, **CreateBusinessWizard.tsx** — Auth flow
- **sales/SaleForm.tsx**, **purchases/PurchaseForm.tsx** — Use `userRole` / `isAdmin` for branch/visibility
- **test/UserManagementTestPage.tsx**, **test/RLSValidationPage.tsx** — Role/permission tests

---

## 8. Backend tables (relevant to permissions)

- **role_permissions** — (role, module, action, allowed); used by Permission Engine v1 and permissionService
- **user_branches** — (user_id = auth.uid(), branch_id, is_default); branch access
- **public.users** — has `role` (owner, admin, manager, staff, salesman, …)
- No separate `roles`, `permissions`, or `user_roles` tables; roles are distinct values in `role_permissions.role` and `users.role`.

---

## 9. Summary

| Category        | Finding |
|----------------|---------|
| **Borders**    | Mix of 1px and 2px; many `border border-gray-800` and colored accents (blue/purple/red/green). |
| **Shadows**    | Heavy use of `shadow-lg`, `shadow-xl`, `shadow-2xl` with colored shadows (e.g. shadow-blue-600/20). |
| **Radius**     | `rounded-xl` and `rounded-lg` dominant; some `rounded-2xl`. |
| **Padding**    | Cards/content often `p-6`/`p-8`; gaps `gap-6`/`gap-8`. |
| **Accents**    | Multiple accent colors (blue, purple, green, amber, red, emerald, cyan, indigo, pink). |
| **Permission UI** | PermissionManagementPanel, Settings tabs (Permission Management, System Health), AddUserModal role/branch/account, UserDashboard, RolesDashboard; backend: role_permissions, user_branches, users.role. |

No modifications were made in this phase.
