# Canonical Loader Matrix

**Audit date:** 2026-07-15
**Code default:** legacy until kill OFF **and** loader + engine + screen ON
**Production (live DB 2026-07-15):** 54 unified flags ON for three ops companies; kill_switch row absent (= OFF)

| Screen | Page / component | Resolver | Unified main | Legacy main | Default runtime (code) | Default runtime (prod 3 cos) | Feature flag (loader) | Kill behavior | Missing-RPC / error fallback | Shadow compare | Export | Mobile | Tests | Prod status | Classification |
|--------|------------------|----------|--------------|-------------|------------------------|------------------------------|------------------------|---------------|------------------------------|----------------|--------|--------|-------|-------------|----------------|
| Ledger V2 | `LedgerStatementCenterV2Page.tsx` | `resolveLedgerV2MainLoaderSource.ts` | `getLedgerStatementV2UnifiedMain` | `getLedgerStatementV2` | legacy | **unified** | `unified_ledger_loader_ledger_v2` | force legacy | error → page handling | preview flip | active main | separate | resolver suite | live unified | UNIFIED CANONICAL |
| Account Statement | `AccountLedgerReportPage.tsx` | `resolveAccountStatementMainLoaderSource.ts` | `loadAccountStatementUnifiedMain` | `loadAccountStatementLegacyMain` (`getCustomerLedger` hybrid for customers) | legacy | **unified** | `…_loader_account_statement` | force legacy | fallback retained | yes | active main | separate | yes | live unified | UNIFIED CANONICAL (customer hybrid in legacy only) |
| Trial Balance | `TrialBalancePage.tsx` | `resolveTrialBalanceMainLoaderSource.ts` | `loadTrialBalanceUnifiedMain` | `loadTrialBalanceLegacyMain` | legacy | **unified** | `…_loader_trial_balance` | force legacy | yes | yes | active main | separate | yes | live unified | UNIFIED CANONICAL |
| Party Ledger | `EffectivePartyLedgerPage.tsx` | `resolvePartyLedgerMainLoaderSource.ts` | `loadPartyLedgerUnifiedMain` | `loadPartyLedgerLegacyMain` | legacy | **unified** | `…_loader_party_ledger` | force legacy | yes | yes | active main | separate | yes | live unified | UNIFIED CANONICAL |
| Roznamcha | `RoznamchaReport.tsx` | `resolveRoznamchaMainLoaderSource.ts` | `loadRoznamchaUnifiedMain` | `loadRoznamchaLegacyMain` | legacy | **unified** | `…_loader_roznamcha` | force legacy | assembler path | yes | active main | mobile has own paths | yes | live unified | UNIFIED CANONICAL |
| Cash Flow | `CashFlowReportPage.tsx` | `resolveCashFlowMainLoaderSource.ts` | `loadCashFlowUnifiedMain` | inline `getCashFlowReport` (no LegacyMainService) | legacy | **unified** | `…_loader_cash_flow` | force legacy | page branch | preview | active main | separate | yes | live unified | UNIFIED CANONICAL |
| Balance Sheet | `BalanceSheetPage.tsx` | `resolveBalanceSheetMainLoaderSource.ts` | `loadBalanceSheetUnifiedMain` | `getBalanceSheet` | legacy | **unified** | `…_loader_balance_sheet` | force legacy | **error → legacy** | yes | active main | separate | yes | live unified | UNIFIED CANONICAL |
| Profit & Loss | `ProfitLossPage.tsx` | `resolveProfitLossMainLoaderSource.ts` | `loadProfitLossUnifiedMain` | `getProfitLoss` | legacy | **unified** | `…_loader_profit_loss` | force legacy | **error → legacy** | yes | active main | separate | yes | live unified | UNIFIED CANONICAL |
| AR/AP Center | `ArApReconciliationCenterPage.tsx` | Party Ledger resolver via AR/AP source helper | `get_unified_contact_party_gl_balances` | `get_contact_party_gl_balances` | legacy unless PL loader trio ON | **unified path when PL loaders ON** | same as party_ledger | kill → legacy | **fallback retained** | shadow parity admin | N/A | N/A | `arApPartyGlParity.test.ts` + scripts | migrated; bridal parity FAIL | HYBRID / PRODUCTION BLOCKED (parity) |
| Contacts | `ContactsPage.tsx` | **none** | n/a | `get_contact_party_gl_balances` | **legacy hard** | **legacy** | n/a | n/a | n/a | n/a | n/a | n/a | contact tests elsewhere | live legacy | LEGACY ACTIVE / OUT OF SCOPE |

## Silent legacy defaults

- **Code:** every screen defaults to legacy if any gate off or flag row missing.
- **Production three companies:** no silent legacy — all eight loaders ON.
- **Contacts:** always legacy (by design).
- **Unified-only-in-dev:** not observed for the three ops companies; engine defaults false in code but prod DB overrides ON.

## Gate order

`kill (env/DB) → loader OFF → engine OFF → screen OFF → else unified`
