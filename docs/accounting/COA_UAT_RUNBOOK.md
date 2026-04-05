# COA + accounting workbench — human UAT runbook

**Purpose:** One structured browser pass on a **real test company with two branches** to support a **READY FOR DESIGN POLISH** decision.  
**Prerequisites:** Tester has Accounting access (e.g. Manager/Admin), non-production or approved test tenant, two branches **A** and **B** configured, at least one **company-wide** (`branch_id` null) account row if your data model uses them.

**Non-goals:** Figma; Batch 5; destructive DB changes; legacy-table validation.

**Related:** [COA_QA_SIGNOFF.md](./COA_QA_SIGNOFF.md) (append addendum after this run), [COA_BRANCH_PARITY_CHECKLIST.md](./COA_BRANCH_PARITY_CHECKLIST.md), [ACCOUNTING_WORKBENCH_CLICK_MATRIX.md](./ACCOUNTING_WORKBENCH_CLICK_MATRIX.md), [COA_WORKING_SIGNOFF.md](./COA_WORKING_SIGNOFF.md), [COA_GAP_ANALYSIS.md](./COA_GAP_ANALYSIS.md), [COA_FIX_EXECUTION_REPORT.md](./COA_FIX_EXECUTION_REPORT.md).

---

## 0. Session record (fill before starting)

| Field | Value |
|-------|-------|
| Date | |
| Environment (URL) | |
| Company name / ID | |
| Branch A name / ID | |
| Branch B name / ID | |
| Tester name | |
| Browser | |

---

## 1. Exact test sequence

Execute **in order**. Use the same **date range** where possible (e.g. current month) so comparisons are meaningful. Set the **global date range** in the app header once, then use **Account Statements** local From/To if you need a narrower window.

| Step | Where to go | What to do |
|------|-------------|------------|
| **1** | Accounting → **Accounts** | Switch to **Professional** (full COA). Note row count / a branch-tagged account if visible. |
| **2** | Header **branch** | Select **Branch A**. Refresh mental baseline: COA still loads; global + branch-tagged accounts visible per your data rules. |
| **3** | Same | Switch to **Branch B**. Expect: list differs from A **if** you have branch-specific accounts; global (null `branch_id`) rows still appear if policy says so. |
| **4** | Accounting → **Account Statements** | Statement type **General Ledger**. Pick one account with movement. Set **From / To** if needed. Note opening/closing and row count. |
| **5** | Same | With **Branch A** selected, note totals / rows. Switch to **Branch B**, then **All branches** (if available). Expect amounts or row sets to change when branch context changes (unless all JEs are global). |
| **6** | Same | Statement type **Customer Statement** — pick a contact with AR activity. Verify lines and balance look reasonable. Repeat branch A vs B vs all (as above). After **Reverse** on a receipt (step 15), re-open this statement: **running balance must match journal net** (`correction_reversal` / **Reversal** rows included). |
| **7** | Same | **Supplier Statement** — same as customer for AP. |
| **8** | Same | **Worker Statement** — pick a worker with WP/WA activity (if none, mark N/A in log). Branch switch sanity check. |
| **9** | Accounting → **Day Book** | Read **Branch scope** strip. With **All branches**: expect all-company journal lines in range. With **Branch A**: expect **selected branch + company-wide JEs** (null `branch_id`), per policy. Compare row set to GL statement for same range if useful. |
| **10** | Accounting → **Roznamcha** | Branch A: rows/payments scoped to branch. Branch B: different set if data exists. Export title includes branch label. |
| **11** | **Reports** (enhanced dashboard) → **Trial Balance** | Same period as above. Branch A vs B vs all: totals change when branch-relevant. |
| **12** | Same → **Profit & Loss** | Labels in English; subtotals render; branch switch behaves consistently. |
| **13** | Same → **Balance Sheet** | As of date + branch; no obvious crash; figures load. |
| **14** | Accounting → **Journal Entries** | Open one row (**View**): modal loads, no auto-edit. **Edit** (if permitted): unified editor opens. **Reference** link: opens detail. |
| **15** | Same | **Reverse** on a reversible row (test data only): confirm prompt, reversal posts or expected error. |
| **16** | Account Statements | On a line with **View** / **Edit**: confirm **Transaction detail** opens; **Edit** launches editor when allowed. |
| **17** | **Payment posting** (optional) | If safe in this tenant: post **Receive** or **Make payment** on **Branch A**, then confirm new `journal_entries` / `payments` carry **branch_id** = A (inspect via Journal Entries or DB read-only). Repeat on B if feasible. |

