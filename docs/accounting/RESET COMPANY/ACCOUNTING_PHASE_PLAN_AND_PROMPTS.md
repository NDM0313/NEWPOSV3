# ERP Accounting Fix — Phase-by-Phase Plan + Cursor Prompts

## Purpose
This file converts the existing accounting audit docs into one practical execution plan.
The goal is to stop patch-based fixing and move to a **blueprint-first accounting rebuild**.

This plan is based on the uploaded audit docs, especially:
- ACCOUNTING_ARCHITECTURE_AUDIT.md
- ACCOUNTING_ENGINE_AUDIT.md
- ACCOUNTING_SOURCE_LOCK.md
- DATA_AND_LEDGER_RULES.md
- ERP_COA_REVIEW_AND_ISSUES_TRACKER_v4.md
- ERP_GOLDEN_RULE_ACCOUNTING.md
- SUPPLIER_LEDGER_DATA_FLOW.md

---

# 1. Final non-negotiable accounting rules

## 1.1 Canonical source-of-truth lock
These must be treated as final live sources unless phase work explicitly changes them:

- **Chart of Accounts:** `accounts`
- **Journal / Day Book:** `journal_entries`, `journal_entry_lines`
- **Roznamcha / cash-bank movement:** `payments`
- **Worker ledger:** `worker_ledger_entries`
- **Supplier/User ledger UI:** `ledger_master`, `ledger_entries`
- **Payment numbering:** `erp_document_sequences`

Do **not** keep mixing legacy sources into live reporting.

## 1.2 Golden rule
Only **final / posted** documents affect:
- accounting
- stock
- receivables / payables
- reports
- dashboard totals
- payment eligibility

Draft / quotation / temporary data must not affect accounting.

## 1.3 Component isolation rule
On edit, only the changed component can adjust.

Examples:
- discount changed -> only discount delta
- payment changed -> only payment delta
- freight changed -> only freight / landed cost delta
- items changed -> only item/inventory/revenue/payable delta
- unchanged components must remain untouched

## 1.4 No blanket reversal
Never reverse the whole sale or purchase just because one component changed.

## 1.5 Live-data rule
Fixes are not only for future transactions.
Current live inserted data must also be reconciled and corrected.

---

# 2. Main diagnosis from the docs

## 2.1 Root problem
The accounting system is failing because multiple layers are not following one single accounting contract:

- COA mapping not fully locked
- document workflow not fully locked
- edit engine not isolated by component
- supplier/customer ledger source differs from GL source
- reports read mixed truths
- inventory valuation does not fully reconcile with stock and GL

## 2.2 Current repeated symptoms
- purchase edit reverses payment when payment was not changed
- sale edit touches unrelated components
- discount / shipping / extra expense go to wrong accounts in some cases
- supplier ledger and GL diverge
- inventory valuation report shows wrong names / wrong valuation source
- trial balance / P&L / balance sheet / accounts screen do not reconcile
- duplicate-looking accounts appear in operations view

## 2.3 What must stop
Do not continue isolated fixes like:
- “sale patch only”
- “purchase patch only”
- “report patch only”
- “ledger UI patch only”

That approach has already caused repeated breakage.

---

# 3. Target accounting contract

## 3.1 Sale target
### Sale create
- Credit sale: Dr Accounts Receivable / Cr Sales Revenue
- Cash sale: Dr Cash/Bank / Cr Sales Revenue

### Sale payment
- Dr Cash/Bank/Wallet / Cr Accounts Receivable

### Sale discount
- Dr Discount Allowed / Cr Accounts Receivable or contra-revenue flow according to final locked contract

### Shipping charged to customer
- Dr Accounts Receivable or Cash / Cr Shipping Income

### Sale-side extra expense (if charged separately)
- Must hit one explicit fixed account only
- Must not silently distort AP/AR

### Sale edit
- Revenue delta only if items/subtotal changed
- Discount delta only if discount changed
- Shipping delta only if shipping changed
- Extra expense delta only if extra changed
- Payment untouched unless payment changed

