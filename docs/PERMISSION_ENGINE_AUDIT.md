# Permission Engine Audit & Hardening Report

**Date:** 2025-03-04  
**Scope:** Web ERP + Mobile ERP, role_permissions as single source of truth.

---

## 1. Module Map (Phase 1)

### role_permissions modules (DB)

| Module    | Actions |
|----------|---------|
| sales     | view_own, view_branch, view_company, create, edit, delete |
| pos       | view, use |
| purchase  | view, create, edit, delete |
| studio    | view, create, edit, delete |
| rentals   | view, create, edit, delete |
| payments  | receive, edit, delete |
| ledger    | view_customer, view_supplier, view_full_accounting |
| inventory | view, adjust, transfer |
| contacts  | view, edit |
| reports   | view |
| users     | create, edit, delete, assign_permissions |
| settings  | modify |

### Web (checkPermission / Sidebar)

| UI Label     | PermissionModule | UserPermissions flag(s)        | role_permissions source |
|-------------|------------------|-------------------------------|--------------------------|
| Dashboard   | —                | — (always visible)            | — |
| Contacts    | contacts         | canViewContacts               | contacts.view |
| Products    | products         | canManageProducts             | inventory.view |
| Inventory   | inventory        | canManageProducts             | inventory.view |
| Purchases   | purchases        | canManagePurchases, canEditPurchase, canDeletePurchase | purchase.* |
| Sales       | sales            | canViewSale, canCreateSale, canEditSale, canDeleteSale | sales.* |
| Rentals     | rentals          | canManageRentals              | rentals.* |
| POS         | pos              | canUsePos                     | pos.view, pos.use |
| Studio      | studio           | canAccessStudio               | studio.* |
| Expenses    | expenses         | canManageExpenses             | payments.receive |
| Accounting  | accounting       | canAccessAccounting           | ledger.* |
| Reports     | reports          | canViewReports                | reports.view |
| ERP Permissions / Settings | settings | canManageSettings | settings.modify |
| Users       | users            | canManageUsers                | users.* |

### Mobile (permissionModules.ts)

| Screen     | role_permissions module | Note |
|------------|-------------------------|------|
| sales      | sales                   | 1:1 |
| purchase   | purchase                | 1:1 |
| rental     | rentals                 | 1:1 |
| studio     | studio                  | 1:1 |
| accounts   | ledger                  | Map |
| expense    | payments                | No expenses module in DB |
| products   | inventory               | Map |
| inventory  | inventory               | 1:1 |
| contacts   | contacts                | 1:1 |
| reports    | reports                 | 1:1 |
| settings   | settings                | 1:1 |
| dashboard  | reports                 | Uses reports permission |
| home       | reports                 | Grid filtered by permissions |

### Code alignment

- **role_permissions:** lowercase, singular (purchase, sales, ledger, inventory, contacts, reports, users, settings, payments, pos, studio, rentals).
- **Web PermissionModule:** sales, purchases (plural), pos, studio, rentals, reports, settings, users, accounting (= ledger), payments, expenses (= payments.receive), products (= inventory.view), contacts, inventory (= inventory.view).
- **Mobile:** Same module codes as DB where 1:1; expense→payments, products→inventory, accounts→ledger.

---

## 2. Mismatches found and fixed

| # | Mismatch | Fix |
|---|----------|-----|
| 1 | Web: Contacts, Products, Inventory, Expenses had no permission gate (always visible). | Sidebar/MobileNavDrawer: isHidden from canViewContacts, canManageProducts, canManageExpenses. |
| 2 | Web: settings, users, accounting (ledger), contacts, inventory, payments, expenses not derived from role_permissions; only users.permissions/role default. | SettingsContext: all flags above now derived from getRolePermissions(engineRole). |
| 3 | Web: no isPermissionLoaded guard; nav could render before permissions loaded. | SettingsContext: added isPermissionLoaded = !loading. Sidebar/MobileNavDrawer: when !isPermissionLoaded show only Dashboard. |
| 4 | Web: canEditPurchase / canDeletePurchase not from role_permissions. | SettingsContext: hasPurchaseEdit, hasPurchaseDelete from role_permissions; set canEditPurchase, canDeletePurchase when hasPurchase. |
| 5 | checkPermission had no 'contacts' or 'inventory' cases. | Added PermissionModule 'contacts', 'inventory'; added canViewContacts; contacts view/edit and inventory view (canManageProducts). |

