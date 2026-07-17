# R8-R2 Deletion Rehearsal — Final Report (accelerated rebase 2026-07-17)

## Verdict

First-wave R8-R2 deletion **technically rehearsed** on branch `rehearsal/r8-r2-legacy-deletion-20260715`, **rebased onto current main** `9f0e237a` (includes LV2 pagination).  
**Not merged. Not deployed. Production unchanged.**

Prior remote tip `60c3746f` (base `866cb0df`) is superseded by `c660f5c3`.

## Removed

- 4 thin `*LegacyMainService.ts` wrappers
- Page legacy main branches: Account Statement, Trial Balance, Party Ledger, Roznamcha, Ledger V2, Cash Flow

## Deferred

- BS/P&L error fallback (**choice B**)

## Retained

Shadow compare, getCustomerLedger, Contacts, mobile, resolvers, flags, kill, L1 SQL, loader guard, CF/LV2 underlying legacy services for shadow/preview, LV2 pagination UI.

## Validation

350/350 unified · 188/188 unit · build PASS · LOCAL STATIC DRILL only · rollback tag drill PASS

## Next production action

On/after 2026-08-09: rebase this branch, operator drill, monitoring, approval phrase, merge + frontend deploy per merge checklist.
