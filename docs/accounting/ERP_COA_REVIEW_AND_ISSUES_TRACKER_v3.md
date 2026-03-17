# ERP Accounting / COA Review + Issues Tracker

Last updated: 2026-03-17
Project: ERP Master / NEWPOSV3
Purpose: Running tracker for accounting, COA, sales, purchases, shipping, inventory, and product-rule issues. This file should be updated continuously as new issues are discovered.

---

## 1) Current conclusion (high-level)

Current accounting implementation is **not yet safe for final production accounting**.

The UI is partially working, but the accounting engine, dashboard summaries, receivable/payable classification, balance sheet, profit & loss, shipping integration, and inventory-to-accounting linkage are still inconsistent.

### Main conclusion
1. Purchase / sales / shipping / extra-expense postings are still being mixed into the wrong accounts in some places.
2. Customer-facing sale totals and accounting postings are not fully synchronized.
3. Trial Balance and Balance Sheet are not balancing correctly.
4. Inventory valuation exists, but inventory is not appearing correctly in financial statements.
5. Sales Profit / COGS integration is broken or incomplete.

---

## 2) Confirmed accounting design decisions (must be treated as final target)

### 2.1 Source of truth
- Master COA table should be: `accounts`
- Accounting engine should post through:
  - `journal_entries`
  - `journal_entry_lines`
  - `payments`
- Courier account master should stay linked via:
  - `couriers`
  - `contacts`
  - `accounts`
- `chart_accounts` looks legacy / partial and should not be treated as live master.

### 2.2 Correct receivable / payable behavior
- **Accounts Receivable** = customer outstanding balances only
- **Accounts Payable** = supplier outstanding balances only
- Courier payable should be separate liability accounts under courier control
- Shipping expense should not be pushed into receivable
- Purchase amounts should not hit receivable
- Sale amounts should not hit accounts payable

### 2.3 Correct shipping model
Two values exist and must stay separate:
1. **Shipping charged from customer**
2. **Actual shipping cost payable to courier**

Recommended accounting:
- If customer is charged shipping on invoice:
  - Dr Customer Receivable / Cash
  - Cr Sales Revenue (product sale)
  - Cr Shipping Income / Shipping Recovery
- Actual courier cost:
  - Dr Shipping Expense
  - Cr Courier Payable (specific courier sub-account)

### 2.4 Correct purchase model
For inventory purchase:
- Dr Inventory / Stock in Hand
- Cr Supplier Payable

For extra landed costs (customs/loading/freight):
- Dr Inventory Landed Cost OR dedicated purchase cost account
- Cr Supplier Payable / Customs Payable / Freight Payable / Courier Payable

Purchase should **never** debit Accounts Receivable.

### 2.5 Correct sale model
For credit sale:
- Dr Accounts Receivable
- Cr Sales Revenue

For cash sale:
- Dr Cash/Bank
- Cr Sales Revenue

For inventory release / COGS:
- Dr Cost of Goods Sold
- Cr Inventory

---

## 3) Screenshot-based confirmed observations

### 3.1 Sale SL-0001 and SL-0002 behavior
Observed from screenshots:
- SL-0001 grand total shown in sale detail = Rs. 33,075
- Total paid on SL-0001 = Rs. 15,000
- Amount due on SL-0001 = Rs. 18,075
- SL-0002 grand total shown in sale detail = Rs. 75,000
- SL-0002 appears fully paid

Customer ledger confirms:
- SL-0001 debit = Rs. 33,075
- SL-0002 debit = Rs. 75,000
- Total customer debit = Rs. 108,075
- Payments total = Rs. 90,000
- Net receivable = Rs. 18,075

### 3.2 Shipping charge mismatch
User test case:
- Base sale was around Rs. 33,000 range
- Customer shipping charge of Rs. 5,000 was added
- Actual courier cost was entered separately
- Shipping/accounting entries appear in accounting and accounts
- But the sale detail / invoice / customer ledger do **not** reflect the shipping charge in the sale total

