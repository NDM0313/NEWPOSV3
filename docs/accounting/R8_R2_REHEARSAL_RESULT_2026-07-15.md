# R8-R2 Deletion Rehearsal Result — 2026-07-15 (updated 2026-07-17)

**Scope:** OLD ERP / DIN Collection ERP only  
**Branch:** `rehearsal/r8-r2-legacy-deletion-20260715`  
**Base (accelerated rebase):** `9f0e237a` (`origin/main` at rehearsal)  
**Includes readiness HEAD:** `866cb0df` (ancestor)  
**Runtime commit:** `dbb16b1f`  
**Pre-delete tag (local):** `r8-r2-rehearsal-pre-delete-20260715` → `9f0e237a`  
**Evidence:** [`reports/r8-r2-deletion-rehearsal-20260715/`](../../reports/r8-r2-deletion-rehearsal-20260715/)  
**Merge checklist:** [`R8_R2_FINAL_MERGE_CHECKLIST.md`](R8_R2_FINAL_MERGE_CHECKLIST.md)

> Runtime deletion commit must **not** land on `main` or production until date gate + approval + production operator drill.

---

## What was rehearsed

### A. Deleted

1. `accountStatementLegacyMainService.ts`
2. `trialBalanceLegacyMainService.ts`
3. `partyLedgerLegacyMainService.ts`
4. `roznamchaLegacyMainService.ts`

### A/A2. Page branches unified-only

Account Statement · Trial Balance · Party Ledger · Roznamcha · Ledger V2 · Cash Flow

Fail-closed via `assertUnifiedMainLoaderSource` when resolver returns `legacy`.

**Rebase note:** LV2 pagination (`ec70f94a`) and Cash Flow pagination preserved on current main tip.

### B. Retained

Shadow compare (retargeted) · `getCustomerLedger` · Contacts · mobile · resolvers · flags · kill · L1 SQL · loader guard · CF/LV2 underlying legacy services for diagnostics.

### D. Human decision executed

**BS/P&L:** **DEFER** (choice B) — error fallback remains.

---

## Validation

| Check | Result |
|-------|--------|
| `test:unified-ledger` | **350/350 PASS** (baseline tag 345; +5 wiring) |
| `test:unit` | **188/188 PASS** |
| `build` | **PASS** |
| Kill drill | **LOCAL STATIC DRILL — NOT PRODUCTION OPERATOR DRILL** |
| Rollback tag drill | **PASS** (local) |
| Production deploy | **NO** |
| Merge to main | **NO** (runtime) |

---

## Shadow retarget

Legacy bodies moved into `*LegacyShadowPreviewService.ts` calling underlying APIs (`getCustomerLedger` / `getTrialBalance` / `loadEffectivePartyLedger` / `getRoznamcha`).

---

## Rollback note after this deletion

In-page legacy branches are gone. After a future production merge, **L1 flag rollback alone does not restore working main tables**. Use:

1. **L2** checkout of `r8-r2-pre-code-deletion-YYYYMMDD` (production tag on execution day), or
2. Revert the merge commit, then redeploy frontend.

L0 kill still forces resolver=`legacy`, which after this change **fails closed** on rehearsed pages.

---

## Exact next production action

Follow [`R8_R2_FINAL_MERGE_CHECKLIST.md`](R8_R2_FINAL_MERGE_CHECKLIST.md) and [`R8_R2_EXECUTION_PROMPT_FOR_2026-08-09.md`](R8_R2_EXECUTION_PROMPT_FOR_2026-08-09.md) on/after **2026-08-09** with `R8_R2_CODE_DELETION_APPROVAL_REQUIRED`.
