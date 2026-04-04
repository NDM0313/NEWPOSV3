# COA & accounting workbench — gap analysis (prioritized)

**Date:** 2026-04-05  
**Related:** [COA_WORKING_SIGNOFF.md](./COA_WORKING_SIGNOFF.md), [COA_FIX_EXECUTION_REPORT.md](./COA_FIX_EXECUTION_REPORT.md), [COA_QA_SIGNOFF.md](./COA_QA_SIGNOFF.md)

---

## 1. Fixed in this pass (see execution report)

| ID | Gap | Resolution |
|----|-----|------------|
| G-EXP-01 | Day Book **PDF/Excel title** incorrectly said “Roznamcha (Day Book)” — wrong semantics for exports | Title set to **Journal Day Book** |
| G-DOC-01 | `AddChartAccountDrawer` name implied legacy `chart_accounts` | File-level comment: persists to **`accounts`** via `chartAccountService` |
| G-STMT-01 | Statement center missing **worker** GL mode vs customer/supplier | **`worker`** type + `getWorkerPartyGlJournalLedger` + worker picker |
| G-STMT-02 | Statement **scope** (period/branch/basis) not visible as one strip | **`StatementScopeBanner`** + export title metadata |
| G-STMT-03 | Account Statements period not aligned with **global** filter | **Dashboard** passes global `startDate`/`endDate` when set |
| G-JRN-01 | Journal list missing **lines count** / **status** / explicit **View** | **Lines**, **Status** (Posted/Reversal), **View** vs **Edit** |
| G-COA-01 | Parent roll-up balance unexplained | **English** microcopy + tooltip on parent rows |
| G-BR-01 | `accounts.branch_id` missing on old DB breaks COA fetch | **`accountService`** retries without branch OR filter |
| G-BR-02 | **Day Book** ignored session branch on `journal_entries` | **`DayBookReport`:** branch filter aligned with `getAccountLedger` — null `branch_id` OR selected branch; scope copy + export title include branch label |

---

## 2. Still pending — important (recommended before “READY FOR DESIGN POLISH”)

| Priority | Gap | Risk | Suggested action |
|----------|-----|------|-------------------|
| P1 | **Parent row balance vs children** | Medium | **Mitigated (UI):** `AccountsHierarchyList` roll-up microcopy + tooltip; **data rule** (zero non-leaf posted balance) still product-owned |
| P1 | **Branch scope** consistency across **all** statement/report entry points from Accounting vs global header | Medium | **G-BR-02 closed in code** (Day Book). **Interactive** branch parity QA still **not run** — [COA_QA_SIGNOFF.md](./COA_QA_SIGNOFF.md) |
| P1 | **Single Statement Engine** (one component for all modes) | Medium | **Partially addressed:** `statementEngineTypes.ts`, `StatementScopeBanner`, worker mode + export metadata on `AccountLedgerReportPage`; see [STATEMENT_ENGINE_SIGNOFF.md](./STATEMENT_ENGINE_SIGNOFF.md) |
| P2 | **Executive overview** inside Accounting vs main Dashboard RPC cards — two surfaces may show different AR/AP basis | Low–Med | Cross-link docs (Phase 2A already labeled payables); ensure Accounting overview copy references basis |
| P2 | **Editability / source doc** — not every row opens underlying sale/purchase without going through Transaction Detail | Med | [ACCOUNTING_WORKBENCH_CLICK_MATRIX.md](./ACCOUNTING_WORKBENCH_CLICK_MATRIX.md) |
| P2 | **Profit & Loss / Balance Sheet** — deep service audit not repeated in this pass | Med | Spot-check `accountingReportsService` + report pages for `accounts` + journals only |
| P3 | **`AccountingChartTestPage`** still hosts `AddChartAccountDrawer` — test-only but name spreads confusion | Low | Rename drawer in a future cleanup PR (not Batch 5) |

---

## 3. Safe to defer (after signoff / with product agreement)

| ID | Item |
|----|------|
| D1 | Full **automated** visual regression for accounting |
| D2 | **Mobile** full parity for statements (companion scope per design docs) |
| D3 | Consolidating **Integrity Lab** into optional admin-only route |
| D4 | Performance tuning for Day Book **500-row** cap |

---

## 4. Next recommended phase (after COA runtime signoff)

1. **Close P1 gaps** with QA + small UI copy/footnote fixes (no Batch 5).  
2. **Optional:** Rename `AddChartAccountDrawer` → `AddCoaAccountDrawer` (repo-only; test imports).  
3. **Then** resume **design polish** (Figma) aligned to [COA_FIGMA_*](./COA_FIGMA_EXECUTION_PACK.md) docs — UI must not reintroduce duplicate semantics.  
4. **Batch 5** remains a **separate** DBA-approved window when/if legacy tables are dropped.

---

## 5. Explicit statement

**Batch 5 remains NOT APPROVED.**