This means:
- Shipping charge is entering accounting as a separate entry
- But sale header, invoice detail, customer ledger, and due amount remain based only on the non-shipping sale total

This is a major sync bug.

### 3.3 Journal Entries screen is misleading
Observed:
- Purchases, Sales, Payments, Shipment accounting, Commission, Extra Expense all appear under `Type = Income`

This is wrong.

Required:
- Purchase should not be marked Income
- Payment should not be marked Income
- Shipment accounting should not default to Income
- Commission / extra expense should not be marked Income

### 3.4 Accounts summary cards are inconsistent
Observed from screenshots:
- Top cards show Total Income = Rs. 108,075
- Top cards show Total Expense = Rs. 0
- Net Profit card = Rs. 108,075
- Payables / Receivables shown as large totals

But Profit & Loss shows:
- Sales Revenue = Rs. 108,075
- Shipping Income = Rs. 5,000
- Total Revenue = Rs. 113,075
- Shipping Expense = Rs. 2,265
- Extra Expense = Rs. 1,400
- Total Expenses = Rs. 3,665
- Net Profit = Rs. 109,410

So dashboard cards and P&L are not synchronized.

### 3.5 Accounts Payable statement is contaminated
Observed in Accounts Payable statement:
- Purchase credits are present (expected)
- But also sales entries, shipment accounting, and extra expense debit entries are being shown inside Accounts Payable statement

Examples visible on statement:
- Sale SL-0001 to Walk-in Customer appears in Accounts Payable statement
- Sale SL-0002 to Walk-in Customer appears in Accounts Payable statement
- Shipment accounting – SL-0001 appears in Accounts Payable statement
- Extra Expense lines appear in Accounts Payable statement

This is not acceptable.

Accounts Payable ledger should only show liability activity relevant to payables.

### 3.6 Trial Balance is not balanced
Observed:
- Trial Balance shows total debit and credit difference = Rs. 2,800

This means accounting is not balanced.

A valid trial balance must end with zero difference.

### 3.7 Balance Sheet is not balanced
Observed:
- Assets total = Rs. 3,005,700
- Liabilities + Equity total = Rs. 2,818,490
- Difference displayed = Rs. 187,210

This confirms financial statements are incomplete or incorrectly classified.

### 3.8 Inventory exists but is not flowing into Balance Sheet / COGS properly
Observed:
- Inventory Valuation report shows total inventory value = Rs. 2,169,200
- But Balance Sheet asset section does not show inventory as a proper stock asset account
- Profit & Loss shows Cost of Sales = Rs. 0
- Sales Profit report shows Revenue = 0, Cost = 0, Profit = 0 for invoices even though sales clearly exist

Conclusion:
- Inventory valuation logic exists
- But inventory accounting integration into Balance Sheet and COGS / Sales Profit is broken or incomplete

### 3.9 Inventory valuation report missing product identity
Observed:
- Inventory valuation rows show quantity / unit cost / value
- But product names and SKUs appear blank (`—`)

This indicates report join / mapping issue.

### 3.10 Courier architecture partly correct but detail handling incomplete
Observed:
- Accounts list includes:
  - Accounts Payable
  - Accounts Receivable
  - DHL Payable
  - Shipping Expense
  - Shipping Income
- Trial Balance also shows DHL Payable and Shipping Expense / Shipping Income separately

This is conceptually correct, but:
- customer shipping charge is not linked back to sale total/ledger
- actual courier payable detail is not clearly controlled in one clean reporting flow
- payable summary and account statement are mixed with unrelated entries

### 3.11 Owner Equity missing / incomplete
Observed:
- Balance Sheet shows Owner Equity = Rs. 0.00

This is not realistic for a live business with opening balances, profit, assets, liabilities.

Owner Capital / Retained Earnings / Current Period Profit handling is incomplete.

---

## 4) Core issue list (updated)

### P0 / Critical