## 3.2 Purchase target
### Purchase create
- Dr Inventory / Cr Accounts Payable

### Purchase freight / labor / landed cost
Choose and lock one rule:
- either capitalize into Inventory
- or post to explicit purchase cost account

But do it consistently.

### Purchase discount
Choose and lock one rule:
- reduce payable only
- or reduce inventory value
- or use Purchase Discount account

But do it consistently.

### Purchase payment
- Dr Accounts Payable / Cr Cash/Bank/Wallet

### Purchase edit
- item delta only if items/subtotal changed
- discount delta only if discount changed
- freight/labor/extra delta only if changed
- payment untouched unless payment changed

## 3.3 Inventory target
- stock quantity source and valuation source must be consistent
- product / variant naming must resolve correctly
- inventory valuation report, stock screen, and balance sheet inventory must agree

---

# 4. Phase-by-phase execution plan

## Phase 0 — Freeze and Blueprint Lock
### Goal
Stop random patching. Create one formal accounting blueprint from the docs and current DB behavior.

### Must produce
- `ACCOUNTING_BLUEPRINT.md`
- source-of-truth table map
- component-to-GL mapping table
- workflow contract per module
- report source contract

### Acceptance
No code refactor starts until blueprint is signed off.

### Cursor Prompt
```text
PROJECT: PHASE 0 — ACCOUNTING BLUEPRINT LOCK
You have full access to VPS, DB, app code, and docs.
Read all uploaded accounting docs first.
Do not patch code yet.
Create one final ACCOUNTING_BLUEPRINT.md that locks:
1. canonical source-of-truth tables
2. chart-of-accounts mapping per component
3. workflow rules for sale, purchase, payment, returns, edit
4. reporting source rules
5. component-level edit isolation rules
6. legacy/overlap tables to deprecate from live reporting
Also validate the blueprint against current DB schema and current code paths.
Deliver blueprint, gap list, and sign-off checklist.
```

---

## Phase 1 — Source Lock Enforcement
### Goal
Make sure all code uses the same accounting sources.

### Fixes
- lock COA to `accounts`
- lock journal to `journal_entries` + `journal_entry_lines`
- lock payment movement to `payments`
- lock worker ledger to `worker_ledger_entries`
- prevent reports from using legacy overlapping tables
- classify `ledger_master` / `ledger_entries` as UI ledger layer, not GL truth

### Acceptance
No report or module should be able to mix old/legacy accounting tables into live calculations.

### Cursor Prompt
```text
PROJECT: PHASE 1 — ACCOUNTING SOURCE LOCK ENFORCEMENT
Using the approved blueprint, audit every accounting and reporting query.
Enforce source lock:
- COA = accounts
- Journal = journal_entries + journal_entry_lines
- Roznamcha = payments
- Worker ledger = worker_ledger_entries
- Payment numbering = erp_document_sequences
- Supplier/User UI ledger = ledger_master + ledger_entries only where intended
Remove or isolate any legacy or overlapping source from live calculations.
Deliver exact files changed, source-lock matrix, and verification results.
```

---

## Phase 2 — Chart of Accounts Cleanup and Mapping Lock
### Goal
Lock all component mappings to one correct GL contract.

### Fixes
- sale revenue mapping
- purchase inventory / payable mapping
- discount mapping
- shipping income mapping
- shipping expense / courier payable mapping
- freight / labor / extra expense mapping
- worker payable / courier payable / rental advance etc.
- detect duplicate operational accounts (e.g. Extra Expense duplicates)

### Acceptance
Every business component must map to one explicit GL rule.

