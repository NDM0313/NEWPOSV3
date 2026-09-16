# Screen inventory — remaining optional report surfaces

**Run:** PHASE 3 — REMAINING OPTIONAL SCREEN AUDIT  
**Generated:** 2026-06-29  
**Prior reference:** [`remaining-screens-audit.md`](../post-baseline-remaining-phases/remaining-screens-audit.md)

---

## Executive summary

Five live unified main loaders (Ledger V2, Account Statement, Trial Balance, Party Ledger, Roznamcha) are **out of scope** for this audit. Balance Sheet, P&L, and Cash Flow remain on **legacy or mixed** data paths with **no unified loader flags** in `unifiedLedgerFlagKeys.ts`. Mobile ERP exposes party/account ledgers and Roznamcha but **no BS / P&L / Cash Flow / Trial Balance** screens.

---

## Balance Sheet

| Field | Value |
|-------|-------|
| Route / page | Reports → Financial Reports → Balance Sheet tab — `ReportsDashboardEnhanced.tsx` (`financialReportType === 'balance-sheet'`) |
| Component | `src/app/components/reports/BalanceSheetPage.tsx` |
| Service | `accountingReportsService.getBalanceSheet` → internally calls `getTrialBalance(1900-01-01, asOfDate)` |
| Data source | **LEGACY** — direct `journal_entry_lines` + `journal_entries` aggregation (not `get_unified_trial_balance` RPC) |
| Company filter | `companyId` from `SupabaseContext` |
| Branch filter | Optional `branchId` prop; uses `journalEntryMatchesBranchFilter` (not strict unified branch mode unless TB options set) |
| Date behavior | As-of `reportEndDate` (cumulative TB through end date) |
| Export / print | Excel via `exportToExcel`; print via `FinancialReportPrintShell`; WhatsApp share summary |
| `reportVisibilityContract` | **Not applied** — void JEs excluded in `getTrialBalance`; correction_reversal rows **included** in legacy TB (differs from unified `effective_party` / Roznamcha normal mode) |
| Reversal visibility | Legacy TB includes non-void `correction_reversal` JEs; no normal/audit toggle on BS page |
| Known risks | **TB screen vs BS divergence** when unified TB loader ON — TB main uses unified RPC; BS still uses legacy JEL path. High finance risk if totals differ. |
| Preview-only parity safe? | **YES** — read-only unified TB-derived preview compare (no main loader swap) |

---

## Profit & Loss (P&L)

| Field | Value |
|-------|-------|
| Route / page | Reports → Financial Reports → P&L tab — `ReportsDashboardEnhanced.tsx` (`profit-loss`) |
| Component | `src/app/components/reports/ProfitLossPage.tsx` |
| Service | `accountingReportsService.getProfitLoss` → `getTrialBalance(startDate, endDate)` + account type mapping |
| Data source | **LEGACY** (same JEL path as BS) |
| Company / branch | `companyId` + optional `branchId` |
| Date behavior | Period `startDate`–`endDate`; optional prior-month / prior-quarter comparison |
| Export / print | Excel + `FinancialReportPrintShell` + WhatsApp |
| `reportVisibilityContract` | **Not applied** on P&L derivation |
| Reversal visibility | Same as legacy TB (void excluded; correction_reversal included) |
| Known risks | COGS vs expense split uses `COST_OF_PRODUCTION_CODES` + type heuristics — mapping drift vs unified basis filters |
| Preview-only parity safe? | **YES** |

---

## Cash Flow (web)

| Field | Value |
|-------|-------|
| Route / page | Accounting → Cash Flow tab — `AccountingDashboard.tsx` (`activeTab === 'cash_flow'`) |
| Component | `src/app/components/reports/CashFlowReportPage.tsx` |
| Service | `cashFlowReportService.getCashFlowReport` → `roznamchaService.getRoznamcha` |
| Data source | **LEGACY / MIXED** — roznamcha path; when Roznamcha unified loader ON, **Cash Flow tab does not follow unified main** |
| Company / branch | `companyId`; branch select; account filter (cash/bank/wallet) |
| Date behavior | `dateFrom`–`dateTo`; optional GL cash-flow statement summary via `accountingReportsService` |
| Export / print | CSV, PDF preview (`CashBookReportPreview`), `useReportExport` |
| `reportVisibilityContract` | **Partial** — `cashFlowReportLogic` + audit mode toggle; `shouldIncludeInNormalCashMovement` / audit suffixes |
| Reversal visibility | Normal mode hides voided + correction_reversal; audit mode shows labeled trails |
| Known risks | Divergence from unified Roznamcha when loader ON; tie-out diagnostics exist but not production-gated |
| Preview-only parity safe? | **YES** — compare unified cash/bank stream vs legacy roznamcha without loader swap |