#### Issue 01 — Purchase / sales / shipment / expense entries are hitting wrong account flows
Status: OPEN

Symptoms:
- Accounts Payable statement contains sales and shipment entries
- Earlier purchase flow also showed wrong receivable mapping
- classification logic is not clean

Impact:
- supplier reconciliation breaks
- customer reconciliation breaks
- payable/receivable summaries become unreliable

Required fix:
- enforce strict account mapping by business event type
- never let sales post into AP
- never let purchases post into AR
- never let shipment accounting leak into wrong control statement

---

#### Issue 02 — Shipping charged from customer is not reflected in sale total / customer ledger
Status: OPEN

Symptoms:
- shipping charge added in sale edit/accounting
- sale detail still shows only non-shipping grand total
- customer ledger still shows only base sale amount
- accounting shows shipping income separately

Impact:
- invoice total and customer due become understated
- customer ledger does not match accounting revenue

Required decision:
Choose **one final rule** and enforce it everywhere.

Recommended rule:
If shipping is charged to customer as part of invoice, then:
- invoice total must include customer shipping charge
- customer ledger debit must include shipping charge
- amount due must include shipping charge
- print/invoice detail must show shipping line clearly

---

#### Issue 03 — Trial Balance not balanced
Status: OPEN

Observed difference: Rs. 2,800

Impact:
- books not reliable
- cannot trust financial reports

Required fix:
- identify orphan / partial journal entries
- verify every business transaction posts equal debit and credit
- run balance validation after every create/edit/cancel flow

---

#### Issue 04 — Balance Sheet not balanced
Status: OPEN

Observed difference: Rs. 187,210

Impact:
- financial statements invalid
- accounting close impossible

Required fix:
- map inventory asset correctly
- calculate owner equity / retained earnings correctly
- ensure all account balances are included with correct sign logic

---

### P1 / High

#### Issue 05 — Dashboard cards not synchronized with actual reports
Status: OPEN

Symptoms:
- top expense card = 0 while P&L shows expenses
- top net profit differs from P&L net profit
- total income card excludes / inconsistently handles shipping income

Required fix:
- all summary cards must read from same verified report logic as P&L / TB / balance sheet

---

#### Issue 06 — Journal entry `Type` labels are wrong
Status: OPEN

Symptoms:
- purchases, payments, shipment, extra expense, commission all display as `Income`

Required fix:
- replace UI label mapping with proper module / entry classification

---

#### Issue 07 — Sales Profit report broken
Status: OPEN

Symptoms:
- sales invoices exist
- report still shows revenue/cost/profit = 0

Likely cause:
- sales profit report not reading sales totals correctly
- or COGS / cost tables not linked

Required fix:
- revenue should come from finalized sales
- cost should come from inventory/stock issue or purchase/average cost engine
- profit = revenue - cost

---

#### Issue 08 — Cost of Goods Sold not posting
Status: OPEN

Symptoms:
- P&L shows Cost of Sales = 0
- inventory valuation exists but sales profit report still zero

Required fix:
- finalize inventory accounting model
- post COGS on final sale
- reduce inventory on final sale

---

#### Issue 09 — Inventory asset missing from Balance Sheet
Status: OPEN

Symptoms:
- inventory valuation total exists
- balance sheet asset section does not show stock account correctly

Required fix:
- create/use dedicated Inventory / Stock in Hand account
- sync inventory valuation with balance sheet asset logic

---

#### Issue 10 — Accounts Payable statement and control account logic need cleanup
Status: OPEN

Symptoms:
- control account includes unrelated entries
- sub-account behavior not clean

Required fix:
- control account summary = aggregated payable only
- detailed statement = only true payable movements
- keep customer/sale flows out of supplier payable statement

---

#### Issue 11 — Courier payable reporting flow incomplete
Status: OPEN

Required target:
- Control account: Courier Payable (Control)
- Sub-accounts: DHL Payable, TCS Payable, Leopard Payable, etc.
- actual shipping cost should hit specific courier payable sub-account
- customer shipping charge should hit shipping income / customer receivable if billed

