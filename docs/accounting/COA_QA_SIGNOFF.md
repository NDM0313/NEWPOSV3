# COA + accounting workbench — manual QA signoff

**Date:** 2026-04-05  
**Type:** **Static verification** (repository inspection) + checklist mapping.  
**Not performed in this session:** Interactive manual QA in a running browser against a live company/branch dataset.

**Why this matters:** Pass/fail below distinguishes **CODE VERIFIED** (wiring/query review in `src/`), **NOT RUN** (requires live ERP session), and **GAP** (checklist expectation not met in code).

**Non-goals:** Figma/design; Batch 5; destructive DB work.

**Authoritative procedure refs:** [COA_UAT_RUNBOOK.md](./COA_UAT_RUNBOOK.md) (human pass), [COA_BRANCH_PARITY_CHECKLIST.md](./COA_BRANCH_PARITY_CHECKLIST.md), [ACCOUNTING_WORKBENCH_CLICK_MATRIX.md](./ACCOUNTING_WORKBENCH_CLICK_MATRIX.md).

---

## 1. Screens / surfaces in scope (checklist mapping)

| # | Screen / route (conceptual) | QA method this session |
|---|-----------------------------|-------------------------|
| 1 | Accounting → **Accounts** (COA, operational / professional) | NOT RUN (live); CODE VERIFIED context uses `accountService.getAllAccounts(companyId, branchId)` |
| 2 | Accounting → **Account Statements** (`AccountLedgerReportPage`) | NOT RUN; CODE VERIFIED `branchId` + APIs |
| 3 | Account Statements → **Customer** / **Supplier** / **Worker** modes | NOT RUN; CODE VERIFIED worker + party APIs |
| 4 | Accounting → **Day Book** | NOT RUN (live); **CODE OK** after G-BR-02 fix — `branch_id.is.null` OR selected branch (matches `getAccountLedger`) |
| 5 | Accounting → **Roznamcha** | NOT RUN; CODE VERIFIED `getRoznamcha(..., effectiveBranchId, ...)` |
| 6 | Accounting → **Journal Entries** | NOT RUN; CODE VERIFIED handlers in `AccountingDashboard.tsx` |
| 7 | Reports (enhanced) → **Trial Balance** / **P&amp;L** / **Balance Sheet** | NOT RUN; CODE VERIFIED `branchId` passed into page + service calls |
| 8 | **Payment posting** branch on `journal_entries` / `payments` | NOT RUN (E2E posting not executed) |

---

## 2. Mandatory results summary

### 2.1 Branch parity ([COA_BRANCH_PARITY_CHECKLIST.md](./COA_BRANCH_PARITY_CHECKLIST.md))

| Checklist item | Result | Evidence |
|----------------|--------|----------|
| COA Professional: branch A + global rows | **NOT RUN** | Requires two-branch dataset + UI session |
| COA query wiring | **CODE OK** | `AccountingContext` / `accountService.getAllAccounts` OR filter + fallback (see `accountService.ts`) |
| Account Statements (GL): branch changes numbers | **NOT RUN** | `AccountLedgerReportPage` receives `branchId`; ledger APIs take `branchId` |
| Customer / Supplier statement branch | **NOT RUN** | Same prop chain to `getCustomerLedger` / `getSupplierApGlJournalLedger` |
| Worker statement branch | **NOT RUN** | `getWorkerPartyGlJournalLedger` filters lines by `journal_entries.branch_id` when `branchId` set (service code) |
| Day Book respects branch | **CODE OK** (post G-BR-02) | `DayBookReport.tsx`: when session branch is a UUID, query uses **`.or('branch_id.is.null,branch_id.eq.<uuid>')`**; **All branches** when `branch_id` is `all`/unset — same rule as `getAccountLedger` |
| Roznamcha respects branch | **CODE OK** (integration) | `RoznamchaReport` uses `effectiveBranchId` → `getRoznamcha` |
| Trial Balance: branch affects totals | **NOT RUN** | `TrialBalancePage` calls `getTrialBalance(..., branchId)` |
| Payment flows post intended `branch_id` | **NOT RUN** | No posting executed |

### 2.2 Click / drill-down ([ACCOUNTING_WORKBENCH_CLICK_MATRIX.md](./ACCOUNTING_WORKBENCH_CLICK_MATRIX.md))

