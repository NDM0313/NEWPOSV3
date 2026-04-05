# COA & accounting workbench — gap analysis (prioritized)

**Date:** 2026-04-05  
**Related:** [COA_WORKING_SIGNOFF.md](./COA_WORKING_SIGNOFF.md), [COA_FIX_EXECUTION_REPORT.md](./COA_FIX_EXECUTION_REPORT.md), [COA_QA_SIGNOFF.md](./COA_QA_SIGNOFF.md), [COA_UAT_RUNBOOK.md](./COA_UAT_RUNBOOK.md) (human browser UAT)

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
| G-REV-01 | **Customer / supplier / worker party GL** ignored **`correction_reversal`** JEs | **`accountingService`:** include AR/AP/WP-WA lines when `reference_type === 'correction_reversal'` and `reference_id` points at an original JE that matched the party filter; customer rows get `document_type: Reversal`, `ledger_kind: 'reversal'` |
| G-PAR-01 | **Silent mixing:** Contacts totals/rows used **party GL** with **`Math.max(0, …)`** while labeled operational → inflated recv. vs AR control when any party has **credit** on 1100; COA **Related parties** vs **control row** not explained | **`ContactsPage`:** primary amounts = **`get_contact_balances_summary`**; **signed** party GL as second line + violet tab totals when map loaded; **subledger vs GL** strip compares operational ↔ TB. **`ChartOfAccountsPartyDropdown` + `AccountingDashboard`:** **Balance trace** block (COA row roll-up vs TB on control id vs sum of party rows + residual). **G-REV-01** unchanged in `accountingService`. |
| G-PAR-02 | **Residual / comparison ambiguity:** TB on control **id** vs **Σ party GL** (RPC attributes only lines on **code** 1100/2000/2010/1180 **account id**) vs COA **row** (parent **roll-up**) left unexplained; **`correction_reversal`** party attribution in **`get_contact_party_gl_balances`** could disagree with **G-REV-01** statement logic | **SQL (non-destructive):** `migrations/20260405_gl_party_correction_reversal_and_unmapped_buckets.sql` — party resolver helper; **`get_contact_party_gl_balances`** attributes **`correction_reversal`** to the **original** JE’s party when `reference_id` is a UUID; **`get_control_unmapped_party_gl_buckets`** groups **unmapped** lines on that control **code only** by `reference_type`. **App:** `controlAccountBreakdownService` adds **subtree TB** (control id + descendants), **full Σ party RPC**, **residual** with correct AP **Cr−Dr** basis, **unmapped** table; **`ControlAccountBreakdownDrawer`** + **`ChartOfAccountsPartyDropdown`** / **`AccountingDashboard`** label **direct control vs subtree** and show top unmapped buckets. **Deploy:** migration must be applied for RPC parity and bucket rows. |
| G-PAR-02b | **Live “payment” unmapped bucket / inflated party residual:** SQL resolver used **`payments.contact_id` only**; **`getCustomerLedger`** also matches **`reference_type=payment`** when the payment id is in the customer’s payment set (often **`payments.reference_id` → `sales.customer_id`** even if **`contact_id` is null**). **`manual_payment`** JEs used **`reference_id` = `payments.id`** but resolver treated that UUID as **`contact_id`**. | **SQL:** `migrations/20260406_gl_party_resolve_payment_via_sale_purchase.sql` — **`_gl_party_id_from_payment_row`** (`contact_id`, else customer/supplier/worker via payment **`reference_type` + `reference_id`**); **`_gl_resolve_party_id_for_journal_entry`** calls it for **`payment` / `payment_adjustment`**, **`payment_id`**, and **`manual_payment`**. Re-run **`get_control_unmapped_party_gl_buckets`** after apply; **payment** bucket should **shrink** when historical rows were sale-linked without `contact_id`. **Verification:** [sql/G_PAR02_live_tie_out_queries.sql](./sql/G_PAR02_live_tie_out_queries.sql). |
| G-PAR-02c | **Worker COA row vs AR/AP “residual” expectation:** Users may expect **2010** / **1180** party panels to show **TB − party sum = residual** like **1100** / **2000**. **`get_contact_party_gl_balances.gl_worker_payable`** is **`GREATEST(0, WP−WA)`** per contact, not 2010-only or 1180-only; breakdown **`unmappedGlResidual`** is **null** for worker kinds. | **Mitigated (UI copy):** `ChartOfAccountsPartyDropdown` labels **Σ party worker net** and explains missing residual vs TB for **2010** / **1180**. **Docs:** [COA_FIX_EXECUTION_REPORT.md](./COA_FIX_EXECUTION_REPORT.md) §12. **AP (2000)** remains AR-symmetric in RPC + residual math. |
| G-SUP-01 | **Supplier payment journal row looked generic; supplier statement totals could disagree with table** | **`convertFromJournalEntry`** + **`getAllEntries`** enrichment (payment + purchase supplier names); **Day Book** **name (code)**; **`AccountLedgerReportPage`** no redundant **`payments.contact_id`** filter for customer/supplier/worker statements; **opening** row always passes filters. See [COA_FIX_EXECUTION_REPORT.md](./COA_FIX_EXECUTION_REPORT.md) §13. |

---

## 2. Still pending — important (recommended before “READY FOR DESIGN POLISH”)

| Priority | Gap | Risk | Suggested action |
|----------|-----|------|-------------------|
| P1 | **Parent row balance vs children** | Medium | **Mitigated (UI):** `AccountsHierarchyList` roll-up microcopy + tooltip; **data rule** (zero non-leaf posted balance) still product-owned |
| P1 | **Branch scope** consistency across **all** statement/report entry points from Accounting vs global header | Medium | **G-BR-02 closed in code** (Day Book). **Interactive** branch parity QA still **not run** — [COA_QA_SIGNOFF.md](./COA_QA_SIGNOFF.md) |
| P1 | **Single Statement Engine** (one component for all modes) | Medium | **Partially addressed:** `statementEngineTypes.ts`, `StatementScopeBanner`, worker mode + export metadata on `AccountLedgerReportPage`; see [STATEMENT_ENGINE_SIGNOFF.md](./STATEMENT_ENGINE_SIGNOFF.md) |
| P2 | **Executive overview** inside Accounting vs main Dashboard RPC cards — two surfaces may show different AR/AP basis | Low–Med | Cross-link docs (Phase 2A already labeled payables); ensure Accounting overview copy references basis |
| P2 | **Per-contact numeric tie-out** (Ali, Mushtaq, …) operational vs party GL | Low–Med | [COA_FIX_EXECUTION_REPORT.md](./COA_FIX_EXECUTION_REPORT.md) §9 + §11: template + **20260406** apply, then fill from tenant SQL/UI; repo stays numeric-free |
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