---

#### Issue 12 — Inventory valuation report missing product names / SKUs
Status: OPEN

Required fix:
- repair report join with products / variations tables

---

#### Issue 13 — Owner equity / retained earnings model missing
Status: OPEN

Required fix:
- create / map Owner Capital
- create / map Retained Earnings / Current Year Earnings
- move current period profit into equity presentation properly

---

### P2 / Functional / Workflow

#### Issue 14 — Product type lock after save
Status: OPEN

Requirement:
- if product saved as Simple, it must remain Simple in edit mode
- Variation and Combo options should be disabled
- if saved as Variation, editing stays within variation model only
- if saved as Combo, editing stays within combo model only

Reason:
Changing product type after linked transactions causes major data integrity problems.

---

#### Issue 15 — Linked product delete protection + activate/deactivate option
Status: OPEN

Requirement:
- if product has linked purchase/sale/inventory data, delete must be blocked
- show clear error / protection message
- allow deactivate / activate instead
- if no linked data exists, delete can remain allowed

---

#### Issue 16 — Purchase edit not re-posting accounting correctly
Status: OPEN

Symptoms:
- purchase amount edited from old value to new value
- old ledger / COA / journal values remain unchanged or partially unchanged

Required fix:
- on purchase edit, old accounting effect must be reversed or recalculated cleanly
- then new journal / ledger / balances must be reposted

---

## 5) Specific test case notes to preserve

### Test case A — SL-0001
- Base sale detail shown = Rs. 33,075
- Paid = Rs. 15,000
- Due = Rs. 18,075
- Customer ledger matches 33,075 only
- Shipping/accounting entry of Rs. 5,000 exists separately
- Therefore customer charged shipping is not flowing into invoice/customer receivable

### Test case B — SL-0002
- Sale detail shown = Rs. 75,000
- Paid = Rs. 75,000
- Due = 0
- Customer ledger reflects Rs. 75,000

### Test case C — Customer ledger summary
- Total debit = Rs. 108,075
- Total credit = Rs. 90,000
- Net balance = Rs. 18,075
- This proves current customer ledger excludes the Rs. 5,000 shipping charge that user expected to be included

### Test case D — P&L
- Sales Revenue = Rs. 108,075
- Shipping Income = Rs. 5,000
- Total Revenue = Rs. 113,075
- Shipping Expense = Rs. 2,265
- Extra Expense = Rs. 1,400
- Total Expenses = Rs. 3,665
- Net Profit = Rs. 109,410

### Test case E — Balance Sheet
- Assets = Rs. 3,005,700
- Liabilities + Equity = Rs. 2,818,490
- Difference = Rs. 187,210

### Test case F — Trial Balance
- Difference = Rs. 2,800

---

## 6) Required implementation order (recommended)

### Phase 1 — Freeze accounting rules
1. finalize event-to-account mapping
2. decide shipping billed-to-customer behavior
3. lock control accounts and sub-account logic

### Phase 2 — Fix posting engine
1. correct sales posting
2. correct purchase posting
3. correct shipping income / shipping expense posting
4. correct payment posting
5. correct commission / extra-expense posting
6. ensure edit / cancel / reverse flows repost correctly

### Phase 3 — Fix statements and reports
1. Accounts Payable statement cleanup
2. Accounts Receivable statement cleanup
3. dashboard top cards sync
4. Trial Balance fix
5. Balance Sheet fix
6. P&L fix
7. Sales Profit fix
8. Inventory valuation join fix

### Phase 4 — Fix product workflow protections
1. product type lock
2. linked delete protection
3. activate/deactivate flow

---

## 7) Final current verdict

Current system has a usable UI, but accounting outputs are still inconsistent.

