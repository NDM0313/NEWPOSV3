# COA runtime signoff — fix execution report

**Date:** 2026-04-05  
**Scope:** Narrow, traceable fixes + documentation from the COA **working signoff** pass.  
**Not in scope:** Design/Figma; Batch 5; DB migrations; legacy table drops.

---

## 1. Summary

| Item | Result |
|------|--------|
| **Runtime legacy-table paths in audited `src/`** | **None found** (`chart_accounts`, `ledger_master`, `ledger_entries` not used for queries) |
| **Fixes applied (code)** | **2** (initial pass) + **implementation pass** below |
| **Docs created / updated** | `COA_WORKING_SIGNOFF.md`, `COA_GAP_ANALYSIS.md`, `STATEMENT_ENGINE_SIGNOFF.md`, `COA_BRANCH_PARITY_CHECKLIST.md`, `ACCOUNTING_WORKBENCH_CLICK_MATRIX.md`, `COA_QA_SIGNOFF.md`, this file |

---

## 2. Fixes applied

### 2.1 Day Book export title (semantic bug)

- **File:** `src/app/components/reports/DayBookReport.tsx`  
- **Issue:** Export `title` was `Roznamcha (Day Book) …` while the report is **journal lines** (GL), not the Roznamcha cash book (`payments`). Mislabels PDF/Excel and violates the **Roznamcha vs Day Book** distinction.  
- **Change:** `title` → `Journal Day Book ${dateFrom} to ${dateTo}` with an inline comment.  
- **UI title** was already `Journal Day Book` via `ReportActions` — unchanged.

### 2.2 AddChartAccountDrawer documentation

- **File:** `src/app/components/accounting/AddChartAccountDrawer.tsx`  
- **Issue:** Component name suggests legacy `chart_accounts`; implementation uses **`chartAccountService` → `accountService` → `accounts`**.  
- **Change:** Module comment stating canonical persistence target (**no behavior change**).

### 2.3 Statement center + workbench (2026-04-05 implementation pass)

- **`src/app/lib/accounting/statementEngineTypes.ts`** — Shared `AccountingStatementMode` + labels for statement center.  
- **`src/app/components/reports/StatementScopeBanner.tsx`** — Period / branch scope / basis strip.  
- **`src/app/components/reports/AccountLedgerReportPage.tsx`** — **Worker Statement** (`getWorkerPartyGlJournalLedger`), **View** + **Edit** row actions (prefer `entry_no` for View), **Branch** column, export title includes scope, `branchScopeLabel` prop, `studioService` workers list.  
- **`src/app/components/accounting/AccountingDashboard.tsx`** — Account Statements period uses **global filter** dates when set; passes `branchScopeLabel`; journal table **Lines** + **Status** + **View** action.  
- **`src/app/services/accountService.ts`** — If `branch_id` filter fails (older schema), **retry without** branch OR clause.  
- **`src/app/components/accounting/AccountsHierarchyList.tsx`** — Clearer English **roll-up** microcopy + tooltip on parent balances.

### 2.4 Day Book branch scope (G-BR-02)

- **File:** `src/app/components/reports/DayBookReport.tsx`  
- **Issue:** Day Book loaded all `journal_entries` for the company in range with **no** branch predicate, unlike GL ledger / statements.  
- **Policy (explicit):** **Branch-aware**, using the **same rule as `accountingService.getAccountLedger`**: when the session branch is a specific UUID, include rows where `journal_entries.branch_id` is **null** (company-wide) **or** equals that branch; when branch is **all** / unset, show **all branches**.  
- **Change:** PostgREST `.or('branch_id.is.null,branch_id.eq.<uuid>')` when applicable; **Branch scope** UI strip; export **title** suffix (`All branches` vs `Selected branch + company-wide JEs`).

---

## 3. What was already correct

- **COA list** driven from **`accounts`** via `AccountingContext` / `accountService`.  
- **Day Book** queries **`journal_entries`** + **`journal_entry_lines`** + embedded **`accounts`**.  
- **Roznamcha** uses **`payments`** + **`accounts`** (`roznamchaService`).  
- **Trial Balance** uses **`accountingReportsService`** (canonical GL).  
- **Worker** paths use **`worker_ledger_entries`**, not legacy **`ledger_entries`**.  
- **`accountingCanonicalGuard`** continues to block legacy table names as UI truth in dev.

---

## 4. What was broken (before fixes)

| ID | Description | Severity |
|----|-------------|----------|
| B1 | Mislabeled **Day Book** export title as Roznamcha | **Medium** (trust / reconciliation confusion) |
| B2 | **Naming/documentation** drift on AddChartAccountDrawer | **Low** (maintainer / audit confusion) |

---

## 5. What still remains

See **[COA_GAP_ANALYSIS.md](./COA_GAP_ANALYSIS.md)** — notably parent balance **interpretation**, **interactive branch** parity QA, unified **statement** UX, and full **edit** click-matrix. **G-BR-02** (Day Book branch) is **closed in code**.

---

## 6. COA readiness gate (this pass)

| Status | **PARTIALLY READY** |
|--------|----------------------|
| Rationale | Canonical **code paths** verified; statement center + branch fallback + COA roll-up copy + journal columns shipped; **no** full production E2E or numeric reconciliation run in this pass. |

**Not:** READY FOR DESIGN POLISH — [COA_QA_SIGNOFF.md](./COA_QA_SIGNOFF.md) records **interactive manual QA not executed**. **G-BR-02** is fixed in code; human browser QA still required before certifying design polish.

---

## 7. Batch 5

**NOT APPROVED** — no destructive DB work in this pass.