| Matrix item | Result | Evidence |
|-------------|--------|----------|
| Statement **Reference** → View (no auto-edit) | **NOT RUN** | Code: `openStatementTransaction(entry_no \|\| journal_entry_id, false)` in `AccountLedgerReportPage.tsx` |
| Statement **View** / **Edit** | **NOT RUN** | Code: dispatches `openTransactionDetail` |
| Journal row click | **NOT RUN** | Code: sets `transactionReference` + optional `selectedGroupEntries` |
| Journal reference click | **NOT RUN** | Code: same pattern |
| **Reverse** flow | **NOT RUN** | Code: `createReversalEntry(entry.id)` |
| Modal open / load by UUID vs `entry_no` | **NOT RUN** | Code: `TransactionDetailModal` + `accountingService` lookups |
| Source document **direct** from statement row | **CODE NOK (by design doc)** | Matrix states **not wired**; expect **Transaction Detail** only |

### 2.3 Reports sanity (spot-check — static only)

| Report | Labels / semantics (static) | Totals / export (static) |
|--------|-----------------------------|---------------------------|
| Trial Balance | NOT RUN | Service-driven; `branchId` forwarded |
| P&amp;L | NOT RUN | `branchId` forwarded |
| Balance Sheet | NOT RUN | `branchId` forwarded |
| Day Book | UI title **Journal Day Book**; visible **Branch scope** strip | Export title: `Journal Day Book ${from} to ${to} – All branches` or `… – Selected branch + company-wide JEs` |
| Roznamcha | Tab title Roznamcha; export title includes **branch label** | `Roznamcha ${dates} – ${selectedBranchLabel}` |

**Export title consistency:** **Improved** — Day Book export title now includes a **branch scope** suffix (aligned with Roznamcha-style metadata). Statement center exports include scope line per implementation pass.

---

## 3. Branch parity — factual finding (code)

**G-BR-02 (closed):** **Day Book** applies session branch using the **same rule as `getAccountLedger`**: all JEs when branch is all/unset; else `journal_entries.branch_id` **null OR** selected branch UUID. UI **Branch scope** strip and export title document this. **Interactive** confirmation is part of human UAT ([COA_UAT_RUNBOOK.md](./COA_UAT_RUNBOOK.md)).

---

## 4. P1 items — outcomes (this pass)

| P1 theme | Outcome |
|----------|---------|
| Parent row balance vs children | **NOT RUN** in UI; **mitigated in code** via `AccountsHierarchyList` roll-up copy/tooltip (see `COA_WORKING_SIGNOFF.md`) |
| Branch parity all entry points | **Code-aligned** for Day Book (G-BR-02 closed). **Interactive** verification still **NOT RUN** |
| Statement engine completeness | **PARTIAL** (implementation exists; interactive validation **NOT RUN**) |
| Source-doc navigation | **INCOMPLETE** by design — direct open from statement rows **not** implemented; matrix documents expectation |

---

## 5. Open gaps (factual)