### Not safe yet for final accounting reliance because:
- shipping billed to customer is not syncing back to sale/invoice/customer ledger
- payable statement is polluted with unrelated business events
- trial balance is not balanced
- balance sheet is not balanced
- inventory is not hitting financial statements correctly
- sales profit / COGS logic is incomplete
- dashboard totals do not match underlying reports

### Safe next direction:
- do **not** polish UI first
- first fix posting engine + account mapping + report formulas
- after that, clean up workflow/edit protection issues

---

## 8) Next notes section (append below in future)

- Add next discovered issue here
- Keep date and screenshot/test reference
- Do not overwrite old findings; append and resolve with status



### 3.12 Studio order custom task persistence is broken
Observed from user test and screenshots:
- In Studio order (STD-0001), when user adds extra/custom tasks through **Customize Tasks**, they appear immediately on frontend
- After Save + back to dashboard + reopen, those custom tasks do not remain properly saved
- This means frontend state is changing, but backend persistence / reload mapping is incomplete

Impact:
- production workflow becomes unreliable
- stage delivery / task-based costing can break
- invoice generation can be based on incomplete or stale stage data

### 3.13 Studio order remains editable after invoice generation
Observed:
- Studio screen shows invoice-linked mode and allows force-sync invoice
- User requirement is that once invoice is generated, cost/task structure should not remain freely editable

Accounting risk:
- if stages, workers, or costs change after invoice generation without controlled reposting,
  then sales, studio cost, worker payable, ledger, and reports all drift apart

Required rule:
Choose one of these final standards:
1. **Hard lock model**: after invoice generation, tasks / worker cost / pricing become read-only
2. **Controlled amendment model**: editing allowed only through a formal amendment / repost flow that re-syncs all accounting outputs

### 3.14 Worker amount edit after invoice generation is not syncing across modules
Observed from screenshots + user notes:
- Studio screen originally showed total worker cost = Rs. 2,800
  - Dyeing = 500
  - Handwork = 800
  - Stitching = 1,500
- Later Studio Costs / Worker screens show only Rs. 2,300 total cost
  - Dyeing = 500
  - Handwork = 800
  - Stitching = 1,000
- This proves one worker amount was edited after invoice / stage setup
- But accounting/reporting did not re-sync consistently across all screens

Affected modules:
- Studio order screen
- Worker Management
- Studio Costs dashboard
- Journal Entries / Day Book
- Account statements
- Worker due / payable balances

This is a major consistency bug.

### 3.15 Studio cost summary cards are inconsistent with worker-wise detail
Observed in Studio Costs screenshots:
- Total Cost = Rs. 2,300
- Paid card = Rs. 0
- Outstanding = Rs. 2,300
- Worker-wise breakdown shows:
  - Maqsood total 800, paid 800, outstanding 0
  - Nawaz total 1,000, paid 0, outstanding 1,000
  - Shakeel total 500, paid 0, outstanding 500

So summary cards and worker-wise grid do not agree.

Expected math:
- Total Cost = 2,300
- Paid = 800
- Outstanding = 1,500

### 3.16 Worker Management and Studio order payable totals are out of sync
Observed:
- Studio order screen shows payable = Rs. 2,000 in one state
- Worker Management summary shows pending payments = Rs. 1,500
- Worker detail shows Nawaz due 1,000 and Shakeel due 500, Maqsood cleared

This indicates different screens are reading different states or stale values.

### 3.17 Cost of Production ledger is contaminated by non-studio expense posting
Observed in account statement for **5000 - Cost of Production**:
- genuine studio stage entries are present
- but a generic expense line also appears:
  - `EXP-0003 Salaries - test add exp main` = Rs. 17,000

This means normal expense posting is hitting the same **Cost of Production** account used for studio stage costing.

Impact:
- studio cost summary becomes inflated / misleading
- profit reporting becomes distorted
- account statement cannot distinguish production stage costs vs generic salary expense

Required rule:
- either use a dedicated studio production cost account
- or split generic salaries and studio direct labor into separate accounts/subaccounts

