# Retained (protected) components

| Component | Status |
|-----------|--------|
| `*LegacyShadowPreviewService.ts` (×5) | retained; AS/TB/Party/Roznamcha retargeted to underlying APIs |
| `getCustomerLedger` hybrid | retained |
| Contacts `get_contact_party_gl_balances` | untouched |
| Mobile legacy paths | untouched |
| Resolvers / engine / flags / kill | retained |
| L1 rollback SQL + loader guard | retained |
| `getCashFlowReport` service | retained (CF preview shadow) |
| `getLedgerStatementV2` service | retained (LV2 shadow) |
| `getTrialBalance` / dashboards | retained |
| BS/P&L error fallback (`getBalanceSheet` / `getProfitLoss`) | **deferred — still present** |
| AR/AP official_gl parity | retained / tests pass |
