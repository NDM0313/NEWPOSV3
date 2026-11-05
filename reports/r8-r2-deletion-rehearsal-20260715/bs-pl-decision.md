# BS/P&L decision

**Choice: B — DEFER BS/P&L TO SECOND R8-R2 WAVE**

## Evidence

1. Live pages still implement error→legacy catch:
   - `BalanceSheetPage.tsx`: `Unified Balance Sheet main loader failed; falling back to legacy.`
   - `ProfitLossPage.tsx`: `Unified P&L main loader failed; falling back to legacy.`
2. Tests still assert fallback exists (`r8R2LegacyMainRetired.test.ts` + `bsPlMainLoaderWiring` unified error fallback path).
3. Dashboards / shared report services still consume `getBalanceSheet` / `getProfitLoss`.
4. Manifest section A3: optional same-day only if drill PASS + operator confirms; otherwise must-retain until mini-approval.

## Reason

Fallback remains required until a fresh production operator drill proves L1 flag rollback / failure handling without in-page legacy catch. Prefer minimal first deletion day (A1+A2 only).

## Action in this rehearsal

**No BS/P&L page branch deletion.**