---

## 3. Hardening rules applied

- **RULE 1 – All modules from role_permissions:** Web now derives sales, purchase, pos, studio, rentals, reports, ledger, inventory, contacts, users, settings, payments from role_permissions. No module depends only on users.permissions JSON.
- **RULE 2 – Sales view:** view = canViewSale (view_own | view_branch | view_company) OR canCreateSale OR canEditSale OR canDeleteSale OR canCancelSale. Implemented in checkPermission and SettingsContext.
- **RULE 3 – Mobile same module codes:** Mobile uses permissionModules.ts mapping (sales, purchase, rentals, studio, ledger, payments, inventory, contacts, reports, settings). No duplicate logic; hasPermission(code) uses same role_permissions fetch.
- **RULE 4 – Dashboard KPIs:** Data comes from SalesContext/PurchaseContext/ExpenseContext; RLS filters at DB. view_own users only get rows allowed by RLS. No frontend override; no company totals exposed to view_own-only by this layer.
- **RULE 5 – isPermissionLoaded guard:** isPermissionLoaded exposed from SettingsContext; Sidebar and MobileNavDrawer show only Dashboard until isPermissionLoaded.

---

## 4. Validation matrix (Phase 5)

Engine roles: owner, admin, manager, user (salesman → user).

### Allowed modules by role (from seed)

| Module     | owner | admin | manager | user |
|-----------|-------|-------|---------|------|
| sales     | ✓     | ✓     | ✓       | ✓ (view_own, create, edit) |
| purchase  | ✓     | ✓     | ✓       | ✓ (view, create) |
| pos       | ✓     | ✓     | ✓       | ✓ |
| studio    | ✓     | ✓     | ✓       | ✓ (view, create) |
| rentals   | ✓     | ✓     | ✓       | ✓ (view, create) |
| reports   | ✓     | ✓     | ✓       | user: ✗ |
| ledger    | ✓     | ✓     | manager: limited | user: view_customer only |
| inventory | ✓     | ✓     | ✓       | ✓ (view) |
| contacts  | ✓     | ✓     | ✓       | ✓ |
| users     | ✓     | ✓     | ✗       | ✗ |
| settings  | ✓     | ✓     | ✗       | ✗ |
| payments  | ✓     | ✓     | ✓       | receive only |

### Denied (user role)

- reports.view
- users.*
- settings.modify
- ledger.view_full_accounting, view_supplier (user has view_customer only)
- purchase.delete, studio.delete, rentals.delete (per seed)

UI and API alignment: Sidebar/ModuleGrid visibility and API access both follow role_permissions; RLS enforces at DB.

---

## 5. Fixes applied (summary)

1. **SettingsContext:** Derive from role_permissions: ledger→canAccessAccounting, inventory→canManageProducts, contacts→canViewContacts, users→canManageUsers, settings→canManageSettings, payments→canReceivePayments/canMakePayments, canManageExpenses←payments.receive, purchase edit/delete→canEditPurchase/canDeletePurchase. Added isPermissionLoaded = !loading.
2. **checkPermission:** Added contacts, inventory; added canViewContacts; sales view = canViewSale || create || edit || delete || cancel.
3. **useCheckPermission:** Exposed canViewContacts, canManageProducts, canManageExpenses.
4. **Sidebar / MobileNavDrawer:** Contacts, Products, Inventory, Expenses gated by permission; visibleNavItems/visibleItems show only Dashboard when !isPermissionLoaded.
5. **Mobile:** Already using same role_permissions and module codes; Sales in ModuleGrid (done earlier). No further duplicate logic.

---

## 6. Confirmation

| Check            | Status |
|------------------|--------|
| Web synced       | ✓ All nav modules derived from role_permissions; isPermissionLoaded guard. |
| Mobile synced    | ✓ Same role_permissions and module mapping; hasPermission(code). |
| RLS intact       | ✓ No RLS removed or relaxed. |
| No fallback allow| ✓ No generic allow when permission missing. |
| Production safe  | ✓ Single source of truth (role_permissions); no hardcoded module exceptions; no duplicated permission logic. |

---

*End of audit report.*
