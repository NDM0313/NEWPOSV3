# Phase 11 — Standard Write-Branch Selection Flow (Deployment Log)

**Date:** 2026-05-25  
**Scope:** Sirf `erp-mobile-app/` — koi web ya DB migration nahi.

## Masla kya tha

Phase 8 ke baad **All Branches** select hone par naya record (sale, purchase, expense, POS checkout) banate waqt branch picker inconsistent ya missing ho gaya tha:

1. `useDocumentBranchGate` **`forcePickWhenMultiple: true`** concrete branch (e.g. Saddar) par bhi modal khol deta tha.
2. Branches load hone se pehle **silent return** — na modal, na error.
3. Stale **`pickedBranchId`** sentinel `'all'` par purani branch resolve kar sakta tha.
4. **ExpenseModule** pehli branch auto-select kar deta tha (`setAddBranchId(data[0].id)`).
5. **PurchaseModule** counter worker ke liye JWT `user.id` use kar raha tha, `effectiveUserId` nahi.

## Target rule

| Global branch header | Behavior |
|---------------------|----------|
| Concrete UUID (e.g. Saddar) | Auto-resolve — **modal nahi** |
| `'all'` / `'default'` | **Branch picker zaroori** (accessible branches only) |
| Sirf ek accessible branch | Woh branch auto-resolve |

Modal branches = `filterAccessibleBranches`: admin → `getUserAccessibleBranchIds`; restricted → `getUserAssignedBranchIds`.

## Core fixes

### [`writeBranchResolution.ts`](../erp-mobile-app/src/utils/writeBranchResolution.ts)

- `resolveWriteBranchFromList` order: document UUID → single branch → concrete global → sentinel → pick.
- `forcePickWhenMultiple` hata diya.

### [`useWriteBranchSelection.ts`](../erp-mobile-app/src/hooks/useWriteBranchSelection.ts)

- Sentinel global par **`pickedBranchId` reset** (stale pick na rahe).
- `needsPicker` = `resolution.status === 'pick'`.

### [`useDocumentBranchGate.ts`](../erp-mobile-app/src/hooks/useDocumentBranchGate.ts)

- `forcePickWhenMultiple` hata diya.
- Loading par callback **queue** (`pendingCallbackRef` + `useEffect`).
- Error par **silent return hata kar** `loadError` / `gateError` expose.

## Module wiring

| Module | File | Change |
|--------|------|--------|
| Sales | `SalesModule.tsx` | `startNewSaleFlow` document branch + picked reset; `runWithBranch` on New |
| Purchases | `PurchaseModule.tsx` | `effectiveUserId/Role/ProfileId` gate par; error banner |
| Expenses | `ExpenseModule.tsx` | Auto-first-branch hatao; `+` par `runWithBranch` jab `'all'`; modal + error banner |
| POS | `POSModule.tsx` | `useEffectiveWorkerProfileId` → `useWriteBranchSelection`; checkout blocked jab branch na ho |

## API note (touch nahi kiya)

[`resolveBranchUuidForWrite`](../erp-mobile-app/src/utils/branchId.ts) ab bhi `'all'` par pehli company branch silently pick kar sakta hai agar client concrete UUID na bheje. Is pass mein sirf **UI gate** fix — create paths se pehle client concrete UUID ensure karta hai.

## Verify

```bash
npm run typecheck:mobile   # PASS
```

**Manual smoke (All Branches selected):**

1. Sales → **New** → branch modal → pick → customer step
2. Purchases → **New** → modal → PO create
3. Expenses → **+** → modal → save (dropdown secondary confirmation)
4. POS → cart → branch picker required → checkout
5. Concrete branch (Saddar) → **no modal**, direct create

**Counter worker tablet:** restricted user ko modal mein sirf assigned branches dikhen.
