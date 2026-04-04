# COA & reports — branch parity checklist

**Date:** 2026-04-05  
**Purpose:** QA matrix for branch scope across accounting entry points.  
**Rule of thumb:** `branch_id` **null** on `accounts` = company-wide row; selected branch shows **global + that branch** in COA list (`accountService.getAllAccounts` OR filter).

---

## 1. Implementation notes (confirmed in code)

| Area | Branch behavior |
|------|-----------------|
| **COA list** (`AccountingContext` → `accountService.getAllAccounts`) | When session branch is a UUID, query uses `branch_id.is.null OR branch_id.eq.<branch>`. If DB lacks `branch_id` on `accounts`, service **retries without** branch filter (see `accountService`). |
| **Account Statements** | `branchId` passed into ledger APIs; banner shows “All branches” vs “Current session branch”. |
| **Day Book** | `DayBookReport`: branch filter **aligned with `getAccountLedger`** — all JEs when branch is all/unset; else `branch_id.is.null` OR `branch_id.eq` session UUID. |
| **Roznamcha** | Receive `globalStartDate` / `globalEndDate` from dashboard; `getRoznamcha` uses `effectiveBranchId`. |
| **Trial Balance / P&amp;L / BS** (reports dashboard) | `branchId` prop passed on enhanced reports page — spot-check each sub-page still forwards it. |
| **Worker statement** | `getWorkerPartyGlJournalLedger` filters journal lines by `journal_entries.branch_id` when `branchId` set. |

---

## 2. Manual QA checklist

Run with **two branches** (A and B) and **global accounts** (null `branch_id`):

- [ ] COA **Professional** mode: accounts for A + global visible when branch A selected; switching to B changes branch-tagged rows as expected.  
- [ ] **Account Statements** (GL): balances/movements change when switching branch (or match policy if “all”).  
- [ ] **Customer / supplier** statement: same.  
- [ ] **Worker** statement: worker payments tagged to branch behave correctly.  
- [ ] **Day Book**: rows respect branch filter if applicable.  
- [ ] **Roznamcha**: payments respect branch if applicable.  
- [ ] **Trial Balance**: totals move when branch changes.  
- [ ] **Payment** flows (receive/make): still post with intended `branch_id` on `journal_entries` / `payments`.

---

## 3. Known gaps

- Branch **name** in statement banner is still a simple label from the dashboard (“Current session branch”), not a resolved DB name — optional improvement.  
- Full automated parity tests not added in this pass.

**Batch 5:** NOT APPROVED.