### 3.18 Studio sales conversion to Final is duplicating instead of converting in-place
User-reported behavior:
- Studio sale is saved in Order state
- when trying to convert it to Final, it does not convert properly
- instead it saves again / duplicates the studio sale

Impact:
- duplicate orders/invoices
- broken references
- accounting duplication risk
- confusion in sales list and production linkage

### 3.19 Studio profit / pricing values do not persist after save
User-reported behavior:
- profit amount / front pricing entered in studio sale is not retained
- when reopening record, it resets to zero or does not show previously saved value

Observed relevance from screenshot:
- pricing calculator shows Production Cost + Profit Margin + Grand Total relationship
- if profit value is not persisted, regenerated totals will drift

### 3.20 Shipping control on studio orders needs disable-until-final rule
User requirement:
- Add Shipping should remain disabled until the sale is finalized (or invoice/final sale state is reached)
- current behavior is exposing shipping flow too early

Reason:
- premature shipping setup before final sale can create partial accounting / workflow mismatch

### 3.21 Accounting manual entry correction workflow is incomplete
User requirement:
- Journal Entry / Day Book / Roznamcha should support a standard edit / correction workflow
- currently there is no clear controlled method shown for fixing wrong entries

Required accounting-safe standard:
- either disallow direct edit after posting and use reverse + repost
- or allow edit only before posting/finalization
- must keep audit trail

### 3.22 Full worker payment does not refresh all dependent summaries
User-reported behavior and screenshots suggest:
- even after worker payment is recorded, due balances and cost screens are not updating consistently
- examples: Paid amount appears in worker row, but summary card remains zero; payable on studio order remains stale

This is a downstream sync / recalculation bug.

### 3.23 Studio order task save / invoice / cost sync needs one strict lifecycle
From all screenshots and user notes, current studio lifecycle is not strict enough.

Recommended final lifecycle:
1. Create studio order
2. Add/adjust tasks before invoice generation only
3. Save tasks to backend
4. Generate invoice once structure is final
5. Lock core fields OR force amendment flow
6. Worker payment updates worker payable + cost summaries + ledgers automatically
7. Convert to Final should update existing order, not create duplicate

---

## 4) Core issue list (studio extension)

### P0 / Critical (studio)

#### Issue 17 — Studio custom tasks do not persist after save/reopen
Status: OPEN

Symptoms:
- custom task appears immediately after add
- after save + reopen it disappears / does not reload correctly

Required fix:
- persist custom stages/tasks to backend properly
- reload same saved stage set when order is reopened
- ensure task order, worker, cost, and status all survive refresh

---

#### Issue 18 — After invoice generation, studio task/cost editing is unsafe
Status: OPEN

Symptoms:
- invoice generated but task/cost structure can still be changed
- downstream accounting does not re-sync reliably

Required fix:
- either hard-lock post-invoice editing
- or build controlled amendment + repost engine

---

#### Issue 19 — Editing worker/stage amount after invoice does not update accounting everywhere
Status: OPEN

Symptoms:
- studio order value changes
- but dashboard, studio costs, worker payables, ledger, and reports remain stale or partially updated

Required fix:
- any post-save/post-invoice cost edit must trigger full recalculation of:
  - studio production totals
  - worker payable balances
  - journal entries
  - account balances
  - dashboard cards
  - account statements

---

#### Issue 20 — Convert to Final for studio sale creates duplicate instead of converting original order
Status: OPEN

Required fix:
- conversion must mutate/promote same source order
- preserve same reference linkage
- do not create duplicate studio sale unless explicit clone action is used

---

#### Issue 21 — Studio worker payment sync is broken
Status: OPEN

Symptoms:
- worker row may show paid value
- but summary card / order payable / due balances remain stale

Required fix:
- after payment, recalc:
  - worker outstanding
  - production outstanding
  - paid total
  - studio order payable panel
  - accounting account statements

---

### P1 / High (studio)

#### Issue 22 — Studio pricing/profit value not persisting
Status: OPEN

