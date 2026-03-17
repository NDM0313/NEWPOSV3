# ERP Final Execution Plan + Cursor Agent Prompt

Source reviewed:
- ERP_COA_REVIEW_AND_ISSUES_TRACKER_v4.md

Date: 2026-03-17
Project: ERP Master / NEWPOSV3
Purpose: Convert the long issue tracker into one final execution plan that can be given to Cursor/agent for controlled implementation.

---

## 1) Final reading of current state

The ERP UI is usable, but accounting and workflow consistency are still not safe enough for final production close.

Three major issue groups are open:
1. Accounting core / COA / reporting
2. Studio lifecycle / cost / worker sync
3. Rental transaction-safety / payment idempotency / summary mismatch

This means the correct next move is not random UI polish.
The correct next move is a controlled stabilization + acceptance phase.

---

## 2) Final target architecture (must not change anymore)

### Canonical master tables
- `accounts`
- `journal_entries`
- `journal_entry_lines`
- `payments`
- `couriers`
- `contacts`

### Legacy / overlap candidates (do not use for new posting)
- `chart_accounts`
- `document_sequences`
- `document_sequences_global`
- any old/manual/parallel posting path that creates JE without canonical payment link

### Ledger principle
- AR = customer balances only
- AP = supplier balances only
- Courier payable = separate control + children
- Shipping charged to customer != actual courier cost
- Inventory must hit balance sheet
- Sale must hit revenue + COGS

---

## 3) Duplicate / overlap list to treat carefully

## A. Real duplicate / overlap candidates
1. Duplicate active account names inside `accounts`
   - examples already seen earlier in audits: Accounts Receivable, Bank, Extra Expense, DHL/DHS payable style duplicates
2. Legacy COA overlap
   - `accounts` vs `chart_accounts`
3. Legacy numbering overlap
   - `erp_document_sequences` vs `document_sequences` vs `document_sequences_global`
4. Courier master overlap
   - `couriers` vs courier-reporting views vs courier payable child accounts
5. Parallel posting paths
   - main module flow vs Add Entry / manual flow vs old test/repair/backfill paths

## B. Not true duplicates (but confusing if not documented)
1. `Courier Payable (Control)` plus courier child accounts
   - this is hierarchy, not duplicate
2. Courier reports views
   - reporting layer, not master data
3. Inventory valuation tables/reports
   - supporting layer, but currently not fully integrated into financial statements
4. Supplier/customer/worker ledgers
   - reporting/ledger sync layer, not COA master

---

## 4) Final execution order (strict)

## Phase 1 — Accounting Freeze
Goal: Stop architecture drift.

Tasks:
1. Freeze canonical posting engine
2. Freeze source-of-truth tables
3. Freeze payment reference generation to one path
4. Mark legacy objects as DO NOT USE FOR NEW POSTING
5. Remove or disable old test/demo/manual parallel paths if still active

Deliverables:
- `docs/accounting/ACCOUNTING_FREEZE_FINAL.md`
- `docs/accounting/CANONICAL_TABLE_MATRIX.md`
- `docs/accounting/LEGACY_OBJECT_FREEZE.md`

---

## Phase 2 — Accounting Core Reconciliation
Goal: Make books mathematically correct.

Tasks:
1. Fix shipping billed-to-customer sync
   - invoice total
   - customer ledger debit
   - due amount
   - printed invoice
2. Clean AP / AR contamination
3. Fix Trial Balance imbalance
4. Fix Balance Sheet imbalance
5. Fix dashboard cards vs P&L mismatch
6. Fix JE type labels
7. Fix Sales Profit report
8. Fix COGS posting
9. Fix inventory asset on balance sheet
10. Fix rental accounting visibility in P&L / summaries if backend postings already exist

Deliverables:
- `docs/accounting/ACCOUNTING_RECONCILIATION_REPORT.md`
- `docs/accounting/TB_BS_REPAIR_LOG.md`
- `docs/accounting/SHIPPING_POSTING_RULE_LOCK.md`
- `docs/accounting/INVENTORY_COGS_INTEGRATION.md`

Acceptance gate:
- Trial Balance difference = 0
- Balance Sheet difference = 0
- P&L matches dashboard cards
- Shipping income/expense/customer billing all reconcile

---

## Phase 3 — Studio Lifecycle Hardening
Goal: Studio must become transaction-safe.

