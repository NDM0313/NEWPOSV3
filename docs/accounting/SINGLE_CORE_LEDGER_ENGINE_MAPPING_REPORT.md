# Single Core Ledger — Engine Mapping Report (Part A)

**Branch:** `feature/single-core-ledger-shadow`  
**Date:** 2026-06-20  
**Status:** Read-only inventory — no engines replaced in this phase.

---

## 1. Purpose

Map every ledger/report balance engine currently used by DIN Collection ERP screens, exports, print, and WhatsApp share flows. Each row identifies the **replacement target** under the Unified Core Ledger Engine (UCLE): one `journal_entries` + `journal_entry_lines` source with explicit `basis` lenses.

**Basis legend:**

| Code | Meaning |
|------|---------|
| `official_gl` | Posted non-void GL only |
| `effective_party` | Hides correction/reversal/void/cancelled chains |
| `audit_full_history` | Full trace including JE-0168-class reversals |
| `mixed` | Multiple bases or undocumented blend |
| `operational` | Document tables — not GL |

---

## 2. Account Statements

| File | Function / RPC | Screen / module | Current basis | Risk / problem | Unified replacement |
|------|----------------|-----------------|---------------|----------------|---------------------|
| [`src/app/components/reports/AccountLedgerReportPage.tsx`](../../src/app/components/reports/AccountLedgerReportPage.tsx) | UI orchestration | Accounting → Account Statements | User toggle Effective/Audit | Routes to hybrid customer path | `unifiedLedgerService.getUnifiedPartyLedger` + basis param |
| [`src/app/services/accountingService.ts`](../../src/app/services/accountingService.ts) | `getCustomerLedger` | Customer statement mode | **mixed** — GL + synthetic sales/payments/rentals | Injects unposted rows; client `arJournalLineMatchesCustomer` ≠ SQL resolver | `get_unified_party_ledger` RPC, `party_type=customer` |
| [`src/app/services/accountingService.ts`](../../src/app/services/accountingService.ts) | `getSupplierApGlJournalLedger` | Supplier statement | `official_gl` via RPC | Legacy client fallback diverges | `get_unified_party_ledger`, `party_type=supplier` |
| [`src/app/services/accountingService.ts`](../../src/app/services/accountingService.ts) | `getWorkerPartyGlJournalLedger` | Worker statement | `official_gl` client filter | No RPC; client party match | `get_unified_party_ledger`, `party_type=worker` |
| [`src/app/services/accountingService.ts`](../../src/app/services/accountingService.ts) | `getAccountLedger` | COA / cash-bank / account+contact | `official_gl` / Effective toggle | Separate query path per account | `get_unified_account_ledger` |
| [`src/app/features/ledger-statement-center-v2/LedgerStatementCenterV2Page.tsx`](../../src/app/features/ledger-statement-center-v2/LedgerStatementCenterV2Page.tsx) | UI | Ledger & Statement Center V2 | Same as Account Statements | Duplicate orchestration | `unifiedLedgerService` |
| [`src/app/services/ledgerStatementCenterV2Service.ts`](../../src/app/services/ledgerStatementCenterV2Service.ts) | `getLedgerStatementV2`, `loadGlEntries` | V2 center | `official_gl` (customer uses hybrid) | Customer path calls `getCustomerLedger` | `unifiedLedgerService` |
| [`src/app/services/ledgerStatementCenterV2Service.ts`](../../src/app/services/ledgerStatementCenterV2Service.ts) | `shareLedgerRowViaWhatsApp` | WhatsApp row share | Inherited from V2 rows | Shares hybrid rows for customer | UCLE rows + basis label in message |
| [`src/app/features/ledger-statement-center-v2/LedgerPrintDocument.tsx`](../../src/app/features/ledger-statement-center-v2/LedgerPrintDocument.tsx) | Print PDF | Statement print | Inherited | Print may not match GL TB | UCLE print adapter |
| [`src/app/components/shared/UnifiedLedgerView.tsx`](../../src/app/components/shared/UnifiedLedgerView.tsx) | Drawer ledger | Sales/Purchases/Contacts drawers | `getCustomerLedger` / supplier / worker GL | Hybrid in customer drawer | `unifiedLedgerService` |

---

## 3. Ledger Hub & Party Statements