### Cursor Prompt
```text
PROJECT: PHASE 2 — CHART OF ACCOUNTS MAPPING LOCK
Using ACCOUNTING_BLUEPRINT.md, audit and fix the live GL mappings.
Tasks:
1. map each sale/purchase/payment/discount/shipping/freight/labor/extra-expense component to one fixed GL path
2. detect duplicate-looking accounts and classify whether they are accidental duplicates or intentional distinct accounts
3. fix account listing and balance queries so one logical account does not appear twice incorrectly
4. update docs with final mapping matrix
Do not continue with posting logic changes until mappings are finalized.
```

---

## Phase 3 — Payment Isolation Engine
### Goal
Make payment a completely isolated accounting component.

### Fixes
- payment create = payment JE only
- payment edit = payment delta only
- payment reverse/delete = payment reversal only
- document edit must never reverse payment unless payment itself changed
- stop nonsense history lines like “payment edited from 33000 to 33000”

### Acceptance
If payment untouched, payment accounting untouched.

### Cursor Prompt
```text
PROJECT: PHASE 3 — PAYMENT ISOLATION ENGINE
Implement strict payment isolation.
Payment must be its own accounting component.
Rules:
- payment create posts only payment accounting
- payment edit posts only payment delta
- payment reverse/delete posts only payment reversal
- sale/purchase edit must not touch payment unless payment row changed
Also fix payment history logging so no fake or zero-delta payment edit events remain.
Repair current live data where payment was wrongly reversed or reposted due to document edit.
Deliver files changed, repair SQL, and verification scenarios.
```

---

## Phase 4 — Sale Engine Rebuild
### Goal
Rebuild sale accounting strictly by components.

### Fixes
- sale create
- sale item delta
- sale discount delta
- sale shipping delta
- sale extra expense delta
- sale payment isolation
- customer receivable correctness
- customer ledger / GL / reports reconciliation

### Acceptance
For sale edit, only changed sale components adjust. Payment untouched unless payment changed.

### Cursor Prompt
```text
PROJECT: PHASE 4 — SALE ACCOUNTING ENGINE REBUILD
Rebuild the sale engine from the locked blueprint.
Use strict component-level accounting:
- item/subtotal change -> revenue/AR/inventory-related delta only
- discount change -> discount delta only
- shipping change -> shipping delta only
- extra expense change -> extra-expense delta only
- payment untouched unless payment changed
Repair current live sale data and verify against existing records such as SL-0006 or equivalent live cases.
Reconcile:
- sale detail
- customer ledger
- accounts
- day book
- trial balance
- profit & loss
- balance sheet
Deliver result doc, verification SQL, and before/after reconciliation.
```

---

## Phase 5 — Purchase Engine Rebuild
### Goal
Rebuild purchase accounting strictly by components.

### Fixes
- purchase create
- purchase item/subtotal delta
- purchase discount delta
- purchase freight/labor/extra-expense delta
- purchase payment isolation
- supplier ledger / GL / reports reconciliation

### Acceptance
For purchase edit, only changed purchase components adjust. Payment untouched unless payment changed.

### Cursor Prompt
```text
PROJECT: PHASE 5 — PURCHASE ACCOUNTING ENGINE REBUILD
Rebuild the purchase engine from the locked blueprint.
Use strict component-level accounting:
- item/subtotal change -> inventory/payable delta only
- discount change -> discount/payable/inventory delta only according to final mapping
- freight/labor/extra expense change -> only that component delta
- payment untouched unless payment changed
Must fix current live supplier ledger corruption and GL mismatch on existing records such as PUR-0105 / PUR-0110 or equivalent live cases.
Reconcile:
- purchase detail
- supplier ledger
- accounts payable
- day book
- trial balance
- balance sheet inventory/payable
Deliver result doc, repair SQL, and verification matrix.
```

---

## Phase 6 — Inventory Valuation and Cost Flow Repair
### Goal
Make stock screen, valuation report, and balance sheet inventory match exactly.

### Fixes
- correct product/variant joins
- remove “Unknown product (id)” output
- align quantity source
- align unit cost source
- align total valuation source
- connect purchase edits and returns to valuation properly
- verify Sales Profit / COGS behavior

