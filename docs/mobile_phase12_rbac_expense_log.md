# Phase 12 — RBAC Leaks & Expense API Polish (Deployment Log)

**Date:** 2026-05-25  
**Scope:** Sirf `erp-mobile-app/` — koi web ya DB migration nahi.

## Masla kya tha

Restricted counter worker (shared tablet par Admin JWT ke neeche) test karte waqt teen bugs mile:

1. **BranchSelection leak** — Worker active hone ke baad bhi screen par saari 5 company branches + "All Branches" dikh rahi thi, kyun ke `canPickAllCompanyBranches(user.role)` Admin JWT role use kar raha tha, worker role nahi.
2. **Expense receipt 400** — `uploadExpenseReceipt` Capacitor par kabhi-kabhi invalid/empty file ya timeout par `400 Bad Request` fail ho jata tha.
3. **Sales / Expense blank lists** — Worker ki apni entries list mein nahi aa rahi thi: optimistic expense row mein `created_by` / `branch_id` missing tha, aur creator ID match case-sensitive tha.

## Fixes

### BranchSelection ([`BranchSelection.tsx`](../erp-mobile-app/src/components/BranchSelection.tsx))

- `useEffectiveWorkerProfile` se `workerActive`, `authId`, `profId` derive.
- Worker active → **hamesha restricted** (`unrestricted = false`), sirf `getUserAssignedBranchIds(authId, profId)`.
- "All Branches" option worker ke liye hide.
- Admin session (worker inactive) — purana behavior same.

### Expense upload ([`expenses.ts`](../erp-mobile-app/src/api/expenses.ts))

- `if (!file || file.size === 0) return { url: null, error: null }`.
- `storageUploadBody` (ArrayBuffer) + `withUploadTimeout` + `try/catch` — [`paymentAttachments.ts`](../erp-mobile-app/src/api/paymentAttachments.ts) jaisa pattern.

### Data isolation ([`counterDataIsolation.ts`](../erp-mobile-app/src/lib/counterDataIsolation.ts))

- Creator IDs lowercase normalize karke match (`created_by_id`, `created_by`, `user_id`, `paid_to_user_id`).
- Worker auth + profile dono IDs check.

### Expense list ([`ExpenseModule.tsx`](../erp-mobile-app/src/components/expense/ExpenseModule.tsx))

- Online aur offline optimistic insert par `created_by: expenseUserId`, `branch_id: effectiveBranchId` set — taake `rowBelongsToCounterWorker` turant pass ho.

### Sales ([`SalesHome.tsx`](../erp-mobile-app/src/components/sales/SalesHome.tsx))

- Pehle se `rowBelongsToCounterWorker(sale.raw, effectiveUserId, effectiveProfileId)` use ho raha tha; hardened helper se `created_by_id` match ab reliable hai.

## Verify

```bash
npm run typecheck:mobile   # PASS
```

**Manual smoke (restricted counter worker):**

1. Branch pick → sirf assigned branch(es); All Branches / doosri branches nahi
2. Sales → worker ki sales dikhen; nayi sale create ke baad list mein turant
3. Expenses → worker ki expenses dikhen; save ke baad turant (receipt ke sath / bina)
4. Receipt photo upload → 400 nahi; save OK ya bucket missing par soft warn
5. Admin (worker inactive) → BranchSelection pehle jaisa (All Branches available)