| File | Function / RPC | Screen / module | Current basis | Risk / problem | Unified replacement |
|------|----------------|-----------------|---------------|----------------|---------------------|
| [`src/app/components/accounting/LedgerHub.tsx`](../../src/app/components/accounting/LedgerHub.tsx) | Router | Accounting → Ledger Hub | N/A | Fans out to 3 engines | Single `UnifiedPartyLedgerView` (Phase 3+) |
| [`src/app/components/customer-ledger-test/CustomerLedgerPageOriginal.tsx`](../../src/app/components/customer-ledger-test/CustomerLedgerPageOriginal.tsx) | 3-tab UI | Ledger Hub → Customer | Tab 1: **operational**; Tab 2: GL RPC; Tab 3: recon | Default tab is non-GL | UCLE + separate Open Items panel |
| [`src/app/services/customerLedgerApi.ts`](../../src/app/services/customerLedgerApi.ts) | `getTransactions`, `getLedgerSummary`, `getAgingReport` | Customer operational tab | **operational** | `sales`/`payments`/`rentals` — bypasses JE attribution | `get_open_items_for_party` (Phase 2) + UCLE for balance |
| [`src/app/services/customerLedgerApi.ts`](../../src/app/services/customerLedgerApi.ts) | RPC `get_customer_ledger_sales`, `get_customer_ledger_payments`, `get_customer_ledger_rentals` | Customer operational | **operational** | SECURITY DEFINER document reads | Open-items API only |
| [`src/app/services/accountingService.ts`](../../src/app/services/accountingService.ts) | `getCustomerArGlJournalLedger` → `get_customer_ar_gl_ledger_for_contact` | Customer GL tab | `official_gl` | Stricter than Account Statements hybrid | `get_unified_party_ledger` |
| [`src/app/components/accounting/GenericLedgerView.tsx`](../../src/app/components/accounting/GenericLedgerView.tsx) | Operational + GL tabs | Supplier / user / worker | Mixed per entity | Supplier operational ≠ GL | UCLE per `party_type` |
| [`src/app/services/ledgerDataAdapters.ts`](../../src/app/services/ledgerDataAdapters.ts) | `getSupplierOperationalLedgerData`, `getWorkerLedgerData`, `getUserLedgerData` | GenericLedgerView operational | **operational** | `purchases`/`payments`/`worker_ledger_entries` | Open-items panels |
| [`src/app/components/accounting/EffectivePartyLedgerPage.tsx`](../../src/app/components/accounting/EffectivePartyLedgerPage.tsx) | Route `/effective-party-ledger` | Effective Party Ledger | **effective_party** (mutations collapse) | Third engine; `payments.contact_id` strict | UCLE `basis=effective_party` |
| [`src/app/services/effectivePartyLedgerService.ts`](../../src/app/services/effectivePartyLedgerService.ts) | `loadEffectivePartyLedger` | Effective Party Ledger | **effective_party** | PF-14 collapse separate from GL | UCLE + mutation JEs from `transaction_mutations` |
| [`src/app/components/contacts/ContactProfileActivityTabs.tsx`](../../src/app/components/contacts/ContactProfileActivityTabs.tsx) | Embedded customer ledger | Contacts profile | Operational default | Users see non-GL first | UCLE embedded |

---

## 4. Roznamcha (Daily Cash Book)

| File | Function / RPC | Screen / module | Current basis | Risk / problem | Unified replacement |
|------|----------------|-----------------|---------------|----------------|---------------------|
| [`src/app/services/roznamchaService.ts`](../../src/app/services/roznamchaService.ts) | `fetchRoznamchaRows`, `getRoznamchaResult` | Reports → Roznamcha | **mixed** — `payments` primary + JE merge | Not journal-only; liquidity classification client-side | `get_unified_cash_bank_ledger` + liquidity enrich |
| [`src/app/lib/reportVisibilityContract.ts`](../../src/app/lib/reportVisibilityContract.ts) | `shouldIncludeInNormalCashMovement` | Roznamcha normal mode | Hides `correction_reversal` | Basis logic duplicated | Shared `_unified_basis_includes_row` SQL + TS |
| [`erp-mobile-app/src/api/roznamcha.ts`](../../erp-mobile-app/src/api/roznamcha.ts) | Mobile roznamcha | Mobile reports | Same hybrid | Mobile/web drift | UCLE mobile client (Phase 4) |

