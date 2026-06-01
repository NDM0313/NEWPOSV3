# Mobile Phase 8D — Security Fixes (Deployment Log)

**Date:** 2026-05-25  
**Scope:** `erp-mobile-app` only — koi DB migration nahi.

## Teen masle the

1. **Branch override:** Admin enroll karte waqt branch dropdown se galat branch choose kar sakta tha.
2. **Redundant PIN:** Employee ka counter PIN pehle se is tablet par ho to bhi admin se dubara PIN maanga ja raha tha.
3. **Data leak (CRITICAL):** Shared Admin JWT ki wajah se salesman/worker ko saari company ki sales aur expenses list mein dikh rahi thin.

## Kya fix hua

| Fix | Badlav |
|-----|--------|
| Branch lock | `getEmployeeEffectiveBranch()` — employee ka default/profile branch auto-lock; dropdown hata diya |
| PIN inherit | Local `counterWorkerRegistry` se pehle se enrolled ho to PIN fields hide; `saveCounterWorkerWithPinHash` |
| Data isolation | `counterDataIsolation.ts` — `worker`/`salesman` role par Sales + Expense lists sirf apni `created_by` / `user_id` / `paid_to_user_id` rows |

## Files

- `CounterPinEnrollModal.tsx` — branch read-only, PIN inherit UX
- `employees.ts` — `getEmployeeEffectiveBranch`
- `counterWorkerRegistry.ts` — `findEnrolledWorkerByIdentity`, `saveCounterWorkerWithPinHash`
- `counterDataIsolation.ts` — naya helper
- `CounterWorkerContext.tsx` — `useEffectiveWorkerProfileId`
- `SalesHome.tsx` — list + stats filter (POS sales bhi Sales tab mein)
- `ExpenseModule.tsx` + `expenses.ts` — creator fields + filter
- `offlinePendingList.ts` — pending sale par `created_by`

## Tablet par verify

1. All Branches → employee enroll → branch locked dikhe, dropdown na ho.
2. Pehle se PIN wala employee → PIN fields na aayein; "Enroll (existing PIN)" kaam kare.
3. Salesman se lock screen unlock → Sales list aur Expense list mein sirf apni entries.
4. Admin session (bina worker unlock) → poori list waisi hi.

## Build

```bash
npm run typecheck:mobile
```

**Result:** PASS

## Note

Cross-device global PIN ab bhi server par nahi — sirf is tablet ki local registry se inherit hota hai. Agar employee pehli dafa is device par hai to admin ko naya 4-digit PIN dena hoga.