Tasks:
1. Fix custom task persistence
2. Define post-invoice lock vs amendment model
3. Fix cost re-sync after worker/stage edits
4. Fix Convert to Final duplicate behavior
5. Persist pricing/profit values
6. Disable shipping until final state
7. Fix worker payment summary sync
8. Separate studio direct labor from generic expense accounts

Deliverables:
- `docs/studio/STUDIO_LIFECYCLE_LOCK.md`
- `docs/studio/STUDIO_COST_SYNC_RULES.md`
- `docs/studio/STUDIO_FINAL_CONVERSION_RULE.md`

Acceptance gate:
- no duplicate studio sale on final conversion
- no stale worker totals
- no generic salary hitting studio direct production account

---

## Phase 4 — Rental Workflow Hardening
Goal: Rental must become idempotent and accounting-safe.

Tasks:
1. Canonical advance payment flow
2. Canonical remaining payment flow
3. Idempotent pickup confirmation
4. Prevent duplicate pickup settlement posting
5. Replace delete with void/reverse
6. Fix rental customer ledger summary cards
7. Fix rental JE type labels
8. Make validation messages explicit in pickup modal
9. Add rental profit / summary visibility in reporting if backend postings exist

Deliverables:
- `docs/rental/RENTAL_PAYMENT_MODEL.md`
- `docs/rental/RENTAL_PICKUP_IDEMPOTENCY.md`
- `docs/rental/RENTAL_REVERSAL_RULES.md`

Acceptance gate:
- same pickup event cannot post twice
- removing/voiding rental payment reverses accounting cleanly
- rental summary cards match detail rows

---

## Phase 5 — Product / Transaction Safety Controls
Goal: Stop integrity damage from later edits.

Tasks:
1. Product type lock after save
2. Linked delete protection
3. Activate/deactivate instead of delete
4. Purchase edit repost / reverse-post logic
5. Return Sale and Return Purchase full accounting test

Deliverables:
- `docs/products/PRODUCT_TYPE_LOCK.md`
- `docs/products/LINKED_DELETE_PROTECTION.md`
- `docs/purchases/PURCHASE_EDIT_REPOST_RULE.md`
- `docs/returns/RETURN_FLOW_ACCEPTANCE.md`

---

## Phase 6 — Final Acceptance Testing
Goal: One final close checklist for the whole ERP.

Mandatory full test pack:
1. Sale (cash)
2. Sale (credit)
3. Sale with shipping charged to customer
4. Purchase
5. Purchase with extra landed cost
6. Customer receipt
7. Supplier payment
8. Worker payment
9. Expense payment
10. Courier payment
11. Internal transfer
12. Pure journal
13. Studio order → invoice → payment
14. Rental booking → advance → pickup → return
15. Return sale
16. Return purchase

For each test verify:
- payments row
- JE + JE lines
- `payment_id` link
- Day Book
- Roznamcha
- right ledger
- no duplicate posting
- correct summary card impact
- correct TB / BS / P&L effect

Deliverables:
- `docs/acceptance/ERP_FINAL_ACCEPTANCE_CHECKLIST.md`
- `docs/acceptance/ERP_SIGNOFF_REPORT.md`

---

## 5) Final “do not do” list

Do NOT:
- create another parallel posting flow
- keep raw test reference types in production posting
- use `chart_accounts` as live master
- let AP contain sales/customer activity
- let AR contain purchases/supplier activity
- hard delete posted financial entries without reverse logic
- show internal backend expense accounts in user-facing expense pickers
- show courier child accounts in default clean COA view

---

## 6) Strong Cursor / Agent Prompt

Use the following prompt as the implementation prompt:

---

You are working on ERP Master / NEWPOSV3.

Read and follow these documents as the primary issue source:
1. `ERP_COA_REVIEW_AND_ISSUES_TRACKER_v4.md`
2. `ERP_FINAL_EXECUTION_PLAN_AND_CURSOR_PROMPT.md`

Your job is NOT to do random refactors.
Your job is to execute a controlled stabilization program.

## Non-negotiable target architecture
- Canonical COA master: `accounts`
- Canonical posting tables: `journal_entries`, `journal_entry_lines`, `payments`
- Canonical courier master: `couriers` linked with `contacts` and `accounts`
- Treat `chart_accounts`, `document_sequences`, `document_sequences_global` as legacy / overlap candidates, not live masters
- No new parallel posting path is allowed