---

## 5. Day Book

| File | Function / RPC | Screen / module | Current basis | Risk / problem | Unified replacement |
|------|----------------|-----------------|---------------|----------------|---------------------|
| [`src/app/components/reports/DayBookReport.tsx`](../../src/app/components/reports/DayBookReport.tsx) | UI | Reports → Day Book | Normal vs Audit toggle | Direct JE queries in component/service | `get_unified_account_ledger` all accounts or dedicated day-book RPC |
| [`src/app/lib/dayBookDiagnostics.ts`](../../src/app/lib/dayBookDiagnostics.ts) | Diagnostics | Developer tools | `official_gl` / audit | Separate from statements | UCLE `audit_full_history` rows |

---

## 6. Trial Balance, Balance Sheet, P&L

| File | Function / RPC | Screen / module | Current basis | Risk / problem | Unified replacement |
|------|----------------|-----------------|---------------|----------------|---------------------|
| [`src/app/services/accountingReportsService.ts`](../../src/app/services/accountingReportsService.ts) | `getTrialBalance` | Trial Balance | `official_gl` | Already journal-based; AR/AP party expansion separate | `get_unified_trial_balance` (Phase 2) — same CTE as party ledger |
| [`src/app/components/reports/TrialBalancePage.tsx`](../../src/app/components/reports/TrialBalancePage.tsx) | UI + drill-down | Trial Balance | `official_gl` | Drill uses `AccountLedgerView` → `getAccountLedger` | UCLE account drill |
| [`src/app/services/accountingReportsService.ts`](../../src/app/services/accountingReportsService.ts) | `getBalanceSheet` | Balance Sheet | `official_gl` | Journal aggregation | Shares UCLE account sums |
| [`src/app/components/reports/BalanceSheetPage.tsx`](../../src/app/components/reports/BalanceSheetPage.tsx) | UI | Balance Sheet | `official_gl` | — | UCLE-backed (Phase 3+) |
| [`src/app/services/accountingReportsService.ts`](../../src/app/services/accountingReportsService.ts) | `getProfitAndLoss` | P&L | `official_gl` | Journal by account type | UCLE account sums by P&L class |
| [`src/app/services/accountingReportsService.ts`](../../src/app/services/accountingReportsService.ts) | `getArApGlSnapshot` | AR/AP cards | `official_gl` | Control vs party subtree | Align with `_party_ledger_attributed_lines` |

---

## 7. Cash Flow

| File | Function / RPC | Screen / module | Current basis | Risk / problem | Unified replacement |
|------|----------------|-----------------|---------------|----------------|---------------------|
| [`src/app/services/cashFlowReportService.ts`](../../src/app/services/cashFlowReportService.ts) | `loadCashFlowReport` | Cash Flow report | **mixed** — GL official + operational normal | Two sections different sources | UCLE for GL section; operational section labeled separately |
| [`src/app/components/reports/CashFlowReportPage.tsx`](../../src/app/components/reports/CashFlowReportPage.tsx) | UI | Cash Flow | Per `FINANCIAL_TRUTH_BASIS` | — | UCLE cash/bank movement |

---

## 8. AR/AP Center & Financial Trace

| File | Function / RPC | Screen / module | Current basis | Risk / problem | Unified replacement |
|------|----------------|-----------------|---------------|----------------|---------------------|
| [`src/app/services/arApReconciliationCenterService.ts`](../../src/app/services/arApReconciliationCenterService.ts) | `fetchUnmappedJournalLines` | AR/AP Center queues | Diagnostic heuristic | `v_ar_ap_unmapped_journals` ≠ ledger engines | Phase 0 cleanup; UCLE does not read JPCM |
| [`src/app/services/contactBalanceReconciliationService.ts`](../../src/app/services/contactBalanceReconciliationService.ts) | `getSingleCustomerPartyReconciliation` | Reconciliation tabs | Compares operational vs `get_contact_party_gl_balances` | Two-engine compare baked in | Compare UCLE vs open-items due |
| [`src/app/services/financialTraceCenterService.ts`](../../src/app/services/financialTraceCenterService.ts) | `fetchPartyTrace` | Financial Trace / Tie-out | Calls `getCustomerLedger`, `getLedgerStatementV2` | Multi-engine trace | UCLE tie-out service |
| [`src/app/components/accounting/ArApReconciliationCenterPage.tsx`](../../src/app/components/accounting/ArApReconciliationCenterPage.tsx) | UI | AR/AP Reconciliation Center | Queues + trace embed | 217+ unmapped JEs | Phase 0 diagnostics |