---

## 2. Expected result per screen (quick reference)

| Screen | Expected |
|--------|----------|
| **COA Professional** | Loads without error; branch switch updates visible accounts per OR rule (global + selected branch). |
| **Account Statements (GL)** | Scope banner + period; debits/credits/balance; branch switch affects data when JEs are branch-specific. |
| **Customer / Supplier / Worker** | Correct party picker; lines after Apply; no blank error for valid party. **Customer:** after a posted **correction_reversal** on a receipt JE, statement shows **Reversal** lines and net agrees with Journal Entries. |
| **Day Book** | Title **Journal Day Book**; scope strip matches session branch; export/PDF title includes date range + branch scope suffix. |
| **Roznamcha** | Cash in/out table English; branch filter applied; export metadata consistent. |
| **Trial Balance** | Balanced or known tolerance; branch changes totals when applicable. |
| **P & L** | Revenue/expense sections sensible; branch respected. |
| **Balance Sheet** | Assets = Liabilities + Equity within tolerance or explain variance. |
| **Journal Entries** | View vs Edit behavior per [click matrix](./ACCOUNTING_WORKBENCH_CLICK_MATRIX.md); Reverse creates offset or clear error. |
| **Payments** | Posted JE/payment rows show expected **branch_id** for the session branch used at post time. |

---

## 3. Pass / fail template (copy per step)

```
Step: ___
Screen: ___
Branch / date context: ___
Pass / Fail / N/A: ___
Notes (1 line): ___
```

---

## 4. Bug capture template

```
ID: UAT-___
Step ref: §1 step ___
Severity: Blocker / Major / Minor / Cosmetic
Summary:
Steps to reproduce:
Expected:
Actual:
Branch / company:
Screenshot or ref:
```

---

## 5. Final decision template (for `COA_QA_SIGNOFF.md` addendum)

Fill **one** overall outcome:

```
UAT completion date: ___
Tester: ___
Blockers (Y/N): ___  (If Y, list UAT- IDs: ___)

Branch parity (interactive): Pass / Fail / Pass with notes
Click / drill-down matrix: Pass / Fail / Pass with notes  
Reports sanity (TB / P&L / BS / Day Book / Roznamcha): Pass / Fail / Pass with notes
Payment branch posting (if executed): Pass / Fail / N/A

Known accepted gaps (from COA_GAP_ANALYSIS — not blockers for polish):
- e.g. source doc not opened directly from statement row: accepted Y/N

FINAL READINESS (choose one):
[ ] PARTIALLY READY — material bugs or untested critical paths remain
[ ] READY FOR DESIGN POLISH — no blockers; remaining gaps documented and accepted by product/finance

Signed: _____________  Date: ___
```

---

## 6. After UAT

1. Paste completed **§5** (and summarized §3 log) into [COA_QA_SIGNOFF.md](./COA_QA_SIGNOFF.md) **§8 — Manual QA addendum**.  
2. If **READY FOR DESIGN POLISH**, update [COA_WORKING_SIGNOFF.md](./COA_WORKING_SIGNOFF.md) §9 and [COA_GAP_ANALYSIS.md](./COA_GAP_ANALYSIS.md) P1 rows only with **factual** outcomes.

**Batch 5:** NOT APPROVED.
