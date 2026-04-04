# COA + accounting workbench — manual QA signoff

**Date:** 2026-04-05  
**Type:** **Static verification** (repository inspection) + checklist mapping.  
**Not performed in this session:** Interactive manual QA in a running browser against a live company/branch dataset.

**Why this matters:** Pass/fail below distinguishes **CODE VERIFIED** (wiring/query review in `src/`), **NOT RUN** (requires live ERP session), and **GAP** (checklist expectation not met in code).

**Non-goals:** Figma/design; Batch 5; destructive DB work.

**Authoritative procedure refs:** [COA_BRANCH_PARITY_CHECKLIST.md](./COA_BRANCH_PARITY_CHECKLIST.md), [ACCOUNTING_WORKBENCH_CLICK_MATRIX.md](./ACCOUNTING_WORKBENCH_CLICK_MATRIX.md).

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

**Gap:** Accounting **Day Book** (`src/app/components/reports/DayBookReport.tsx`) does not apply session `branchId` to the Supabase query on `journal_entries`. Roznamcha and the statement center paths use branch in their respective service/query layers. This is a **documented inconsistency** until product decides “Day Book = company-wide journal” vs “branch-scoped.”

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
3. **Direct source-document** navigation from statement rows — still absent (modal-centric).  
4. **Numeric reconciliation** (TB vs GL, etc.) — **not run**.

---

## 6. Final status (this document)

| Gate | Verdict |
|------|---------|
| **READY FOR DESIGN POLISH** (certified) | **NO** — interactive QA not completed; branch parity **not** fully satisfied in code (Day Book). |
| Overall module readiness | **PARTIALLY READY** — same as pre-QA implementation signoff; QA artifact adds **concrete code gap** and **explicit NOT RUN** list. |

**Batch 5:** **NOT APPROVED.**

---

## 7. Sign-off block (for humans)

| Role | Name | Date | Notes |
|------|------|------|-------|
| Manual QA (browser) | *unfilled* | | Run checklist §2.1–2.2 in staging/production test company |
| Product / Finance | *unfilled* | | Policy: Day Book matches GL ledger branch rule (null `branch_id` + selected branch); confirm in UAT |

When browser QA completes, append a **“Manual QA addendum”** section with dated pass/fail per row.
