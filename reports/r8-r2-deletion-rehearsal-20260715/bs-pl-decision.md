# BS/P&L decision — REHEARSAL

## Choice: **B. DEFER BS/P&L TO SECOND R8-R2 WAVE**

### Evidence

1. `BalanceSheetPage.tsx` / `ProfitLossPage.tsx` still catch unified failure and call `accountingReportsService.getBalanceSheet` / `getProfitLoss`.
2. `bsPlMainLoaderWiring.test.ts` explicitly asserts `legacy_error_fallback` effective source.
3. Dashboards and other consumers still use the shared report services — not the same as page error fallback, but removing fallback increases live risk before operator drill.
4. Readiness manifest marks BS/P&L as last / human decision; prefer defer unless fallback proven unnecessary.

### Consequence

First-wave rehearsal deletes wrappers + AS/TB/Party/Roznamcha/LV2/CF page branches only.
BS/P&L error fallback remains until a future approved second wave after production drill.
