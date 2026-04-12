# 32. P1-5: Studio V3 Accounting Hard Block

**Date:** 2026-04-12  
**Status:** BLOCKED — `completeStage()` throws until JE layer implemented  
**Priority:** P1  
**Bug class:** Financial document finalization with no GL posting

---

## 1. Problem Statement

`studioProductionV3Service.ts` provides a V3 studio production engine using tables `studio_production_orders_v3` and `studio_production_stages_v3`. The `completeStage()` function marks a stage as completed and records the actual cost — but posts **no journal entry**.

If any V3 stage or order is connected to a sale (revenue recognition), completing it without a JE means:
- Revenue or liability is recognised in the operational layer
- GL has no corresponding entry
- Financial reports understate cost; AP/liability subledger is wrong

**This is the same class of bug as the purchase return GL gap (P1-1).**

---

## 2. Evidence

```typescript
// studioProductionV3Service.ts — before P1-5 block:
async completeStage(stageId: string, actualCost: number): Promise<void> {
  await this.updateStage(stageId, { actual_cost: actualCost, status: 'completed' });
  // No accountingService.createEntry() call — no JE posted
}
```

`studioProductionV3Service.ts` has no import of `accountingService` (confirmed by grep). Zero JE posting anywhere in the file.

---

## 3. Code Fix Applied

**File:** `src/app/services/studioProductionV3Service.ts`

```typescript
async completeStage(_stageId: string, _actualCost: number): Promise<void> {
  // P1-5: V3 accounting not yet implemented. Block stage completion until JE layer is added.
  // TODO: Implement JE on stage completion, then remove this block.
  throw new Error(
    '[Studio V3] Cannot complete stage: accounting journal entry layer not yet implemented. Use Studio V1 workflow.'
  );
},
```

Parameters renamed to `_stageId` and `_actualCost` to suppress TypeScript unused-variable warnings while the block is in place.

---

## 4. Impact

Any UI code that calls `studioProductionV3Service.completeStage()` will now receive an error and must display it to the user. This is intentional — the error message directs users to Studio V1.

**V3 orders can still be created, viewed, and have stages assigned.** Only `completeStage()` is blocked.

---

## 5. Unblock Checklist

To remove this hard block, the following must be implemented and verified:

1. **Import `accountingService`** in `studioProductionV3Service.ts`
2. **Resolve GL accounts** for the studio cost JE:
   - Dr: Worker cost / production expense account
   - Cr: AP worker subledger or cash
3. **Post JE** in `completeStage()` after `updateStage()` succeeds:
   - `reference_type: 'studio_production_v3'`
   - `action_fingerprint: 'studio_v3_stage:{companyId}:{stageId}'`
4. **Handle void** — if a stage is un-completed, post reversal JE
5. **Build passes** — `npm run build` 0 errors
6. **Verify** — SQL check: every completed V3 stage has a matching JE
7. **Remove** the `throw` block and restore the `updateStage` call

---

## 6. Studio Version Status Summary

| Version | Tables | JE posting | Status |
|---------|--------|-----------|--------|
| V1 | `studio_production`, `studio_production_stages` | Yes (via `ensureWorkerLedgerEntry` + accounting service) | PRODUCTION BASELINE |
| V2 | `studio_production_v2_*` (if exists) | Partial (via `studioCustomerInvoiceService` — dead code, 0 importers) | FROZEN |
| V3 | `studio_production_orders_v3`, `studio_production_stages_v3` | No — HARD BLOCKED | BLOCKED until JE layer |