---

## Mobile — ledger / report / export / print

| Surface | Path | Data source | Unified | Export/print |
|---------|------|-------------|---------|--------------|
| Reports hub | `erp-mobile-app/src/components/accounts/reports/ReportsHub.tsx` | N/A | No flags | N/A |
| Account Ledger | `reports/AccountLedgerReport.tsx` + `api/reports.ts` | Legacy JEL + optional RPC fallback | **No** unified loader resolution | `LedgerPreviewPdf` |
| Party Ledger (customer/supplier/worker) | `reports/PartyLedgerReport.tsx` + `api/partyGlLedger.ts` | Legacy + `contactBalancesRpc` | **No** | `LedgerPreviewPdf` |
| Day Book / Roznamcha | `reports/DayBookReport.tsx` + `api/roznamcha.ts` | Legacy roznamcha | **No** — web Roznamcha unified loader not mirrored | `RoznamchaPreviewPdf` |
| Cash/Bank/Wallet summaries | ReportsHub tiles → summary reports | Legacy account movements | **No** | PDF patterns in shared components |
| Chart of Accounts balances | `ChartOfAccountsView.tsx` + `accountBalancesFromJournal.ts` | Legacy JEL balances | **No** | None |
| Journal detail cash-flow badge | `JournalEntryDetailPanel.tsx` + `lib/cashFlowDirection.ts` | Derived from JE reference_type | N/A | N/A |
| Balance Sheet / P&L / TB / Cash Flow statement | **Not present** | — | — | — |

**Mobile parity docs:** No dedicated Flutter parity doc; Capacitor app under `erp-mobile-app/`. Web/mobile parity implied in `SINGLE_CORE_LEDGER_PHASE_2_ROLLOUT_PLAN.md` (Phase 2.mobile deferred).

---

## `reportVisibilityContract` usage (web)

| Module | Uses contract? |
|--------|----------------|
| `reportVisibilityContract.ts` | Core definitions: normal vs audit, correction_reversal, party effective rows |
| `cashFlowReportLogic.ts` | Yes — normal/audit cash movement |
| `unifiedLedgerBasisFilter.ts` | Yes — basis mapping to RPC filters |
| `transactionTraceReportVisibility.ts` | Yes — trace UI |
| `accountingReportsService` (BS/P&L/TB legacy) | Partial — void only; no correction_reversal filter |
| `BalanceSheetPage` / `ProfitLossPage` | No direct import |

---

## Unified ledger helpers / RPCs (relevant, not wired to BS/P&L/CF main)

| RPC / helper | Used by live loaders | Available for future BS/P&L/CF |
|--------------|---------------------|--------------------------------|
| `get_unified_trial_balance` | Trial Balance main (when loader ON) | **Candidate** for BS/P&L derivation |
| `get_unified_cash_bank_ledger` | Roznamcha unified path | **Candidate** for Cash Flow |
| `get_unified_party_ledger` | Party Ledger | Mobile party reports (not wired) |
| `get_unified_account_ledger` | Account Statement / Ledger V2 | Mobile account ledger (partial) |
| `unifiedLedgerFlagKeys.ts` | 5 screen loaders only | **No** BS/P&L/CF keys |

---

## Safe for preview-only parity work

| Surface | Safe preview-only? | Notes |
|---------|---------------------|-------|
| Balance Sheet | Yes | Admin/developer compare only |
| P&L | Yes | Same |
| Cash Flow | Yes | Unified vs roznamcha compare |
| Mobile ledgers | Yes | Read-only audit docs + test mapping first |
| Mobile BS/P&L/CF | N/A | Screens do not exist |
