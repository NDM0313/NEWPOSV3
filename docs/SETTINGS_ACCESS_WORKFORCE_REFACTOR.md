# Settings & Access Control Refactor Summary

## Old structure (before)

### Main sidebar
- Dashboard, Contacts, Products, Inventory, Purchases, Sales, Rentals, POS, Studio, Expenses, Accounting, Reports  
- **ERP Permissions** (standalone)  
- **Permission Inspector** (standalone)  
- Settings  

### Settings page (flat list)
- Company Info  
- Branch Management  
- POS Settings  
- Sales Settings  
- Purchase Settings  
- Inventory Settings  
- Rental Settings  
- Accounting Settings  
- Default Accounts  
- Numbering Rules  
- Printer Configuration  
- Invoice Templates  
- **User Management**  
- **Employees**  
- Module Toggles  
- Lead Tools  
- System Health (admin)  
- Data & Backup  

**Problems:** ERP Permissions and Permission Inspector in main nav; User Management vs Employees vs Permissions scattered; no clear Access vs Workforce grouping.

---

## New structure (after)

### Main sidebar
- Dashboard, Contacts, Products, Inventory, Purchases, Sales, Rentals, POS, Studio, Expenses, Accounting, Reports  
- **Settings** (single entry)  
- **Developer Tools** (admin only), expandable:  
  - **Permission Inspector**  
  - Test Pages (existing test links)  

**Removed from main nav:** ERP Permissions, Permission Inspector as top-level items.

### Settings page (grouped)

**Settings**
- Company Info  
- Branch Management  
- POS Settings  
- Sales Settings  
- Purchase Settings  
- Inventory Settings  
- Rental Settings  
- Accounting Settings  
- Default Accounts  
- Numbering Rules  
- Printer Configuration  
- Invoice Templates  
- Lead Tools  

**Access Control**
- **Users** (renamed from User Management; table: User, Role, Branches, Email, Status, Actions)  
- **Roles & Permissions** (merged ERP Permission Architecture + Matrix; same engine, no DB change)  

**Workforce**
- **Employees** (unchanged; payroll, salary, optional link to user)  

**System**
- Module Toggles  
- System Health (admin)  
- Data & Backup  

---

## Pages merged / removed

| Old | New | Notes |
|-----|-----|--------|
| User Management | **Users** (under Access Control) | Renamed; added Branches column; same Add/Edit user flow |
| ERP Permissions (main nav) | **Roles & Permissions** (Settings → Access Control) | Moved into Settings; same ErpPermissionArchitecturePage |
| Permission Management | Removed (previously removed) | Replaced by Roles & Permissions |
| User Permissions | Removed (previously removed) | Replaced by Users + Roles & Permissions |
| Permission Inspector (main nav) | **Developer Tools → Permission Inspector** | Admin-only; not in normal settings |

---

## What stayed the same

- **Permission engine:** `role_permissions`, `user_branches`, `has_permission()`, `checkPermission()`, `useCheckPermission()` unchanged.  
- **Employees:** Still under Workforce; payroll/salary; optional link to user account (Employee ≠ User).  
- **All modules** still use the same permission engine; only UI and navigation were restructured.

---

## Design rule: User ≠ Employee

- **User** = login and access (role, branches, permissions).  
- **Employee** = workforce record (salary, commission, payroll).  
- An employee can optionally be linked to a system user (e.g. Arslan → salesman).

---

## Files changed

- `src/app/components/layout/Sidebar.tsx` – Removed ERP Permissions & Permission Inspector from main nav; added Developer Tools group with Permission Inspector.  
- `src/app/components/settings/SettingsPageNew.tsx` – Grouped tabs (Settings, Access Control, Workforce, System); added Roles & Permissions tab (ErpPermissionArchitecturePage); renamed User Management → Users; added Branches column; added `rolesPermissions` to SettingsTab type.

No changes to the underlying permission engine or RLS.
