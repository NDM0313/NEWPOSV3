# Master Permission Unification + Worker Support — Final Report

**Date:** 2025-03-05  
**Task:** PART 1 — Contacts worker type; PART 2 — Web/Mobile same permission engine; PART 3 — Validation.

---

## 1. SQL to Execute

Run the following migration on your Supabase project (SQL Editor or your migration runner):

**File:** `migrations/contacts_worker_type_and_permissions.sql`

- Adds `worker` to `contact_type` enum if the enum exists and the value is missing.
- Inserts `contacts.create` and `contacts.delete` into `role_permissions` for owner, admin, manager, user (ON CONFLICT DO NOTHING).

**How to run:**
- **Option A:** Supabase Dashboard → SQL Editor → paste contents of `migrations/contacts_worker_type_and_permissions.sql` → Run.
- **Option B:** If you run root `migrations/` via a script, add this file to the list and run it.

---

## 2. Files Modified

### 2.1 New files
| File | Purpose |
|------|---------|
| `migrations/contacts_worker_type_and_permissions.sql` | contact_type + worker; role_permissions contacts create/delete |
| `docs/PERMISSION_UNIFICATION_AND_WORKER_FINAL_REPORT.md` | This report |

### 2.2 Web (src/)
| File | Change |
|------|--------|
| `src/app/services/permissionService.ts` | `contacts`: added `create`, `delete` to MODULES_ACTIONS |
| `src/app/services/contactService.ts` | Contact type: added `'worker'` to union |
| `src/app/utils/checkPermission.ts` | UserPermissions: `canCreateContact`, `canDeleteContact`; contacts case: view/edit/create/delete |
| `src/app/context/SettingsContext.tsx` | UserPermissions: `canCreateContact`, `canDeleteContact`; derive from role_permissions contacts.create/delete |
| `src/app/hooks/useCheckPermission.ts` | Added `hasPermission(code: string)` — same API as Mobile |
| `src/app/components/layout/Sidebar.tsx` | All nav visibility: `hasPermission('studio.view')`, `hasPermission('pos.view')`, `hasPermission('contacts.view')`, etc. (no canAccessStudio/canUsePos) |
| `src/app/components/layout/MobileNavDrawer.tsx` | Same: `hasPermission('studio.view')`, `hasPermission('pos.view')`, etc. |
| `src/app/components/layout/BottomNav.tsx` | POS: `hasPermission('pos.view')` |
| `src/app/components/dashboard/Dashboard.tsx` | Sales/Purchases/Products/POS: `hasPermission('sales.view')`, `hasPermission('purchases.view')`, `hasPermission('products.view')`, `hasPermission('pos.view')` |

### 2.3 Mobile (erp-mobile-app)
- **No code changes.** Mobile already uses `hasPermission('studio.view')`, `hasPermission('contacts.view')`, and Contacts already has Workers filter (all, customer, supplier, worker) and worker stats.

---

## 3. Web + Mobile Consistency

| Check | Status |
|-------|--------|
| Same permission engine | Yes — both use `role_permissions` table |
| Same API at call site | Yes — Web and Mobile both use `hasPermission('studio.view')`, `hasPermission('pos.view')`, etc. |
| Studio visibility | Web: `hasPermission('studio.view')`; Mobile: `hasPermission('studio.view')` |
| POS visibility | Web: `hasPermission('pos.view')`; Mobile: `hasPermission('pos.view')` (and screen guard) |
| No duplicate engine | Yes — no separate mobile-only permission system |
| No canAccessStudio/canUsePos at nav | Yes — Sidebar/MobileNavDrawer/BottomNav/Dashboard use only `hasPermission()` |

---

## 4. Worker Visible

| Layer | Status |
|-------|--------|
| DB | `contact_type` enum: add `worker` via migration above (if enum exists) |
| role_permissions | contacts: view, create, edit, delete (worker is a contact type, no separate module) |
| Web Contacts | ContactsPage: tabs All, Customers, Suppliers, **Workers**; filter by type; worker count in tabCounts |
| Mobile Contacts | ContactsModule: filter buttons all, customer, supplier, **worker**; stats.workers; list shows worker contacts |

---

## 5. No Duplicate Permission Engines

- **Single source of truth:** `public.role_permissions` (role, module, action, allowed).
- **Web:** SettingsContext loads role_permissions → derives UserPermissions; components use `hasPermission('module.action')` from `useCheckPermission()`, which calls `checkPermission(currentUser, module, action)`.
- **Mobile:** PermissionContext loads role_permissions; components use `hasPermission('module.action')` from `usePermissions()`.
- No second permission system; no device-based toggle; RBAC is role-based, same on web and mobile.

---

## 6. Validation Checklist

After running the SQL:

1. **Test user with only studio.view**  
   - Give a role (e.g. manager) only `studio.view` (and required modules if any).  
   - Web: Studio Production should show in sidebar.  
   - Mobile: Studio should show on home and be accessible.

2. **Remove studio.view**  
   - Remove or deny `studio.view` for that role.  
   - Web: Studio Production should be hidden.  
   - Mobile: Studio should be hidden.

3. **Worker in Contacts**  
   - Create or open a contact with type **worker**.  
   - Web: Workers tab shows count and list.  
   - Mobile: Worker filter and worker list work.

---

## 7. Summary

- **SQL:** Run `migrations/contacts_worker_type_and_permissions.sql` on Supabase.
- **Web:** Nav and dashboard use `hasPermission('studio.view')`, `hasPermission('pos.view')`, etc.; Contacts has Workers tab and worker type support; contacts create/delete from role_permissions.
- **Mobile:** Already aligned; Workers filter and worker type present.
- **Consistency:** Single permission engine; same keys and same `hasPermission()` usage on both platforms.

---

*End of report.*
