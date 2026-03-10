# TopHeader Component — Analysis & Documentation

**File:** `src/app/components/layout/TopHeader.tsx`  
**React component:** `TopHeader`  
**Role:** Global app header bar (sticky) for DIN COUTURE ERP.

---

## 1. DOM & Layout Summary

| Property | Value |
|----------|--------|
| **HTML element** | `<header class="h-14 md:h-16 ... sticky top-0 z-50 ...">` |
| **Typical position** | `top: 0`, `left: ~260px` (when sidebar is open) |
| **Dimensions** | Height: 56px (mobile) / 64px (md+); width: flexible (e.g. ~1030px content area) |
| **DOM path (example)** | `div#root > div.flex.min-h-screen... > div.flex-1... > header...` |

The header is the **first child** of the main content wrapper; the sidebar is a sibling to that wrapper. So the header spans the **content area** only, not the full viewport width when the sidebar is visible.

---

## 2. Structure (Three Zones)

The header is a flex row with **three logical sections**:

```
[ LEFT SECTION ]     [ CENTER (flex-1) ]     [ RIGHT SECTION ]
```

### 2.1 Left section

- **Mobile menu (lg:hidden)**  
  - Button with `Menu` icon.  
  - `onClick` → `setMobileNavOpen(true)` (opens full nav drawer).  
  - Visible only on small screens.

- **Branch / location selector**  
  - **Visibility rule (global):** Rendered only when `!loadingBranches && branches.length > 1`.  
  - Single branch → no branch UI; default branch is used.  
  - Multi-branch → dropdown with “All Branches” + list of branches (name + address/city).  
  - Uses `branchService.getBranchesCached(companyId)`.  
  - On change: `setBranchId(branchId)`, toast “Branch switched successfully”, then `window.location.reload()`.  
  - Desktop only: `hidden lg:flex` on the trigger button.

- **Loading state**  
  - When `loadingBranches` is true, a small loader is shown instead of the branch dropdown (desktop).

### 2.2 Center section

- Empty `<div className="flex-1">` used for layout balance so the right section stays at the end.

### 2.3 Right section (actions)

Items here (order left → right):

1. **Create New** (dropdown)  
   - Primary blue gradient button; label “Create New” hidden on very small screens (`hidden sm:inline`).  
   - Quick actions: New Invoice, New Purchase, Add Product, Add Contact (via `openDrawer(...)`).

2. **Date range** (dropdown)  
   - Hidden on small screens: `hidden sm:flex`.  
   - Label from `getDateRangeLabel()` (e.g. “Today”, “Last 7 Days”, “This Month”, “Custom Range”).  
   - Options: From start, Today, Last 7/15/30 Days, This Week, This Month, Custom Range.  
   - Custom range opens an overlay with start/end date pickers; uses `DateRangeContext` (`setDateRangeType`, `setCustomDateRange`).

3. **Notifications** (dropdown)  
   - Bell icon; badge with count when `notificationCount > 0`.  
   - Count = unpaid sales (invoice + due > 0) + unpaid purchases (due > 0) + pending expenses.  
   - List shows up to 10 items (mix of receivables, payables, expenses); click navigates to Sales/Purchases/Expenses and closes dropdown.

4. **User profile** (dropdown)  
   - Avatar (initial in gradient circle) + on xl: user name and “Super Admin” (role).  
   - Dropdown: user block (name, email), View Profile, Settings, Change Password, Logout.  
   - View Profile opens `UserProfilePage` in a portal overlay.  
   - Settings → `setCurrentView('settings')`.  
   - Logout → `signOut()`, toast, then `window.location.reload()`.

---

## 3. Context & Data Dependencies

| Source | Usage |
|--------|--------|
| **NavigationContext** | `toggleSidebar`, `openDrawer`, `setCurrentView`, `setMobileNavOpen` |
| **SupabaseContext** | `signOut`, `user`, `companyId`, `branchId`, `defaultBranchId`, `setBranchId` |
| **DateRangeContext** | `dateRange`, `setDateRangeType`, `setCustomDateRange` |
| **SalesContext** | Unpaid invoices for notifications + count |
| **PurchaseContext** | Unpaid purchases for notifications + count |
| **ExpenseContext** | Pending expenses for notifications + count |
| **branchService** | `getBranchesCached(companyId)` for branch list |
| **useFormatCurrency** | Notification message formatting |

---

## 4. State (local)

| State | Purpose |
|-------|--------|
| `branches` | List of branches for dropdown (from `getBranchesCached`) |
| `loadingBranches` | Loading flag for branch fetch |
| `showNotifications` | Open/close notifications dropdown |
| `showCustomDatePicker` | Open/close custom date range overlay |
| `showProfile` | Open/close user profile modal (portal) |
| `showChangePassword` | Open/close change-password dialog |

---

## 5. Key Behaviours

- **Single branch:** Branch selector is not rendered; `branchId` is auto-set to that branch when `branches.length === 1` and `branchId` is unset or `'all'`.
- **Branch change:** Updates context and reloads the page so all data reflects the new branch.
- **Date range:** Stored in DateRangeContext; label in header reflects current type or custom range.
- **Notifications:** Read-only list; clicking an item navigates to the relevant module and closes the dropdown.
- **Modals/dialogs:** User profile and custom date picker are overlays; change password uses `ChangePasswordDialog`.

---

## 6. Responsive & Visibility

| Element | Visibility |
|--------|------------|
| Mobile menu button | `lg:hidden` (only when sidebar is collapsed / mobile) |
| Branch selector | `hidden lg:flex` (desktop only when multi-branch) |
| “Create New” label | `hidden sm:inline` (icon only on very small) |
| Date range button | `hidden sm:flex` (hidden on smallest screens) |
| User name/role in profile trigger | `hidden xl:flex` (only on xl screens) |

Header height: `h-14` (56px) on mobile, `md:h-16` (64px) on md and up.

---

## 7. Styling (main classes)

- **Header:** `h-14 md:h-16 bg-gray-900/95 backdrop-blur-md border-b border-gray-800 flex items-center justify-between px-4 md:px-6 sticky top-0 z-50 shadow-sm`
- **Right section:** `flex items-center gap-2 md:gap-3`
- Buttons use `accent`/`muted` and `border-border` for consistency with the app theme.

---

## 8. Related Files

- **Branch visibility rule:** `docs/ACCOUNTING_UX_RESTRUCTURE.md` (§9)
- **Branch list cache:** `src/app/services/branchService.ts` (`getBranchesCached`, `clearBranchCache`)
- **Context:** `src/app/context/SupabaseContext.tsx`, `NavigationContext.tsx`, `DateRangeContext.tsx`
- **UI primitives:** `components/ui/dropdown-menu`, `button`, `badge`, `DatePicker`, `Label`
- **Overlays:** `UserProfilePage`, `ChangePasswordDialog`

---

## 9. Quick Reference (what appears in the header)

From left to right:

1. **Mobile:** Menu button.  
2. **Desktop, multi-branch:** Branch/location dropdown (or loader while branches load).  
3. **Spacer.**  
4. Create New → Quick actions.  
5. Date range (e.g. “Today”) → Presets + Custom.  
6. Notifications (bell + optional count).  
7. User avatar + name/role → Profile, Settings, Change password, Logout.

Single-branch companies do not see any branch selector in the header; the rest of the layout is unchanged.
