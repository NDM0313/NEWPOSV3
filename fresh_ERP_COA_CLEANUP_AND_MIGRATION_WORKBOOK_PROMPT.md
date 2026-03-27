# ERP_COA_CLEANUP_AND_MIGRATION_WORKBOOK_PROMPT.md

FINAL PROMPT DO

We need to create a deep Chart of Accounts cleanup and migration workbook for the ERP.

IMPORTANT:
This is not only a list of accounts.
It must identify:
- which accounts are currently correct
- which are duplicate/noisy/misused
- which should be merged/renamed/deprecated
- how AR/AP/customer/supplier/worker subledgers should work
- how migration should happen safely without breaking reports

==================================================
OUTPUT FILE TO CREATE
==================================================

Create a markdown file:

docs/accounting/ERP_COA_CLEANUP_AND_MIGRATION_WORKBOOK.md

==================================================
GOAL
==================================================

Create one deep cleanup workbook for the Chart of Accounts so we can stabilize the accounting foundation and stop repeated confusion in:
- posting
- report mapping
- trial balance
- balance sheet
- AR/AP subledgers
- worker/bank/cash handling

==================================================
SECTION 1 — CURRENT ACCOUNTING LANDSCAPE
==================================================

Audit the current account structure and describe:
- what main account families exist
- where current noise/mixing exists
- which areas look standard
- which areas are inconsistent
- where accounts are present but not properly utilized

==================================================
SECTION 2 — FINAL RECOMMENDED COA STRUCTURE
==================================================

Define the final recommended ERP COA structure with categories such as:
- Assets
- Liabilities
- Equity
- Revenue
- Cost of Sales / Cost of Production
- Expenses
- Inventory
- Cash / Bank / Wallet
- AR / AP
- Worker / Payroll
- Rental
- Courier / Shipping
- Other operationally relevant families

Use parent/child structure clearly.

==================================================
SECTION 3 — CONTROL ACCOUNT + SUBLEDGER DESIGN
==================================================

Define clearly:

A) Accounts Receivable
- parent/control
- customer child accounts
- posting rules
- report rules

B) Accounts Payable
- parent/control
- supplier child accounts
- posting rules
- report rules

C) Worker accounts
- worker payable
- worker advances
- optional child worker subaccounts if recommended

D) Cash / Bank / Wallet
- real payment accounts and their grouping

==================================================
SECTION 4 — CURRENT ACCOUNT AUDIT TABLE
==================================================

Produce a practical audit table for current accounts with columns like:
- account code
- current name
- current category
- actual usage observed
- problem found
- recommendation
- action required

Possible actions:
- keep
- rename
- merge
- reclassify
- deprecate
- no-post
- split into parent/child
- requires migration
- requires report remap

==================================================
SECTION 5 — KNOWN CONFLICT AREAS TO ANALYZE
==================================================

Explicitly review and resolve likely noisy areas such as:
- revenue code overlaps
- discount / extra expense / shipping / freight placement
- inventory asset accounts
- AR/AP control vs subledger ambiguity
- duplicate bank/wallet/cash style accounts
- worker payable vs expense confusion
- commission / payroll / liability placement
- rental income / rental receivable treatment
- manufacturing/studio cost accounts

==================================================
SECTION 6 — POSTABLE VS SUMMARY-ONLY RULES
==================================================

Define:
- which accounts are summary-only
- which accounts are postable
- which parent accounts should never receive direct postings in normal flows
- how child accounts roll up to parents

==================================================
SECTION 7 — MODULE-TO-ACCOUNT POSTING MAP
==================================================

Create a clear map for:
- sales
- sale payments
- customer on-account receipts
- purchases
- supplier payments
- expenses
- worker advances/payments
- rental
- manual journal
- inventory/opening balances
- production/studio

For each:
- debit side
- credit side
- control vs child account behavior
- required contact/subledger linkage

==================================================
SECTION 8 — REPORT ALIGNMENT RULES
==================================================

Define how COA structure must align with:
- Trial Balance
- Balance Sheet
- P&L
- Statements
- AR/AP summaries
- Worker statements
- cash/bank statements

Include double-count prevention rules.

==================================================
SECTION 9 — MIGRATION STRATEGY
==================================================

Plan a safe migration path.

Phases should include:
1. analysis/freeze
2. non-destructive additions
3. new parent/child links
4. report alignment
5. posting alignment
6. optional backfill/reclassification
7. legacy cleanup / deprecation

Do NOT assume destructive cutover first.

==================================================
SECTION 10 — LEGACY DATA HANDLING
==================================================

Explain how to handle:
- existing JEs posted directly to control accounts
- old payments linked only by metadata
- legacy accounts with wrong classifications
- historical reports during transition
- optional controlled reclass/backfill

==================================================
SECTION 11 — VALIDATION / SAFETY CHECKS
==================================================

Define checks like:
- all journals balanced
- AR/AP child sum matches control total
- no double count in Trial Balance / Balance Sheet
- no posting to deprecated/no-post accounts
- report totals stable before and after migration
- legacy vs new report parity checks

==================================================
SECTION 12 — FRONTEND COA UX
==================================================

Recommend how frontend COA should look:
- grouped tree
- show sub-accounts default on/off
- party-linked children under AR/AP
- clear labels for summary-only accounts
- badges for postable/deprecated/system-created accounts
- simple, less noisy presentation

==================================================
SECTION 13 — FINAL WORKBOOK OUTPUT
==================================================

The workbook must be practical enough that:
- developer knows exactly what to change
- finance/admin knows exactly what accounts are being cleaned
- migration can be executed in phases
- report alignment remains safe

==================================================
RETURN
==================================================

Return:
1. full markdown file content
2. top 10 cleanup priorities
3. list of accounts/families that should NOT be touched until final validation