1. **Interactive manual QA** on a real tenant (two branches, global accounts, payments) — **not executed**.  
2. **Day Book branch filtering** — **addressed in code** (G-BR-02); live confirmation still part of item 1.  
3. **Customer statement vs journal reversal parity** — **addressed in code** (G-REV-01, `correction_reversal` included in `getCustomerLedger` / supplier / worker party GL when the reversed original belonged to the party). **UAT should re-run** the “Receipt from … + Reverse” scenario after deploy.  
4. **Direct source-document** navigation from statement rows — still absent (modal-centric).  
5. **Numeric reconciliation** (TB vs GL, etc.) — **not run** as a formal signoff pass; **G-PAR-02** adds **in-app** trace (residual, subtree, unmapped `reference_type` buckets) once migration `20260405_gl_party_correction_reversal_and_unmapped_buckets.sql` is applied — human UAT should spot-check AR/AP/worker controls vs party list.  
6. **G-PAR-01 (post-fix)** — **CODE VERIFIED** only: Contacts operational vs party GL split in `ContactsPage.tsx`; COA party dropdown parity block wired from `AccountingDashboard` + `fetchControlAccountBreakdown`. **Live** check: one contact with **negative** signed AR on 1100 — card total (operational) must **not** silently add dropped credits; party GL line may show negative; COA party panel should show **residual** ≈ unmapped lines.  
7. **G-PAR-02 (post-fix)** — **CODE VERIFIED** for wiring: breakdown service + drawer + party dropdown **`glParity`**; **NOT RUN** against DB without migration. **Live** checks: (a) **`correction_reversal`** party balance bucket matches statement expectation for a known reversal; (b) unmapped bucket table non-empty only when resolver returns null party on control-code lines; (c) when COA row balance ≠ TB on control id, UI states **roll-up vs direct id** explicitly.  
8. **G-PAR-02b (payment resolver, `20260406_gl_party_resolve_payment_via_sale_purchase.sql`)** — **CODE VERIFIED** (SQL in repo); **NOT RUN** on production from this doc. After DBA apply: re-check **`get_control_unmapped_party_gl_buckets`** for **1100** — **`payment`** bucket should **drop** if historical issue was **`payments.contact_id` null** with sale/purchase link; re-run customer statement vs **`get_contact_party_gl_balances`** for one known receipt. **Agent session did not** confirm migration applied or fill Ali/Mushtaq numeric table (see [COA_FIX_EXECUTION_REPORT.md](./COA_FIX_EXECUTION_REPORT.md) §11).  
9. **G-PAR-02c (AP + worker control parity)** — **AR** tie-out **PASS** on **user-reported** snapshot (control = party sum, residual 0) per [COA_FIX_EXECUTION_REPORT.md](./COA_FIX_EXECUTION_REPORT.md) §12. **AP (2000)** / **worker (2010/1180)** live Rs **not** captured in agent session; **NOT RUN** full Contacts cross-check (ABC, Khuram, worker). **Human UAT:** repeat COA Balance trace for **2000**; for **2010/1180** accept **WP−WA net** label and use breakdown drawer + bucket RPC §5 in [sql/G_PAR02_live_tie_out_queries.sql](./sql/G_PAR02_live_tie_out_queries.sql); re-test **one reversal** on supplier + worker party statements vs journals.  
10. **G-SUP-01 (supplier journal labels + statement consistency)** — **CODE OK** per §13 fix report; **NOT RUN** live Khuram regression in browser from this doc. **Human UAT:** supplier payment JE shows **leaf bank + AP — supplier**; supplier statement **closing** matches last **Balance** column with filters applied.

---

## 6. Final status (this document)

| Gate | Verdict |
|------|---------|
| **READY FOR DESIGN POLISH** (certified) | **NO** until human UAT addendum (**§8**) records pass + signed decision ([COA_UAT_RUNBOOK.md](./COA_UAT_RUNBOOK.md)). |
| Overall module readiness | **PARTIALLY READY** — code includes G-BR-02, G-REV-01, and statement UX; **interactive** signoff still pending. |

**Batch 5:** **NOT APPROVED.**

---

## 7. Sign-off block (for humans)

| Role | Name | Date | Notes |
|------|------|------|-------|
| Manual QA (browser) | *unfilled* | | Execute [COA_UAT_RUNBOOK.md](./COA_UAT_RUNBOOK.md); paste results into **§8** below |
| Product / Finance | *unfilled* | | Sign final readiness in **§8** |

---

## 8. Manual QA addendum (template — fill after UAT)

*Do not pre-fill with assumed results. Copy from runbook §5 when complete.*

**UAT session**

| Field | Value |
|-------|-------|
| Completion date | |
| Environment | |
| Company / branches | |
| Tester | |

**Summary pass/fail**

| Area | Pass / Fail / N/A | Notes |
|------|-------------------|-------|
| COA Professional + branch A/B | | |
| Account Statements — GL | | |
| Account Statements — customer | | |
| Account Statements — supplier | | |
| Account Statements — worker | | |
| Day Book + branch scope | | |
| Roznamcha | | |
| Trial Balance | | |
| Profit & Loss | | |
| Balance Sheet | | |
| Journal Entries — View / Edit / Reverse | | |
| Account Statements — View / Edit | | |
| Payment posting branch (if run) | | |

**Bugs filed** (IDs):  

**Final decision** (check one):

- [ ] **PARTIALLY READY** — blockers or critical paths failed / not run  
- [ ] **READY FOR DESIGN POLISH** — no blockers; residual gaps accepted  

**Sign-off:** Name: _______________  Date: _______________  Role: _______________
