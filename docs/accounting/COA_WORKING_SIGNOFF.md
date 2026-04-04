# COA & accounting workbench — working signoff (runtime)

**Date:** 2026-04-05  
**Type:** Static code-path audit + documentation (no live E2E execution in this pass).  
**Non-goals:** Figma/design polish; Batch 5 / destructive DB cleanup; legacy table removal.

**Authoritative truth:** `accounts`, `journal_entries`, `journal_entry_lines`, `payments`, `payment_allocations`, `worker_ledger_entries`, RPCs `get_customer_ledger_sales`, `get_financial_dashboard_metrics`, `get_contact_balances_summary`, `get_dashboard_metrics`.

**Legacy (must not drive runtime truth):** `chart_accounts`, `account_transactions`, `accounting_audit_logs`, `automation_rules`, `accounting_settings`, `ledger_master`, `ledger_entries`, `backup_cr_*`, `backup_pf145_*` — blocked for “truth” in dev via `accountingCanonicalGuard.ts`; **no** `.from('chart_accounts')` found in runtime `src/` outside that guard.

---

## 1. Files reviewed (signoff audit)

### 1.1 Accounting module UI (`src/app/components/accounting/`)

| File | Role |
|------|------|
| `AccountingDashboard.tsx` | Main workbench: tabs, COA list, journals, day book, roznamcha, ledger hub, statements, integrity lab |
| `AccountsHierarchyList.tsx` | Renders COA hierarchy rows |
| `useAccountsHierarchyModel.ts` | Parent/child balance roll-up for display (`balanceRollupById`) |
| `AccountLedgerView.tsx` / `AccountLedgerPage.tsx` | Per-account GL-style activity |
| `LedgerHub.tsx` | Party “statements” entry: customer / supplier / user / worker |
| `GenericLedgerView.tsx` | Worker path uses `worker_ledger_entries` (canonical worker subledger) |
| `CustomerLedgerPage.tsx` | Customer operational + API |
| `AddAccountDrawer.tsx` | Add account → `accountService` / `accounts` |
| `AddChartAccountDrawer.tsx` | Same canonical target; **name is historical** (see fix report) |
| `AddEntryV2.tsx` | Typed entry flows; canonical spine per `addEntryV2Service` |
| `ManualEntryDialog.tsx` | Manual journal + Roznamcha rule copy |
| `TransactionDetailModal.tsx` | Unified transaction inspect/edit |
| `ControlAccountBreakdownDrawer.tsx` | AR/AP/worker control breakdown |
| `FundsTransferModal.tsx`, `DepositsTab.tsx`, `PayCourierModal.tsx`, `CourierReportsTab.tsx`, `StudioCostsTab.tsx` | Domain-specific; trace to services below |
| `ArApReconciliationCenterPage.tsx`, `ArApRepairDialogs.tsx` | Repair/recon tooling |
| `AccountingIntegrityTestLab.tsx` | Dev/lab surfaces |
| `ChartOfAccountsPartyDropdown.tsx`, `AccountingDashboardAccountRowMenu.tsx`, … | COA chrome |

### 1.2 Reports used from accounting (`src/app/components/reports/`)

| File | Canonical data path (observed) |
|------|--------------------------------|
| `DayBookReport.tsx` | `journal_entries` + `journal_entry_lines` + `accounts` (embed) |
| `RoznamchaReport.tsx` | `getRoznamcha` → `payments` + `accounts` (classify liquidity) |
| `TrialBalancePage.tsx` | `accountingReportsService` → `accounts` + journals |
| `ProfitLossPage.tsx` / `ProfitLossStatement.tsx` | Service-layer (financial reports) |
| `BalanceSheetPage.tsx` | `accounts` + reporting logic |
| `AccountLedgerReportPage.tsx` | Journals + `payments` (where relevant) |

### 1.3 Core services (sampled)

`accountingService.ts`, `accountService.ts`, `accountingReportsService.ts`, `customerLedgerApi.ts`, `financialDashboardService.ts`, `roznamchaService.ts`, `addEntryV2Service.ts`, `workerPaymentService.ts`, `supplierPaymentService.ts`, `controlAccountBreakdownService.ts`, `partySubledgerAccountService.ts`, `accountingCanonicalGuard.ts`, `chartAccountService.ts` (maps to **`accounts`**).

---

## 2. Runtime paths checked (AccountingDashboard tabs)

| Tab / area | Primary data source | Canonical? | Notes |
|------------|---------------------|------------|--------|
| **Overview** (dashboard cards) | `useAccounting` / entries from context; RPC-backed metrics may be used elsewhere in app | **Canonical** (journals + accounts in context) | Full parity with `get_financial_dashboard_metrics` is on **Dashboard** paths too — cross-check in QA |
| **Journal Entries** | `AccountingContext` / `accountingService` → `journal_entries` | **Yes** | Grouped vs audit mode documented in UI |
| **Day Book** | `DayBookReport` → `journal_entries` + lines + `accounts` | **Yes** | Export title corrected (see fix report) |
| **Roznamcha** | `RoznamchaReport` → `payments` + `accounts` | **Yes** | Table copy is **English**; tab title may stay “Roznamcha” |
| **Accounts (COA)** | `AccountingContext.accounts` → `accounts` | **Yes** | Operational vs Professional modes; roll-up in `useAccountsHierarchyModel` |
| **Ledger** | `LedgerHub` + `customerLedgerApi` / contacts / workers + `GenericLedgerView` | **Yes** | Worker uses **`worker_ledger_entries`**, not `ledger_entries` |
| **Receivables / Payables** | Customer ledger + supplier flows (canonical services) | **Yes** | Label worker vs supplier in UI where combined |
| **Account Statements** | `AccountLedgerReportPage` + related | **Yes** | Verify branch filters per environment |
| **Studio / Deposits / Courier** | Feature-specific services | **Yes** (canonical tables) | `worker_ledger_entries` where studio costs |
| **Integrity Lab** | Diagnostics services | **Yes** | Dev-oriented |