## Required implementation mode
1. First create/update documentation files for freeze, reconciliation, studio lifecycle, rental lifecycle, and acceptance checklist.
2. Then fix backend posting and reporting issues phase by phase.
3. After each phase, add verification SQL and an execution report.
4. Do not silently change accounting rules. If a rule must change, document it first.
5. Every financial write must be idempotent where retries are possible.
6. Every posted payment-related event must have exactly one canonical payment row and one canonical JE link where applicable.

## Priority order
### Phase 1 — Accounting Freeze
- Freeze canonical tables and posting rules
- Mark legacy objects as do-not-use
- Remove/disable old test/demo posting paths

### Phase 2 — Accounting Core Reconciliation
Fix these first:
- shipping charged-to-customer sync to invoice/customer ledger
- AP/AR contamination
- Trial Balance not balancing
- Balance Sheet not balancing
- dashboard cards not matching P&L
- wrong JE type labels
- Sales Profit report broken
- COGS missing
- inventory missing from financial statements
- rental postings not fully visible in P&L/summaries where backend already posts

Acceptance for Phase 2:
- TB difference = 0
- Balance Sheet difference = 0
- dashboard cards = verified report totals

### Phase 3 — Studio Lifecycle Hardening
Fix:
- custom task persistence
- post-invoice lock/amendment rule
- worker/stage cost re-sync
- Convert to Final duplicate issue
- pricing/profit persistence
- disable shipping until final
- worker payment summary sync
- generic salary contamination of studio production cost account

### Phase 4 — Rental Workflow Hardening
Fix:
- canonical advance payment
- canonical remaining payment
- pickup confirmation idempotency
- duplicate pickup payment posting
- delete→reverse/void flow
- rental ledger summary mismatch
- rental JE label cleanup
- modal validation clarity
- rental profit/summaries visibility

### Phase 5 — Product / Transaction Safety Controls
Fix:
- product type lock
- linked delete protection
- activate/deactivate flow
- purchase edit reverse/repost
- return sale + return purchase final accounting acceptance

### Phase 6 — Final Acceptance
Build a single final acceptance checklist and pass all end-to-end transaction tests.

## Required outputs in repository
Create/update these files while working:
- `docs/accounting/ACCOUNTING_FREEZE_FINAL.md`
- `docs/accounting/CANONICAL_TABLE_MATRIX.md`
- `docs/accounting/LEGACY_OBJECT_FREEZE.md`
- `docs/accounting/ACCOUNTING_RECONCILIATION_REPORT.md`
- `docs/accounting/TB_BS_REPAIR_LOG.md`
- `docs/accounting/SHIPPING_POSTING_RULE_LOCK.md`
- `docs/accounting/INVENTORY_COGS_INTEGRATION.md`
- `docs/studio/STUDIO_LIFECYCLE_LOCK.md`
- `docs/studio/STUDIO_COST_SYNC_RULES.md`
- `docs/studio/STUDIO_FINAL_CONVERSION_RULE.md`
- `docs/rental/RENTAL_PAYMENT_MODEL.md`
- `docs/rental/RENTAL_PICKUP_IDEMPOTENCY.md`
- `docs/rental/RENTAL_REVERSAL_RULES.md`
- `docs/products/PRODUCT_TYPE_LOCK.md`
- `docs/products/LINKED_DELETE_PROTECTION.md`
- `docs/purchases/PURCHASE_EDIT_REPOST_RULE.md`
- `docs/returns/RETURN_FLOW_ACCEPTANCE.md`
- `docs/acceptance/ERP_FINAL_ACCEPTANCE_CHECKLIST.md`
- `docs/acceptance/ERP_SIGNOFF_REPORT.md`

## Required discipline
- No destructive table drop unless separately documented and approved
- No silent accounting logic changes
- No new temporary posting hack
- No UI polish before posting/report integrity
- Prefer reverse/repost over hard edit for posted accounting data
- Keep company-scoping and branch-scoping intact

## First thing to do now
1. Read both source documents.
2. Produce a concise duplicate/overlap classification table.
3. Produce the Accounting Freeze docs.
4. Start Phase 2 reconciliation work.
5. After each sub-fix, provide exact SQL verification and pass/fail result.

---

## 7) Final recommendation

Do not try to solve everything in one uncontrolled batch.
Use this exact order:
1. Freeze
2. Accounting reconcile
3. Studio harden
4. Rental harden
5. Product safety
6. Final acceptance

That is the safest way to close the ERP without creating new accounting damage.
