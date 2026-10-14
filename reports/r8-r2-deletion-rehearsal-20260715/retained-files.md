# Retained files / protected components

## Must-retain (not deleted)

- All `*LegacyShadowPreviewService.ts` (AS, TB, Party, Roznamcha, LV2)
- `getCustomerLedger` / hybrid paths in `accountingService.ts`
- Contacts page + `get_contact_party_gl_balances`
- Mobile `erp-mobile-app` legacy fallthrough
- All `resolve*MainLoaderSource.ts` (+ BS/P&L resolvers)
- `unifiedLedgerEngineState`, feature-flag libs, kill-switch wiring
- `scripts/single-core-ledger/**` L1 rollback SQL
- Loader guard / monitoring scripts
- Shared `getTrialBalance` / BS / P&L report APIs (dashboards)
- AR/AP parity libs
- `getCashFlowReport` (Cash Flow shadow / preview compare)
- `getLedgerStatementV2` (LV2 shadow preview service)
- `BalanceSheetPage` / `ProfitLossPage` error→legacy fallback (**deferred**)

## Active references remaining (intentional)

| Consumer | Retained dependency |
|----------|---------------------|
| Shadow compare (AS) | `getCustomerLedger` / underlying AS APIs |
| Shadow compare (TB) | `getTrialBalance` |
| Shadow compare (Party) | `loadEffectivePartyLedger` |
| Shadow compare (Roznamcha) | `getRoznamcha` |
| Shadow compare (LV2) | `getLedgerStatementV2` |
| Cash Flow preview | `getCashFlowReport` |
| Kill/resolvers | return `legacy` when kill ON / flags OFF |
| Pages after deletion | fail-closed via `assertUnifiedMainLoaderSource` when resolver=`legacy` |
