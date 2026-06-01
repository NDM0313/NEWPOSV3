# Phase 16 — Single-Branch Auto-Select (Deployment Log)

**Date:** 2026-05-25  
**Scope:** Sirf `erp-mobile-app/` — koi web ya DB migration nahi.

## Masla kya tha

Add Expense (aur kuch write screens) par branch `CustomSelect` dikhta tha (maslan **College Road**) jab user ke paas sirf **ek** assigned branch hoti thi. User ko manually select karna parta tha ya galat list (admin JWT par saari company branches) dikhti thi.

## Root cause

- [`ExpenseModule.tsx`](../erp-mobile-app/src/components/expense/ExpenseModule.tsx) ne apna branch loader use kiya (`isAdminOrOwner ? all branches`) — `useWriteBranchSelection` nahi.
- [`ExpenseEntryFlow.tsx`](../erp-mobile-app/src/components/accounts/ExpenseEntryFlow.tsx) aur [`CreateRentalFlow.tsx`](../erp-mobile-app/src/components/rental/CreateRentalFlow.tsx) bina RBAC ke `getBranches()` call karte thay.
- Hook mein single-branch `resolved` case par `effectiveBranchId` kabhi null reh sakta tha jab global branch `all` ho.

## Fixes

### Shared

- [`writeBranchResolution.ts`](../erp-mobile-app/src/utils/writeBranchResolution.ts) — `shouldShowWriteBranchPicker()`.
- [`useWriteBranchSelection.ts`](../erp-mobile-app/src/hooks/useWriteBranchSelection.ts) — `needsPicker` ab sirf 2+ branches par; `effectiveBranchId` resolved case se.

### Modules

- **ExpenseModule** — `useWriteBranchSelection` + `documentBranchId`; `WriteBranchPickerField` sirf jab `needsPicker && pickerBranches.length > 1`.
- **ExpenseEntryFlow** — same hook; picker hide jab 1 branch.
- **CreateRentalFlow** — `CounterWorkerContext` effective ids + hook; picker hide jab 1 branch.

Sales / POS / Purchase / Studio pehle se hook use karte thay — ab single-branch par `effectiveBranchId` reliably set hota hai.

## Verify

```bash
npm run typecheck:mobile   # PASS
```

**Manual smoke:**

| Scenario | Expected |
|---|---|
| Worker, 1 branch, global All | Add Expense: no branch dropdown; save OK |
| Admin, 3+ branches, global All | Branch picker dikhe |
| New rental, worker 1 branch | Confirm step par branch picker na ho |
| Concrete global branch | Koi write picker na ho |