---

## 3. Legacy vs canonical findings

| Check | Result |
|-------|--------|
| Runtime `chart_accounts` / `ledger_master` / `ledger_entries` queries in `src/` | **Not found** (excluding comments and `accountingCanonicalGuard` deny-list strings) |
| `worker_ledger_entries` | **Canonical** for worker/studio payable chain — **not** legacy |
| `AddChartAccountDrawer` / `chartAccountService` | **Writes `accounts`** — naming misleading only |
| Roznamcha vs Day Book | **Different sources** (payments vs journals) — must stay labeled |

---

## 4. COA hierarchy & balance semantics (code review)

| Topic | Finding |
|-------|---------|
| **Parent display balance** | `useAccountsHierarchyModel`: for accounts **with children**, `displayBalance = balanceRollupById(id)` = **own `account.balance` + sum(recursive child roll-ups)**. Leaves use **own** `balance`. |
| **Silent parent ≠ children?** | If a **group/control** row also carries a **non-zero** `balance` in DB **and** children carry balances, the UI **intentionally** shows combined roll-up. **Rule documented in UI:** parent rows with children show English microcopy + tooltip in `AccountsHierarchyList` (“Roll-up … own GL + visible sub-accounts; children carry their own posted activity”). **Data governance** (whether non-leaf accounts should ever carry posted balance) remains a **product/finance** policy decision. |
| **Control drill-down** | `ControlAccountBreakdownDrawer` + `fetchControlAccountBreakdown` align to canonical GL + worker rows where coded |

**Signoff:** Hierarchy logic is **consistent with code**; **full numeric signoff** against production data requires **manual QA** (see gap doc).

---

## 5. Statement engine (target checklist)

| Capability | Status |
|------------|--------|
| GL / account / customer / supplier / **worker** statement types | **Primary:** `AccountLedgerReportPage` (+ `statementEngineTypes.ts`, `StatementScopeBanner`). **Worker GL** mode uses `getWorkerPartyGlJournalLedger`. Other surfaces (`LedgerHub`, `GenericLedgerView`, customer ledger) remain complementary. |
| Running balance, debit/credit, journal ref, branch | **Yes** on statement center; branch column + export metadata added; **full** parity across every report tab = manual QA ([COA_BRANCH_PARITY_CHECKLIST.md](./COA_BRANCH_PARITY_CHECKLIST.md)). |
| Print/export with metadata | Export title/slug includes **mode + period + branch scope line** on statement center. |
| Open journal / source doc | **View / Edit** on statement rows → `TransactionDetailModal`. **DayBookReport** callbacks unchanged. Dedicated per-row “open source document” without modal = still partial ([ACCOUNTING_WORKBENCH_CLICK_MATRIX.md](./ACCOUNTING_WORKBENCH_CLICK_MATRIX.md)). |

---

## 6. Transactions / journals (Add Entry, payments, Roznamcha rule)

| Area | Canonical? |
|------|--------------|
| Add Entry V2 | **Yes** — `addEntryV2Service` documents source lock |
| Worker/supplier payments | **Yes** — `payments` + journals + `worker_ledger_entries` where applicable |
| Roznamcha | **Yes** — payments-based |
| **Roznamcha rule (English table body)** | **Pass** on `RoznamchaReport` headers/content reviewed |

---

## 7. Reports reconciliation

| Report | Service / tables | Reconciliation note |
|--------|------------------|---------------------|
| Trial Balance | `accountingReportsService` | Totals should tie to GL; **manual** tie-out recommended each release |
| P&L / Balance Sheet | Report services + `accounts` | Same |
| Day Book | Journal lines | Debit/credit totals + rounding adjustment row in component |
| Roznamcha | Payments | Not equal to Day Book by design |

---

## 8. Workbench editability

`AccountingDashboard` wires `DayBookReport` with `onVoucherClick` / `onEditJournalEntry` toward `TransactionDetailModal`. **Account Statements** rows: **View** (prefer `entry_no`) + **Edit** (UUID + unified editor). **Journal Entries** table: **View** + **Edit** + **Lines** / **Status** columns. See [ACCOUNTING_WORKBENCH_CLICK_MATRIX.md](./ACCOUNTING_WORKBENCH_CLICK_MATRIX.md).

---

## 9. Overall readiness (this pass)

| Verdict | **PARTIALLY READY** |
|---------|---------------------|
| Reason | **No** legacy-table runtime path found in audited `src/`; hierarchy and reports **map to canonical** tables. **Improved in implementation pass:** shared statement types + scope banner, worker statement mode, statement row drill-down, journal columns, global date alignment for Account Statements, COA roll-up microcopy, `accountService` branch_id fallback. **Remaining:** production QA (branch parity matrix), deep source-doc links from every row type, optional branch **name** resolution in UI. |

**Batch 5:** **NOT APPROVED.**

**Next:** See [COA_GAP_ANALYSIS.md](./COA_GAP_ANALYSIS.md), [COA_FIX_EXECUTION_REPORT.md](./COA_FIX_EXECUTION_REPORT.md), and [COA_QA_SIGNOFF.md](./COA_QA_SIGNOFF.md) (static QA + **NOT RUN** interactive items).

**Day Book branch (G-BR-02):** **Closed in code** — `DayBookReport` filters `journal_entries` consistently with `getAccountLedger` (null `branch_id` OR selected branch); UI + export metadata state scope.

**Design polish gate:** **NOT certified** until human completes browser QA per `COA_QA_SIGNOFF.md`.