---

## 9. Balance & party GL RPCs (read-only, keep during migration)

| RPC / function | Used by | Role in migration |
|----------------|---------|-------------------|
| `get_contact_party_gl_balances` | Contacts, reconciliation, variance | Must share attribution CTE with UCLE |
| `get_customer_ar_gl_ledger_for_contact` | Customer GL tab, mobile | **Keep** — shadow compare until UCLE proven |
| `get_supplier_ap_gl_ledger_for_contact` | Supplier GL tab, mobile | **Keep** |
| `_gl_resolve_party_id_for_journal_entry` | All party GL RPCs | **Core resolver** — extend carefully for CUS-0000 |
| `count_unmapped_ar_ap_journal_entries_split` | Integrity Lab | Phase 0 metric |

---

## 10. Mobile (`erp-mobile-app`)

| File | Function | Screen | Current basis | Unified replacement |
|------|----------|--------|---------------|---------------------|
| [`erp-mobile-app/src/api/partyGlLedger.ts`](../../erp-mobile-app/src/api/partyGlLedger.ts) | `getCustomerArGlLedgerLinesForContact` | Party Ledger Report | `official_gl` RPC | `get_unified_party_ledger` |
| [`erp-mobile-app/src/api/customerLedger.ts`](../../erp-mobile-app/src/api/customerLedger.ts) | Operational RPCs | Customer collections | **operational** | Open-items API |
| [`erp-mobile-app/src/api/reports.ts`](../../erp-mobile-app/src/api/reports.ts) | `getAccountLedgerLines` | Account ledger report | `official_gl` | `get_unified_account_ledger` |
| [`erp-mobile-app/src/api/workerPartyGlLedger.ts`](../../erp-mobile-app/src/api/workerPartyGlLedger.ts) | Worker GL lines | Party ledger worker | Client filter | UCLE `party_type=worker` |

---

## 11. Print / export / WhatsApp summary

| Flow | Engine today | Risk | UCLE target |
|------|--------------|------|-------------|
| Account Statement PDF | `AccountLedgerReportPage` → hybrid `getCustomerLedger` | PDF balance ≠ GL TB | UCLE + basis banner on PDF |
| Ledger V2 PDF | `ledgerStatementCenterV2Service` | Same | UCLE |
| Ledger V2 CSV/Excel | `LedgerStatementCenterV2Page` export | Hybrid customer rows | UCLE rows |
| WhatsApp row share | `shareLedgerRowViaWhatsApp` | Reference from hybrid enrichment | UCLE enrichment |
| Customer ledger print | `CustomerLedgerPageOriginal` → `customerLedgerAPI` | Operational not GL | Open-items export + UCLE statement |
| Roznamcha print | `roznamchaService` | Payment-first | UCLE cash/bank |
| Trial Balance export | `TrialBalancePage` | Already GL | Unchanged until UCLE TB RPC |

---

## 12. Engine count summary

| Category | Engine count | Journal-only? |
|----------|--------------|---------------|
| Customer ledger reads | 4 (`getCustomerLedger`, `getCustomerArGlJournalLedger`, `customerLedgerAPI`, `effectivePartyLedgerService`) | 1 partial |
| Supplier ledger reads | 3 | 1 |
| Worker ledger reads | 3 | 1 partial |
| Account/cash reads | 3 (`getAccountLedger`, roznamcha, cash flow) | 1–2 |
| Official financial reports | 4 (TB, BS, P&L, COA) | 4 |
| **Target** | **1 UCLE + open-items sidecar** | **1** |

---

## 13. Phase 0–1 scope (this branch)

**In scope:** Mapping (this doc), read-only diagnostics, `get_unified_party_ledger` draft RPC, `unifiedLedgerService.ts` shadow mode, developer tie-out UI.

**Out of scope:** Deleting any file in Section 2–10, rewiring production screens, applying data fixes.

---

*Generated for `feature/single-core-ledger-shadow` — Part A complete.*
