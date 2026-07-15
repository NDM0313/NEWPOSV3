# R8-R2 Deletion Rehearsal — Final Report (2026-07-15)

## Verdict

First-wave R8-R2 deletion **technically rehearsed** on branch `rehearsal/r8-r2-legacy-deletion-20260715`.
**Not merged. Not deployed. Production unchanged.**

## Removed

- 4 thin `*LegacyMainService.ts` wrappers
- Page legacy main branches: Account Statement, Trial Balance, Party Ledger, Roznamcha, Ledger V2, Cash Flow

## Deferred

- BS/P&L error fallback (**choice B**)

## Retained

Shadow compare, getCustomerLedger, Contacts, mobile, resolvers, flags, kill, L1 SQL, loader guard, CF/LV2 underlying legacy services for shadow/preview.

## Validation

348/348 unified · 183/183 unit · build PASS · LOCAL STATIC DRILL only

## Next production action

On/after 2026-08-09: rebase this branch, operator drill, monitoring, approval phrase, merge + frontend deploy per merge checklist.
