# COA & accounting workbench — working signoff (runtime)

**Date:** 2026-04-05  
**Type:** Static code-path audit + documentation (no live E2E execution in this pass).  
**Non-goals:** Figma/design polish; Batch 5 / destructive DB cleanup; legacy table removal.

**Authoritative truth:** `accounts`, `journal_entries`, `journal_entry_lines`, `payments`, `payment_allocations`, `worker_ledger_entries`, RPCs `get_customer_ledger_sales`, `get_financial_dashboard_metrics`, `get_contact_balances_summary`, `get_contact_party_gl_balances`, `get_control_unmapped_party_gl_buckets` (after G-PAR-02 migration), `get_dashboard_metrics`.

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
| **Journal Entries** | `AccountingContext` / `accountingService` → `journal_entries` | **Yes** | Grouped vs audit mode documented in UI; **Account** column uses **`debitAccountDisplay` / `creditAccountDisplay`** (leaf **name (code)** + party on AP/AR when payment/purchase enrichment exists — G-SUP-01). |
| **Day Book** | `DayBookReport` → `journal_entries` + lines + `accounts` | **Yes** | Export title corrected (see fix report) |
| **Roznamcha** | `RoznamchaReport` → `payments` + `accounts` | **Yes** | Table copy is **English**; tab title may stay “Roznamcha” |
| **Accounts (COA)** | `AccountingContext.accounts` → `accounts` | **Yes** | Operational vs Professional modes; roll-up in `useAccountsHierarchyModel` |
| **Ledger** | `LedgerHub` + `customerLedgerApi` / contacts / workers + `GenericLedgerView` | **Yes** | Worker uses **`worker_ledger_entries`**, not `ledger_entries` |
| **Receivables / Payables** | Customer ledger + supplier flows (canonical services) | **Yes** | Label worker vs supplier in UI where combined |
| **Account Statements** | `AccountLedgerReportPage` + related | **Yes** | Verify branch filters per environment; **customer/supplier/worker** party modes use `getCustomerLedger` / supplier / worker GL — **`correction_reversal`** rows included when they reverse a party-linked original (G-REV-01). |
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

## 3.1 Surface → basis map (G-PAR-01, 2026-04-05)

| Surface | Basis | Engine / notes |
|---------|--------|----------------|
| COA **Balance · GL** column | **GL** | `AccountingContext` merges `accountingReportsService.getAccountBalancesFromJournal` (TB Dr−Cr per `accounts.id`); parent rows use **`useAccountsHierarchyModel` roll-up** (self + descendant ids). |
| COA **Related parties** (inline) | **GL (party-attributed)** | `get_contact_party_gl_balances` — journal lines whose `account_id` is the resolved **`accounts.id`** for **trimmed code** **1100** / **2000** / **2010** / **1180** (one id per code per company), **not** automatic inclusion of other descendant account ids under the COA hierarchy. **`correction_reversal`:** after migration `20260405_gl_party_correction_reversal_and_unmapped_buckets.sql`, party key follows the **original** JE when `reference_id` is a UUID (parity with **G-REV-01**). **Payment-linked party:** after `20260406_gl_party_resolve_payment_via_sale_purchase.sql`, `_gl_resolve_party_id_for_journal_entry` uses **`_gl_party_id_from_payment_row`** so **`payment` / `payment_adjustment` / `journal_entries.payment_id` / `manual_payment`** resolve **`contact_id`**, else **customer/supplier/worker** from **`payments.reference_type` + `reference_id`** (aligns RPC with **`getCustomerLedger`** / supplier AP matching where app used payment→sale graph). Footer **Balance trace** + **G-PAR-02**: row (may be **roll-up**) vs TB on **control id** vs **full Σ** party column vs **residual**; optional **subtree TB** when descendants differ from control id. |
| **Control breakdown** drawer | **GL + operational + residual** | `controlAccountBreakdownService.fetchControlAccountBreakdown` — adds **`glSubtreeDrMinusCr`**, **`partyAttributedGlSum`**, **`unmappedGlByReference`** (RPC `get_control_unmapped_party_gl_buckets`), **`unmappedGlResidual`** with correct AP **Cr−Dr** basis. |
| Contacts **primary** recv/pay | **Operational / contact roll-up** | `get_contact_balances_summary` (RPC) or merged sales/purchases fallback |
| Contacts **GL** subline + violet card line | **GL (party slice, signed)** | `get_contact_party_gl_balances` — **AR/AP** columns are code **1100** / **2000** nets. **Workers:** **`gl_worker_payable`** = **`GREATEST(0, WP−WA)`** per contact (2010 vs 1180 combined in SQL), not “2010 only”; COA party trace for **2010**/**1180** explains this (G-PAR-02c). |
| Contacts **subledger vs GL** strip | **Operational vs TB** | `summaryOperational` vs `getArApGlSnapshot` |
| Accounting **overview** cards (AR/AP) | **Mixed (in-period journal names)** | `AccountingDashboard` `summary` from **display account names** on entries — not TB id-based; compare to Dashboard RPC separately |
| Main **Dashboard** executive AR/AP | **Operational SUM** | `get_financial_dashboard_metrics` / `get_contact_balances_summary` (documented on `Dashboard.tsx`) |
| Party **statements** (customer/supplier/worker) | **GL + operational** per tab | `accountingService.getCustomerLedger` etc.; **G-REV-01** `correction_reversal` inclusion unchanged |

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

**Next:** Human UAT — [COA_UAT_RUNBOOK.md](./COA_UAT_RUNBOOK.md); record results in [COA_QA_SIGNOFF.md](./COA_QA_SIGNOFF.md) §8. Also [COA_GAP_ANALYSIS.md](./COA_GAP_ANALYSIS.md), [COA_FIX_EXECUTION_REPORT.md](./COA_FIX_EXECUTION_REPORT.md).

**Day Book branch (G-BR-02):** **Closed in code** — `DayBookReport` filters `journal_entries` consistently with `getAccountLedger` (null `branch_id` OR selected branch); UI + export metadata state scope.

**Design polish gate:** **NOT certified** until human completes browser QA per [COA_UAT_RUNBOOK.md](./COA_UAT_RUNBOOK.md) and signs **§8** in [COA_QA_SIGNOFF.md](./COA_QA_SIGNOFF.md).
