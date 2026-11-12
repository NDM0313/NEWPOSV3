# Authoritative Legacy Inventory — 2026-07-15

Fresh scan of OLD ERP / DIN Collection ERP. No files deleted or modified for this inventory.
Naming containing `Legacy` is **not** sufficient for deletion — see classification + retain reasons.

**Soak:** 5/30 elapsed · gate **NOT MET** · earliest deletion **2026-08-09**

---

## Summary counts

| Classification | Count (items) |
|----------------|---------------|
| DELETE AFTER SOAK | 4 thin wrappers + 6 page-branch targets |
| DELETE PAGE BRANCH ONLY | 6 (AS, TB, Party, Roznamcha, Ledger V2, Cash Flow); BS/P&L last / separate |
| RETAIN FOR ERROR FALLBACK | 2 (BS, P&L try/catch) — until post-drill wave |
| RETAIN FOR SHADOW COMPARE | 5 `*LegacyShadowPreviewService.ts` |
| RETAIN FOR HYBRID DEPENDENCY | 1 (`getCustomerLedger`) |
| RETAIN FOR MOBILE | mobile fallback paths |
| RETAIN FOR CONTACTS | Contacts `get_contact_party_gl_balances` |
| RETAIN FOR ROLLBACK | 36 rollback scripts + resolvers + engine/flags + kill switch + loader guard |
| TEST-ONLY | resolver/wiring tests referencing legacy (rewrite after delete, not delete blindly) |
| OUTSIDE R8-R2 | Dashboard reuse of TB/BS/P&L report services; Play Store; import-gap WIP |
| NEEDS HUMAN DECISION | BS/P&L error-fallback removal timing; shadow retarget before wrapper delete |

---

## Inventory table

