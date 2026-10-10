# R8-R2 Legacy Deletion Readiness Plan

**Date originally:** 2026-07-11
**Updated:** 2026-07-15 — final execution readiness pack
**Scope:** OLD ERP / DIN Collection ERP — physical legacy **main-loader** code removal
**R8-R1 status:** Operational retirement **COMPLETE** (2026-07-10)
**R8-R2 status:** **Not started** — readiness **complete**; physical deletion **blocked by date gate**

## Do not delete

This document is a **readiness plan**. No code, imports, kill switches, or rollback branches were removed on 2026-07-11 or **2026-07-15**.

**Blocker:** date &lt; **2026-08-09** + missing `R8_R2_CODE_DELETION_APPROVAL_REQUIRED` + missing fresh attested kill-switch drill.

**Authoritative pack (use this for execution):**

- [`R8_R2_FINAL_EXECUTION_READINESS_2026-07-15.md`](R8_R2_FINAL_EXECUTION_READINESS_2026-07-15.md)
- [`reports/r8-r2-final-readiness-20260715/`](../../reports/r8-r2-final-readiness-20260715/)
- [`R8_R2_EXECUTION_PROMPT_FOR_2026-08-09.md`](R8_R2_EXECUTION_PROMPT_FOR_2026-08-09.md)

---

## R8-R1 baseline (retained intentionally)

| Item | Status |
|------|--------|
| Unified main loaders ON | 8 screens × 3 companies (54 flags) |
| Kill switch | OFF in production |
| Legacy loader **code** | **Retained** for L0/L1 rollback |
| Pre-R8 git tag | `r8-pre-operational-retirement-20260710` @ `ba7dadd7` |
| Evidence | `reports/r8-legacy-retirement-execution-20260710/` |

---

## Kill-switch and rollback (must retain until drill complete)

| Layer | Mechanism | Location |
|-------|-----------|----------|
| L0 DB | `unified_ledger_kill_switch` | `unifiedLedgerEngineState.ts` |
| L0 Env | `VITE_UNIFIED_LEDGER_ENGINE_KILLED=true` | build-time |
| L1 SQL | ~36 rollback scripts | `scripts/single-core-ledger/**` |
| L2 Deploy | Tag checkout + `deploy/vps-build-erp-only.sh` | ops runbook |
| Resolver triple-gate | kill → flag → engine → screen | 8× `resolve*MainLoaderSource.ts` |
| BS/P&L error fallback | unified failure → legacy service | `BalanceSheetPage.tsx`, `ProfitLossPage.tsx` |
| Loader guard | SSH read-only SQL | `threeCompanyLoaderGuard.mjs` |

### Kill-switch drill status (corrected)

| Claim | Status |
|-------|--------|
| 2026-07-12 drill PASS | **CLAIM RETRACTED** — original evidence pack never in Git |
| Fresh operator-attended drill | **REQUIRED** after soak; runbook in readiness pack |
| Drill executed 2026-07-15 | **NO** |

---

## Soak (dynamic)

| Field | Value on 2026-07-15 |
|-------|---------------------|
| R8-R1 start | 2026-07-10 |
| Elapsed / required | **5 / 30** |
| Remaining | **25** |
| Earliest deletion | **2026-08-09** |
| Date gate met | **NO** |

---

## Legacy inventory table

Full table: [`reports/r8-r2-final-readiness-20260715/legacy-inventory.md`](../../reports/r8-r2-final-readiness-20260715/legacy-inventory.md).

| Legacy path | Canonical replacement | Proposed action | Readiness |
|-------------|----------------------|-----------------|-----------|
| Thin `*LegacyMainService.ts` (×4) | matching `*UnifiedMain*` | Delete after soak + retarget shadow | **READY FOR FUTURE DELETION** (date-gated) |
| Ledger V2 / AS / TB / Party / Roznamcha / CF page branches | unified mains | Delete page branch only | **READY FOR FUTURE DELETION** (date-gated) |
| BS/P&L error fallback | unified mains | Last / human decision | **STILL REFERENCED** |
| Shadow compare (×5) | Admin Compare | **DO NOT DELETE** | retain |
| `getCustomerLedger` | Phase 8 later | **DO NOT DELETE** | retain |
| Resolvers + engine + flags + kill | gates | Keep through R8-R2 | retain |
| Mobile / Contacts | N/A | Outside R8-R2 | retain |
| L1 rollback SQL + loader guard | ops | **DO NOT DELETE** | retain |

---

## Prerequisites before any deletion

1. **30-day production soak** from R8-R1 (started 2026-07-10) — earliest **2026-08-09**.
2. **Kill-switch drill (L0)** operator-attended with evidence — **NOT DONE** (prior PASS retracted).
3. **Written approval:** `R8_R2_CODE_DELETION_APPROVAL_REQUIRED`.
4. Fresh three-company monitoring PASS after drill.
5. `npm run test:unified-ledger` (343+) and `npm run build` PASS.
6. VPS deploy only if `src/` deletion diff exists (frontend only).

## Recommended deletion order (future, post-approval)

1. Thin `*LegacyMainService.ts` wrappers **with** shadow import retarget in same PR.
2. Ledger V2 / AS / TB / Party / Roznamcha / Cash Flow page legacy branches.
3. BS/P&L page error fallbacks — **last** (optional same day).
4. Defer: shadow compare, `getCustomerLedger`, mobile, Contacts, resolvers, rollback SQL.

## Explicit stop point

**Stop before deleting any file** until all prerequisites above are met and operator approval is recorded.

On **2026-07-15**: readiness documentation only — **no deletion performed**.

---

`R8_R2_CODE_DELETION_APPROVAL_REQUIRED`
