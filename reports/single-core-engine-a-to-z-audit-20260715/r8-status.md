# R8-R1 and R8-R2 Status

**Audit date:** 2026-07-15 (soak recalculated today)

## R8-R1 — Operational retirement

| Field | Value |
|-------|--------|
| Start / completion date | **2026-07-10** |
| Approval | `NADEEM_APPROVES_R8_LEGACY_RETIREMENT` — YES |
| Screens covered | 8 money screens × 3 companies |
| Flags enabled | 54 ON; kill OFF (confirmed live 2026-07-15) |
| Production evidence | `reports/r8-legacy-retirement-execution-20260710/`, post-watch folder |
| VPS deploy that day | Skipped (no src retirement diff) |
| Rollback state | Legacy code retained; L0–L2 available |
| Final status | **OPERATIONAL COMPLETE** |

Tags: `r8-pre-operational-retirement-20260710` @ `ba7dadd7`; `r8-operational-retirement-complete-20260710`.

## R8-R2 — Physical deletion

| Field | Value |
|-------|--------|
| Readiness plan | `docs/accounting/R8_R2_LEGACY_DELETION_READINESS_PLAN.md` |
| Kill-switch drill | Closeout claims **PASS (read-only)** 2026-07-12; readiness plan still **NOT DONE**; evidence folder **`reports/r8-r2-kill-switch-drill-20260712/` MISSING** → treat as **UNVERIFIED / PARTIAL** |
| Drill type (claimed) | Read-only pre-check (not production toggle) |
| Production kill toggle performed | **NO** (safety tables agree) |
| Soak start | **2026-07-10** |
| Soak target | 30 days |
| Current soak days (as of 2026-07-15) | **5/30** |
| Earliest deletion review date | **2026-08-09** |
| Written approval | `R8_R2_CODE_DELETION_APPROVAL_REQUIRED` — **NOT GRANTED** |
| Deletion candidates | Thin `*LegacyMainService.ts` (4) then page branches; BS/P&L last |
| Must not delete | Shadow compare, `getCustomerLedger`, resolvers, mobile, rollback SQL, loader guard |
| Rollback plan | L0 kill → L1 SQL → L2 tag deploy |
| Test plan | unified-ledger + build + monitoring after drill |
| Deploy plan | Only if `src/` deletion diff exists |
| Final status | **DEFERRED / NOT STARTED** |

## Do not start R8-R2 deletion yet

Soak incomplete; drill evidence missing/contradictory; approval phrase absent.
