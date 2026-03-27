# ERP_ACCOUNTING_EXECUTION_MANUAL_PROMPT.md

FINAL PROMPT DO

We need to create a deep execution-level accounting manual for the ERP.

IMPORTANT:
Do NOT create only a strategy/architecture summary.
This document must explain the system at execution level so that anyone reading it can understand:

- which amount comes from where
- which document creates which accounting impact
- what is stored in backend
- what is shown in frontend
- what happens on edit
- what happens on reversal
- what happens on adjustment
- how reports should reflect the final truth

The goal is to remove confusion and create one practical execution manual for the accounting engine.

==================================================
OUTPUT FILE TO CREATE
==================================================

Create a markdown file:

docs/accounting/ERP_ACCOUNTING_EXECUTION_MANUAL.md

==================================================
DOCUMENT GOAL
==================================================

This manual must explain the ERP accounting behavior in practical operational detail.

It should answer questions like:
- A sale happened — what rows are created and where?
- A purchase happened — which accounts are hit?
- A payment was received manually — how does it affect ledger, invoice due, and journal?
- A supplier payment was entered through Add Entry — what gets allocated and how?
- An expense was edited — what changes in reports and why?
- A transaction was reversed — what remains visible in audit vs live views?
- What should the frontend show to normal users vs finance users?

==================================================
STRUCTURE REQUIRED
==================================================

The markdown must include these sections:

1. Executive Summary
2. Accounting Principles Used in This ERP
3. Source of Truth Model
4. Effective View vs Audit View
5. Backend Stores vs Frontend Shows
6. Module-by-Module Accounting Workflows
7. Edit / Reverse / Adjustment Rulebook
8. Report Impact by Transaction Type
9. Party/Subledger Rules
10. Validation / Reconciliation Rules
11. Known Risks / Edge Cases
12. Final Implementation Checklist

==================================================
SECTION 1 — EXECUTIVE SUMMARY
==================================================

Explain in simple language:
- journals are accounting truth
- source documents are operational truth
- reports must stay mathematically consistent
- frontend should remain simple
- audit detail must not confuse normal operational views

==================================================
SECTION 2 — ACCOUNTING PRINCIPLES
==================================================

Define clearly:
- journal-based accounting
- control account + subledger model
- no direct destructive delete as normal accounting behavior
- header-only edit vs financial edit
- delta adjustment vs full reversal
- effective/live view vs audit/history view
- parent vs child account rules
- no double counting in reports

==================================================
SECTION 3 — SOURCE OF TRUTH MODEL
==================================================

Explain what is the source of truth for:
- accounting reports
- customer/supplier balances
- payment allocations
- inventory-related financial postings
- balance sheet
- trial balance
- statements

Explicitly define:
- journal_entries + journal_entry_lines
- accounts
- payments
- payment_allocations
- source documents (sales, purchases, expenses, rental, etc.)

==================================================
SECTION 4 — BACKEND STORES VS FRONTEND SHOWS
==================================================

Create a clear matrix.

For each module, explain:
- what backend stores
- what normal frontend should show
- what audit/detail frontend should show

Examples:
- sale with adjustment
- purchase with freight + discount + later correction
- reversed payment
- rental advance
- supplier payment allocation
- customer on-account receipt

==================================================
SECTION 5 — MODULE-BY-MODULE WORKFLOWS
==================================================

For EACH of these modules, create a full end-to-end flow:

A) Sales
- create sale
- final save
- direct payment
- due balance
- later payment
- edit sale
- edit payment
- reversal
- report impact

B) Purchases
- create purchase
- freight / cargo / extra expense
- supplier payment
- later adjustment
- edit purchase
- reverse payment
- report impact

C) Customer Receipts
- direct receipt
- on-account receipt
- FIFO invoice allocation
- unapplied balance
- reverse/edit receipt
- report impact

D) Supplier Payments
- direct purchase-linked payment
- manual payment through Add Entry
- FIFO bill allocation
- unapplied supplier advance
- reverse/edit payment
- report impact

E) Expenses
- create expense
- payment
- edit date only
- edit amount/account/category
- adjustment/reversal behavior
- report impact

F) Rental
- booking
- advance payment
- final charge
- remaining payment
- reverse/edit payment
- report impact

G) Worker / Payroll
- worker advance
- worker payable
- worker payment
- settlement
- report impact

H) Manual Journal / Add Entry
- when it is pure journal
- when it should create operational linkage
- when it should affect AR/AP subledgers

I) Inventory / Opening / Production
- opening inventory
- financially relevant inventory movement
- production/studio cost if applicable
- report impact

==================================================
SECTION 6 — FOR EACH WORKFLOW, PROVIDE THIS FORMAT
==================================================

For each document/event, include:

1. Business Event
2. Source Tables Affected
3. Journal Entry Created? (Yes/No)
4. Debit Accounts
5. Credit Accounts
6. Party/Subledger Linkage
7. Payment/Allocation Impact
8. Frontend Effective View
9. Frontend Audit View
10. Edit Behavior
11. Reversal Behavior
12. Report Impact
13. Example with Numbers

==================================================
SECTION 7 — EDIT / REVERSE / ADJUSTMENT RULEBOOK
==================================================

Create a strict rulebook:

A) Header-only edits
Examples:
- date
- notes
- reference
- memo

What should happen:
- backend update
- journal transaction date sync if applicable
- no misleading extra clutter in normal views

B) Financial edits
Examples:
- amount
- account
- quantity
- price
- freight
- discount

What should happen:
- delta adjustment or safe reversal path
- effective reports remain clear
- audit trail preserved

C) Reversal
What should happen in:
- journals
- ledgers
- party statements
- payment history
- reports
- audit views

==================================================
SECTION 8 — REPORT IMPACT MATRIX
==================================================

For each event type, explain impact on:
- Trial Balance
- Balance Sheet
- P&L
- General Ledger
- Customer Statement
- Supplier Statement
- Worker Statement
- Cash/Bank Statement
- Receivables summary
- Payables summary

==================================================
SECTION 9 — PARTY / SUBLEDGER RULES
==================================================

Explain clearly:
- AR control + customer child
- AP control + supplier child
- worker payable/advance logic
- payment account display
- active vs voided/superseded payments
- how party statements differ from GL statements

==================================================
SECTION 10 — RECONCILIATION RULES
==================================================

Define practical checks:
- journals balance
- party subledger matches control total
- statement closing matches visible math
- payment allocations match invoice/bill due
- live balances exclude voided/reversed items
- audit view preserves history without corrupting effective view

==================================================
SECTION 11 — EXAMPLES WITH NUMBERS
==================================================

Include worked examples for:
- sale with payment + edit
- purchase with freight + discount + adjustment
- customer receipt with FIFO
- supplier payment with FIFO
- reversed payment
- rental advance
- worker advance and settlement

==================================================
SECTION 12 — DELIVERABLE QUALITY RULE
==================================================

The document must be written as a practical execution handbook, not a vague strategy note.

It must be detailed enough that:
- developer understands implementation
- finance/admin understands behavior
- future report fixes can use it as reference
- confusion around “which amount came from where” is reduced

==================================================
RETURN
==================================================

Return:
1. the full markdown file content
2. key open questions if any still remain
3. a short note about any module that still needs a dedicated contract document
