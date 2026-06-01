# Phase 15 — Studio Branch / Worker Isolation (Deployment Log)

**Date:** 2026-05-25  
**Scope:** Sirf `erp-mobile-app/` — koi web ya DB migration nahi.

## Masla kya tha

Studio dashboard par doosri branch ya doosre user ki studio sales/productions (maslan `STD-0003`) dikhti thin jab:

1. Global branch **All Branches** select ho — API par koi `branch_id` filter nahi lagta tha, poori company ki productions aa jati thin.
2. Counter worker shared tablet par active ho — list `user.id` (Admin JWT) se compare hoti thi, worker ke `created_by` se nahi.
3. Restricted user ke accessible branches (`branchIds`) Studio list mein use nahi hotay thay.

Sales / Expense / Purchase mein jo isolation pattern tha, Studio mein missing tha.

## Fixes

### API ([`studio.ts`](../erp-mobile-app/src/api/studio.ts))

- `applyStudioBranchFilter` — concrete branch, ya `accessibleBranchIds`, ya admin-all.
- `getStudioProductions` / `getStudioSales` — `options.accessibleBranchIds` support.
- `branch_id` select + `StudioProductionRow.branch_id` type.

### Cache ([`studioListCache.ts`](../erp-mobile-app/src/lib/studioListCache.ts))

- `studioScopeCacheKey(listBranchScope)` — single UUID, `acc:…`, ya `all`.
- `loadStudioSnapshot` ab scope-derived key use karta hai.

### UI ([`StudioModule.tsx`](../erp-mobile-app/src/components/studio/StudioModule.tsx))

- `CounterWorkerContext` — `effectiveUserId`, `effectiveProfileId`, `effectiveRole`.
- `resolveCounterListBranchScope` + API branch args.
- Client filters: `rowInListBranchScope`, `rowBelongsToCounterWorker`, `filterStudioOrdersForScope` (effective ids).
- `useDocumentBranchGate` ab effective worker identity use karta hai.

**Out of scope:** Workers tab company-wide rehta hai (sirf Orders dashboard fix).

## Verify

```bash
npm run typecheck:mobile
```

**Manual smoke:**

| Scenario | Expected |
|---|---|
| Worker/salesman, branch = All | Sirf accessible branch(es) + apni `created_by` studio orders |
| Restricted user, branch = All, `studio.view_branch` | Sirf `branchIds` wali orders |
| Restricted user, `studio.view_own` only | Sirf apni banai hui sales |
| Admin, branch = All | Saari company orders (pehle jaisa) |
| Admin, single branch | Us branch ki orders (pehle jaisa) |
