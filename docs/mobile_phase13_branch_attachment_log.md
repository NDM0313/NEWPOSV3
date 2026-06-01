# Phase 13 — Branch Picker Recovery, Purchase Isolation & Expense Attachment (Deployment Log)

**Date:** 2026-05-25  
**Scope:** Sirf `erp-mobile-app/` — koi web ya DB migration nahi.

## Masla kya tha (Phase 12 regression)

1. **BranchSelection blank** — Worker active + Admin JWT par Phase 12 ne branch picker ko worker RBAC se band kar diya; assigned branches empty → sirf "Welcome" dikhta tha, koi card nahi.
2. **Purchase leak** — Restricted worker ko doosron ki POs dikhti thin; Sales/Expense isolated thay lekin Purchase nahi.
3. **Expense attachment silent drop** — Expense save hoti thi lekin receipt attach nahi hoti; empty file par `{ url: null, error: null }` aur public URL format inconsistent tha.

## Fixes

### BranchSelection ([`BranchSelection.tsx`](../erp-mobile-app/src/components/BranchSelection.tsx))

- **JWT session role** (`user.role`) ab branch picker control karta hai — admin/owner hamesha saari company branches + All Branches dekhe.
- Worker overlay sirf welcome name ke liye; data modules (Sales/Expense/Purchase) worker scope use karte hain.
- Restricted session → `getUserAssignedBranchIds` (worker active ho to worker ids).
- **Empty-state** jab list khali ho: clear message + admin se contact.

### Purchase isolation

- [`purchases.ts`](../erp-mobile-app/src/api/purchases.ts) — `PurchaseListItem.created_by`, `created_by_id` enrich.
- [`PurchaseModule.tsx`](../erp-mobile-app/src/components/purchase/PurchaseModule.tsx) — `rowBelongsToCounterWorker` filter jab `isolateWorkerData`.

### Expense attachment

- [`storageDisplayUrl.ts`](../erp-mobile-app/src/utils/storageDisplayUrl.ts) — `expense-receipts` bucket add.
- [`expenses.ts`](../erp-mobile-app/src/api/expenses.ts) — `storageRefForPersistence`; empty file par explicit error.
- [`ExpenseModule.tsx`](../erp-mobile-app/src/components/expense/ExpenseModule.tsx) — file select + upload fail par save block (bucket missing soft-warn exception).

## Verify

```bash
npm run typecheck:mobile   # PASS
```

**Manual smoke:**

| Scenario | Expected |
|----------|----------|
| Admin tablet, worker active, Change branch | All branches + All Branches |
| Restricted worker, branch pick | Sirf assigned branch(es) |
| Worker purchase list | Sirf apni POs |
| Expense + photo | Receipt URL save |
| Upload fail (file selected) | Error; save block |