| Path / component | Runtime refs | Test refs | Unified replacement | Rollback dependency | Proposed R8-R2 action | Retain/delete | Reason |
|------------------|--------------|-----------|---------------------|---------------------|----------------------|---------------|--------|
| `src/app/services/accountStatementLegacyMainService.ts` | AccountLedgerReportPage; accountStatementLegacyShadowPreviewService | AS resolver + wiring tests | `loadAccountStatementUnifiedMain` | `phase-211-rollback-*-loader.sql` | Delete file after soak; retarget shadow import in same PR | **DELETE AFTER SOAK** | Thin wrapper; kill path needs code until L0 proven |
| `src/app/services/trialBalanceLegacyMainService.ts` | TrialBalancePage; trialBalanceLegacyShadowPreviewService; dashboards may call deeper TB APIs | TB resolver tests | `loadTrialBalanceUnifiedMain` | `phase-212-rollback-*` | Delete wrapper; keep `getTrialBalance`/report services for dashboards | **DELETE AFTER SOAK** | Thin wrapper |
| `src/app/services/partyLedgerLegacyMainService.ts` | EffectivePartyLedgerPage; partyLedgerLegacyShadowPreviewService | Party resolver tests | `loadPartyLedgerUnifiedMain` | `phase-213-rollback-*` | Delete wrapper; retarget shadow | **DELETE AFTER SOAK** | Thin wrapper |
| `src/app/services/roznamchaLegacyMainService.ts` | RoznamchaReport; roznamchaLegacyShadowPreviewService; CF shadow coupling | Roznamcha resolver tests | `loadRoznamchaUnifiedMain` | `phase-214-rollback-*` | Delete wrapper; retarget shadow | **DELETE AFTER SOAK** | Thin wrapper |
| Ledger V2 page legacy branch (`LedgerStatementCenterV2Page` / `getLedgerStatementV2`) | Page dual-loader | 18+ | `getLedgerStatementV2UnifiedMain` | `phase-210-rollback-loader-ledger-v2.sql` | Remove page branch only; keep hybrid helpers until Phase 8 | **DELETE PAGE BRANCH ONLY** | Main path unified; service still used elsewhere |
| Account Statement page legacy branch | `AccountLedgerReportPage.tsx` | 20+ | unified main service | phase-211 | Remove `legacy` branch + LegacyMain import | **DELETE PAGE BRANCH ONLY** | After drill |
| Trial Balance page legacy branch | `TrialBalancePage.tsx` | 20+ | unified main | phase-212 | Remove page branch | **DELETE PAGE BRANCH ONLY** | Keep dashboard TB consumers |
| Party Ledger page legacy branch | `EffectivePartyLedgerPage.tsx` | 20+ | unified main | phase-213 | Remove page branch | **DELETE PAGE BRANCH ONLY** | After drill |
| Roznamcha page legacy branch | `RoznamchaReport.tsx` | 22+ | unified main | phase-214 | Remove page branch | **DELETE PAGE BRANCH ONLY** | After drill |
| Cash Flow page legacy branch | `CashFlowReportPage.tsx` → `getCashFlowReport` | 12+ | `loadCashFlowUnifiedMain` | CF rollback SQL | Remove page branch | **DELETE PAGE BRANCH ONLY** | Mobile separate |
| Balance Sheet error fallback | `BalanceSheetPage.tsx` try/catch → legacy | 12+ | `loadBalanceSheetUnifiedMain` | disable-bs-pl flags / L1 | **Last** remove fallback | **RETAIN FOR ERROR FALLBACK** then **DELETE PAGE BRANCH ONLY** | Live safety net |
| Profit & Loss error fallback | `ProfitLossPage.tsx` | 10+ | `loadProfitLossUnifiedMain` | same | Last | **RETAIN FOR ERROR FALLBACK** then **DELETE PAGE BRANCH ONLY** | Live safety net |
| `*LegacyShadowPreviewService.ts` (×5) | Admin Compare / preview panels | ~25 | N/A diagnostic | Diagnostic only | Keep | **RETAIN FOR SHADOW COMPARE** | Monitoring / Admin Compare |
| `accountingService.getCustomerLedger` | Ledger V2, AS hybrid, contacts-adjacent | 2+ | `get_unified_party_ledger` (partial) | Phase 8 | Keep | **RETAIN FOR HYBRID DEPENDENCY** | Phase 8 not started |
| Contacts `get_contact_party_gl_balances` | `ContactsPage.tsx`, contact services | AR/AP parity tests (official_gl) | unified contact RPC (AR/AP only today) | N/A | Out of R8-R2 | **RETAIN FOR CONTACTS** / **OUTSIDE R8-R2** | Explicit out of scope |
| Mobile legacy fallthrough | `erp-mobile-app` contact/party paths | 0 dedicated SCE | mobile RPCs | L0 kill | Out of web deletion | **RETAIN FOR MOBILE** / **OUTSIDE R8-R2** | Separate approval |
| 8× `resolve*MainLoaderSource.ts` (+ BS/P&L) | All 8 screens | 100+ | Gates for dual loader | L0/L1 | Keep through R8-R2 | **RETAIN FOR ROLLBACK** | Required while flags/kill exist |
| `unifiedLedgerEngineState` / feature flags / kill logic | Broad | many | N/A | L0 | Keep | **RETAIN FOR ROLLBACK** | Kill switch contract |
| L1 rollback SQL (~36 under `scripts/single-core-ledger`) | ops | loader-guard tests | N/A | Primary L1 | Keep | **RETAIN FOR ROLLBACK** | Approved retain |
| Loader guard (`threeCompanyLoaderGuard.mjs` + related) | SSH ops | 5 | N/A | Baseline | Keep | **RETAIN FOR ROLLBACK** | Production verify |
| Dashboard TB/BS/P&L via `accountingReportsService` etc. | AccountingDashboard, ReportsDashboard | few | N/A | N/A | Do not delete shared report APIs | **OUTSIDE R8-R2** | Not thin loader wrappers |
| Resolver / wiring tests naming legacy | test suite | many | Update after delete | N/A | Rewrite assertions; do not mass-delete | **TEST-ONLY** | Failures must be intentional |
| `DashboardLegacy.tsx` / printer Legacy* | UI | — | N/A | N/A | Exclude | **OUTSIDE R8-R2** | Misleading `Legacy` name |
| Shadow ↔ thin-wrapper imports | 4 shadow files import LegacyMain | — | Retarget to underlying APIs in deletion PR | — | Same PR as wrapper delete | **NEEDS HUMAN DECISION** (process) | Do not orphan shadow |

---

## Minimum checklist coverage (mission items 1–21)

1. Thin `*LegacyMainService.ts` — **YES** (4)
2. Ledger V2 page legacy branch — **YES**
3. Account Statement legacy path — **YES**
4. Trial Balance legacy path — **YES**
5. Party Ledger legacy path — **YES**
6. Roznamcha legacy path — **YES**
7. Cash Flow legacy branch — **YES**
8. Balance Sheet legacy error fallback — **YES**
9. Profit & Loss legacy error fallback — **YES**
10. Shadow compare services — **YES** (retain)
11. `getCustomerLedger` hybrid — **YES** (retain)
12. Contacts legacy party GL RPC — **YES** (retain / outside)
13. Mobile legacy fallback — **YES** (retain / outside)
14. Resolver files — **YES** (retain)
15. Unified engine state — **YES** (retain)
16. Feature flags — **YES** (retain)
17. Kill-switch logic — **YES** (retain)
18. L1 rollback SQL — **YES** (retain, 36)
19. Loader guard scripts — **YES** (retain)
20. Dashboards calling reusable report services — **YES** (outside / keep APIs)
21. Test-only legacy references — **YES**

No deletions performed on 2026-07-15.