Required fix:
- save profit model/type/value to backend
- reopen should show last saved pricing values
- invoice total should derive from persisted values, not volatile frontend state

---

#### Issue 23 — Add Shipping should be disabled until studio sale is final
Status: OPEN

Required fix:
- shipping UI disabled before final/invoice-ready state
- enable only when sale reaches allowed status

---

#### Issue 24 — Studio Costs summary cards do not match worker-wise table
Status: OPEN

Observed mismatch example:
- Summary Paid = 0
- Worker row shows Maqsood paid = 800

Required fix:
- card totals must be derived from same worker ledger source as row details

---

#### Issue 25 — Worker Management totals do not match Studio order/payables
Status: OPEN

Required fix:
- all worker due summaries should come from same payable/ledger source
- no stale cached totals

---

#### Issue 26 — Cost of Production account polluted by generic expenses
Status: OPEN

Required fix:
- separate studio direct labor cost from generic salaries/expenses
- prevent unrelated expense entries from inflating studio production cost account

---

#### Issue 27 — Manual accounting correction workflow missing for posted entries
Status: OPEN

Required fix:
- define standard edit/reverse/repost rules for JE / Day Book / Roznamcha
- audit-safe correction flow required

---

## 5) Specific test case notes to preserve (studio extension)

### Test case G — Studio order STD-0001 initial visible state
- Customer = Walk-in Customer
- Fabric = DURANI (2 meters)
- Total Bill = Rs. 8,300
- Balance Due = Rs. 8,300
- Production Cost = Rs. 2,800
- Profit = Rs. 5,500
- Stage lines visible:
  - Dyeing = Rs. 500 (Payable)
  - Handwork = Rs. 800 (Paid)
  - Stitching = Rs. 1,500 (Payable)
- Payment summary visible:
  - Paid = 800
  - Payable = 2,000

### Test case H — Worker screens later show changed state
Later screenshots show:
- Worker Management pending total = Rs. 1,500
- Nawaz due = 1,000
- Shakeel due = 500
- Maqsood cleared
- Studio Costs total = Rs. 2,300
- Paid card = Rs. 0
- Outstanding card = Rs. 2,300
- Worker-wise rows show Maqsood paid 800

This proves synchronization and summary math are inconsistent.

### Test case I — Cost of Production account statement contamination
Observed in account statement for 5000 Cost of Production:
- JE-0014 studio production dyer stage = 500
- JE-0016 studio production handwork stage = 800
- JE-0018 studio production stitching stage = 1,000
- EXP-0003 Salaries test add exp main = 17,000

This should be treated as a configuration/posting issue.

### Test case J — Studio worker payment journals exist but type label still wrong
Journal list shows entries like:
- Payment to worker Nawaz
- Payment to worker Maqsood
- Payment to worker Shakeel
- Studio production stage completed

But `Type` column still shows `Income`.

---

## 6) Required implementation order (extended with studio)

### Phase 4 — Studio workflow hardening
1. fix custom task persistence
2. define post-invoice lock vs amendment model
3. fix studio cost re-sync after worker amount edit
4. fix Convert to Final duplicate behavior
5. persist profit/pricing values
6. disable shipping until final state
7. unify worker payment sync across Studio / Workers / Accounting
8. separate generic salary expense from studio production cost account
9. add accounting correction workflow (reverse/repost or controlled edit)

---

## 7) Current overall verdict after studio review

The system is now showing **two linked problem groups**:

### Group A — Accounting core issues
- wrong classification
- report mismatches
- TB / Balance Sheet imbalance
- shipping and sales mismatch
- inventory / COGS incomplete

### Group B — Studio lifecycle issues
- task persistence broken
- invoice lock/amendment policy missing
- worker cost edits not reposting properly
- worker payment summaries out of sync
- convert-to-final duplicate bug
- studio pricing not persisting

### Final conclusion
Until both groups are fixed, the ERP should **not** be treated as fully accounting-safe or studio-production-safe for final production close.