### Acceptance
Inventory screen, inventory valuation report, and balance sheet inventory must agree.

### Cursor Prompt
```text
PROJECT: PHASE 6 — INVENTORY VALUATION AND COST FLOW REPAIR
Audit and fix inventory valuation end-to-end.
Tasks:
- fix product vs variant joins
- eliminate Unknown product(id) issues
- align qty, unit cost, and total value between inventory module and financial valuation report
- verify inventory value in balance sheet matches valuation report
- verify sales profit / COGS integration
Use current live data and repair the mismatched valuation.
Deliver files changed, valuation SQL checks, and before/after screenshots or result notes.
```

---

## Phase 7 — Reporting Reconciliation Layer
### Goal
Make all financial screens read from one consistent accounting truth.

### Screens to reconcile
- Trial Balance
- Profit & Loss
- Balance Sheet
- Inventory Valuation
- Sales Profit
- Accounts screen balances
- Receivables
- Payables
- Customer Ledger
- Supplier Ledger
- Journal Entries
- Day Book
- Roznamcha

### Acceptance
Trial Balance difference = 0, and all derived reports match the same posted accounting truth.

### Cursor Prompt
```text
PROJECT: PHASE 7 — REPORTING RECONCILIATION LAYER
Audit every reporting screen and query.
Make all reports reconcile from the same accounting truth.
Required targets:
- Trial Balance difference = 0
- Balance Sheet balances
- P&L matches posted revenue/cost/expense
- Inventory valuation matches inventory and balance sheet
- Receivables/payables match source ledgers
- Accounts list balances match journal truth
Fix mixed-source queries and apply live-data repair where needed.
Deliver verification SQL, result doc, and exact reconciliation rules per report.
```

---

## Phase 8 — Live Data Repair and Final Verification
### Goal
Correct current inserted data without asking for re-entry.

### Fixes
- detect corrupted live entries
- compute expected truth from document state + payment state + locked mapping rules
- post corrective entries or run safe repair SQL
- verify all current documents and reports

### Acceptance
The current live data becomes correct and usable without starting over.

### Cursor Prompt
```text
PROJECT: PHASE 8 — LIVE DATA REPAIR AND FINAL SIGN-OFF
Using the final blueprint and all previous phases, repair the CURRENT live inserted data.
Do not ask for fresh re-entry.
Tasks:
1. detect mismatched live sale/purchase/payment/ledger/report records
2. compute expected accounting truth from document truth
3. apply corrective SQL or safe reconciliation entries
4. verify all current ledgers and reports
5. produce FINAL_RESULT.md with:
   - root cause summary
   - all files changed
   - repair SQL used
   - live records repaired
   - final verification outcomes
Also commit, push, and redeploy/restart as required.
```

---

# 5. Recommended execution order

Do these in order and do not skip:

1. Phase 0 — Blueprint Lock
2. Phase 1 — Source Lock
3. Phase 2 — COA Mapping Lock
4. Phase 3 — Payment Isolation
5. Phase 4 — Sale Engine
6. Phase 5 — Purchase Engine
7. Phase 6 — Inventory Valuation
8. Phase 7 — Reports Reconciliation
9. Phase 8 — Live Data Repair + Final Sign-Off

---

# 6. Practical rules for acceptance

The fix is acceptable only if all of these become true:

- Sale edit does not reverse payment unless payment changed
- Purchase edit does not reverse payment unless payment changed
- Discount / shipping / freight / labor / extra expense each hit the correct GL path
- Supplier ledger and customer ledger agree with GL
- Trial Balance difference = 0
- Balance Sheet balances
- P&L matches posted revenue/cost/expense
- Inventory valuation matches stock and balance sheet
- No need to re-enter current live transactions
- Current live records are corrected, not abandoned

---

# 7. Final instruction for Cursor

Do not continue symptom patching.
Do not treat this as only a sale bug or only a purchase bug.
Start from the blueprint, then implement globally.
Current live data must also be repaired.
