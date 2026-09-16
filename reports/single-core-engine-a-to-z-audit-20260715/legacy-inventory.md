# Legacy Code Inventory

**Audit date:** 2026-07-15
**Action taken:** none deleted

| Legacy item | Path / mechanism | Classification | Notes |
|-------------|------------------|----------------|-------|
| Account Statement LegacyMainService | `accountStatementLegacyMainService.ts` | SAFE TO DELETE AFTER SOAK / FALLBACK REQUIRED until R8-R2 | First-wave R8-R2 candidate |
| Trial Balance LegacyMainService | `trialBalanceLegacyMainService.ts` | SAFE TO DELETE AFTER SOAK (page branch); keep `getTrialBalance` | Dashboards still need legacy TB API |
| Party Ledger LegacyMainService | `partyLedgerLegacyMainService.ts` | SAFE TO DELETE AFTER SOAK | — |
| Roznamcha LegacyMainService | `roznamchaLegacyMainService.ts` | SAFE TO DELETE AFTER SOAK | Keep for cash-flow shadow per plan |
| Ledger V2 page legacy branch | `LedgerStatementCenterV2Page` / `getLedgerStatementV2` | MUST RETAIN until Phase 8 / approval | Hybrid customer |
| Cash Flow page legacy branch | `getCashFlowReport` | FALLBACK REQUIRED until soak+drill | No LegacyMainService file |
| BS/P&L page legacy + error fallback | `BalanceSheetPage` / `ProfitLossPage` | MUST RETAIN / FALLBACK REQUIRED | Live error fallback |
| Legacy shadow compare services (5) | `*LegacyShadowPreviewService` | MUST RETAIN / TEST-ONLY+DIAGNOSTIC | Admin Compare |
| `getCustomerLedger` hybrid | `accountingService.ts` | MUST RETAIN / OUT OF R8-R2 SCOPE | Phase 8 |
| Contacts `get_contact_party_gl_balances` | `ContactsPage` / contactService | STILL ACTIVE / OUT OF R8-R2 SCOPE | Optional Phase 2b follow-up |
| AR/AP legacy fallback | same RPC | FALLBACK REQUIRED | Until bridal parity + soak |
| Mobile legacy report paths | `erp-mobile-app` | OUT OF R8-R2 SCOPE / STILL ACTIVE | Separate approval |
| Resolvers + engine state | `resolve*MainLoaderSource.ts`, flags | MUST RETAIN | Rollback gates |
| Kill-switch | DB + env | MUST RETAIN | L0 |
| Rollback SQL (~35) | `scripts/single-core-ledger/**/rollback-*.sql` | MUST RETAIN | L1 |
| Feature flags default OFF | code constants | MUST RETAIN | Safer default |
| Dashboard legacy services | various | STILL ACTIVE / MUST RETAIN | Not R8-R2 |
| Test-only legacy refs | `*.test.ts` | TEST-ONLY | Update with deletions |

## Thin `*LegacyMainService.ts` count

Exactly **4** files (Account Statement, Trial Balance, Party Ledger, Roznamcha).
