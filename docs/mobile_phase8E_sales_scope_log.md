# Mobile Phase 8E — Enterprise RBAC & Data Isolation Polish (Deployment Log)

**Date:** 2026-05-25  
**Scope:** `erp-mobile-app` only — koi DB migration nahi.

## Masle the

1. **"All Branches" = poori company:** Restricted user / worker jab All Branches select karta tha to company-wide sales/expenses aa rahi thin, jab ke sirf assigned branches dikhni chahiye thin.
2. **Counter worker 0 invoices:** Phase 8D ke baad salesman unlock par Sales list khali — `enrichRowsWithCreatorNames` UUID ko object se replace kar deta tha, worker filter fail ho jata tha.
3. **branchIds pollution:** `getUserAccessibleBranches` company ki saari branches merge kar deta tha — worker ke liye galat scope.
4. **Admin identity leak:** Sidebar/header Settings mein admin ka naam/email dikhta tha jab counter worker active ho.
5. **Sales attribution:** POS/create sale admin `user_id` se save ho rahi thin; worker ko apni sale list mein nahi milti thin.
6. **branchResolution expansion:** 2/5 assigned branches ko 5/5 company branches mein expand kar deta tha.

## Kya fix hua (Phase 8E polish)

| Fix | Badlav |
|-----|--------|
| `useEffectiveWorkerProfile()` | `CounterWorkerContext.tsx` — composite hook; Sidebar, Home, Settings, BranchSelection |
| Permission reload race | `App.tsx` — session reload skip jab worker active |
| Sales attribution | `recordSalePayment` explicit `userId` pehle; `SalesHome` mutations `effectiveUserId`; `SalesModule` branch hooks |
| Shared counter login | Login par POS lock skip band jab enrolled workers hon |
| `branchResolution.ts` | Restricted users: sirf assigned IDs, kabhi expand nahi |
| Branch ID sources | `BranchSelection`, `App`, `useWriteBranchSelection` → `getUserAssignedBranchIds` |
| `resolveModuleListBranchScope` | `listBranchScope.ts` + `resolveCounterListBranchScope` wrapper |
| Inventory scope | `InventoryModule.tsx` + `inventory.ts` accessible-branch filter |
| Expense add picker | Sirf assigned branches jab All Branches selected |

## Pehle wale fixes (same phase, list scope)

| Fix | Badlav |
|-----|--------|
| `created_by_id` preserve | `resolveCreatorName.ts` — enrich se pehle UUID save; display ke liye `created_by` object rehta hai |
| Worker filter | `counterDataIsolation.ts` — pehle `created_by_id`, phir string `created_by` check |
| Branch scope helper | `listBranchScope.ts` — `resolveListBranchScope` + `rowInListBranchScope` |
| Permission branchIds | Restricted users: `getUserAssignedBranchIds` (direct `user_branches`); Admin/Owner: purana behavior |
| Sales list | `SalesHome.tsx` — accessible-branch filter + worker filter pipeline; stats scoped rows se |
| API fetch | `sales.ts` / `expenses.ts` — optional `.in('branch_id', accessibleBranchIds)` |
| Expense list | `ExpenseModule.tsx` — wahi branch scope + worker filter |
| Pending sales | `offlinePendingList.ts` — accessible branch filter support |

## Branch scope rules

| Selection | Admin/Owner | Result |
|-----------|-------------|--------|
| Specific branch | koi bhi (access ke sath) | sirf woh branch |
| All Branches | Admin/Owner | poori company (no client branch filter) |
| All Branches | Restricted / worker | sirf `accessibleBranchIds` wali rows |

## Tablet par verify

1. **Admin + All Branches** → saari company sales (pehle jaisa).
2. **Worker + 2 branches access + All Branches** → sirf un 2 branches ki apni sales/expenses/inventory.
3. **Worker + specific branch** → us branch ki apni entries.
4. **Salesman counter unlock** → sidebar par worker naam/role; apni sales list mein dikhen.
5. **POS sale create** → `Created by: {worker}`; payment bhi worker id se.
6. **Branch dropdown (restricted)** → sirf assigned branches.

## Build

```bash
npm run typecheck:mobile
```

**Result:** PASS

## Files

- `CounterWorkerContext.tsx`, `App.tsx`, `TabletSidebar.tsx`, `HomeScreen.tsx`, `SettingsModule.tsx`, `BranchSelection.tsx`
- `sales.ts`, `SalesHome.tsx`, `SalesModule.tsx`
- `branchResolution.ts`, `listBranchScope.ts`, `counterDataIsolation.ts`, `useWriteBranchSelection.ts`
- `ExpenseModule.tsx`, `InventoryModule.tsx`, `inventory.ts`
- `resolveCreatorName.ts`, `permissions.ts`, `PermissionContext.tsx`, `expenses.ts`, `offlinePendingList.ts`
