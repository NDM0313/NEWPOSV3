# ERP_REPORTS_UI_BEHAVIOR_SPEC_PROMPT.md

FINAL PROMPT DO

We need to create a deep reporting behavior specification for the ERP.

IMPORTANT:
This is not only about backend report formulas.
It must define exactly what each report should show to the user, how filters work, how effective vs audit mode behaves, and how party/customer/supplier/worker/cash reports differ from raw accounting views.

==================================================
OUTPUT FILE TO CREATE
==================================================

Create a markdown file:

docs/accounting/ERP_REPORTS_UI_BEHAVIOR_SPEC.md

==================================================
GOAL
==================================================

Create one clear UI + behavior specification for all major accounting reports, so that:
- frontend remains simple
- backend accounting truth remains safe
- effective vs audit confusion ends
- customer/supplier/worker statements behave consistently
- Trial Balance / Balance Sheet / P&L / statements all align

==================================================
REPORTS TO COVER
==================================================

Include detailed behavior for:

1. Trial Balance
2. Balance Sheet
3. Profit & Loss
4. General Ledger
5. Journal Entries
6. Day Book / Roznamcha
7. Account Statements
8. Customer Statement
9. Supplier Statement
10. Worker Statement
11. Cash / Bank Statement
12. Receivables Summary
13. Payables Summary
14. Aging reports (if recommended)
15. Any drilldown / statement export behavior

==================================================
FOR EACH REPORT, DEFINE
==================================================

1. Purpose
2. Data source
3. Summary mode
4. Detailed mode
5. Effective/live mode
6. Audit/detail mode
7. Filters
8. Grouping/sorting rules
9. Party visibility
10. Reversal/adjustment handling
11. Export/print behavior
12. Edit launch behavior (if any)
13. Common mistakes to avoid

==================================================
SECTION 1 — REPORTING PHILOSOPHY
==================================================

Explain:
- raw accounting detail vs operationally understandable statement
- when to show detail
- when to roll up
- when to preserve history only in audit
- why party-facing statements should not look like raw GL dumps

==================================================
SECTION 2 — TRIAL BALANCE
==================================================

Define:
- flat mode
- summary mode
- expanded/subledger mode
- AR/AP/worker/cash/bank treatment
- double counting prevention
- when parent/child accounts appear
- how totals must remain unchanged across modes

==================================================
SECTION 3 — BALANCE SHEET
==================================================

Define:
- summary-only presentation
- roll-up of AR/AP child accounts
- party drilldown
- cash/bank grouping
- inventory display
- liabilities/equity display
- no duplicate child display in main list

==================================================
SECTION 4 — PROFIT & LOSS
==================================================

Define:
- revenue and expense grouping
- how discounts/freight/extra expense/commission appear
- operational vs accounting naming
- what should stay below gross margin vs operating expenses if applicable
- no confusion from adjustment clutter in normal user-facing view

==================================================
SECTION 5 — JOURNAL / GENERAL LEDGER / DAY BOOK
==================================================

Define:
- raw accounting detail expectations
- audit-first behavior
- sorting by date + time + stable tiebreaker
- reversal visibility
- edit launch behavior
- transaction detail modal expectations

==================================================
SECTION 6 — ACCOUNT STATEMENTS
==================================================

Define the statement center behavior:
- statement types
- grouped account selection
- customer/supplier/contact filtering
- auto-fetch vs Apply behavior
- top summary cards
- footer totals
- party statement vs GL statement rendering differences

==================================================
SECTION 7 — CUSTOMER / SUPPLIER / WORKER STATEMENTS
==================================================

This is very important.

Define clean party-statement behavior:
- one business document = one effective row
- payments separate rows
- adjustments/reversals hidden in effective mode but preserved in audit
- party name always real, not fake display override
- closing balance must match visible math

For each of customer/supplier/worker:
- opening balance
- operational document rows
- payment rows
- adjustment handling
- reversal handling
- running balance behavior

==================================================
SECTION 8 — CASH / BANK STATEMENTS
==================================================

Define:
- actual account name visibility
- cash/bank/wallet grouping
- transaction source labels
- transfer handling
- reversal handling
- statement clarity for operational users

==================================================
SECTION 9 — RECEIVABLES / PAYABLES / AGING
==================================================

Define:
- customer receivables view
- supplier payables view
- aging buckets
- live-only vs audit modes
- active vs voided/superseded payment behavior

==================================================
SECTION 10 — FILTER RULES
==================================================

Define exactly which selectors:
- auto-fetch immediately
- need Apply button

Recommended pattern:
Primary selectors auto-fetch:
- statement type
- account
- contact type
- contact

Secondary filters Apply:
- module
- transaction type
- polarity
- search
- include reversals
- include manual
- include adjustments

==================================================
SECTION 11 — SORTING RULES
==================================================

Define consistent sorting:
1. transaction date
2. event time / posted time / created_at
3. stable tie-breaker

Apply this consistently across:
- journal
- day book
- party statements
- payment histories
- statements

==================================================
SECTION 12 — ADJUSTMENT / REVERSAL PRESENTATION
==================================================

Define strict rules:
- adjustment hide/show changes presentation, not truth
- reversal hide/show changes presentation, not truth
- effective mode must roll hidden detail into visible main row
- audit mode may show full detail
- visible rows must always reconcile with closing balance

==================================================
SECTION 13 — EDIT FROM REPORTS
==================================================

Define when edit button should appear:
- statements
- journal/day book
- transaction detail
- payment history

And define:
- statement rows are launch points only
- source-aware editor opens
- no raw unsafe edit on derived rows

==================================================
SECTION 14 — EXPORT / PRINT RULES
==================================================

Define:
- what should print in effective statement
- what should print in audit statement
- totals/footer behavior
- company/party/date filters on export
- supplier/customer shareable statement format

==================================================
SECTION 15 — UX CLEANUP RECOMMENDATIONS
==================================================

Recommend how to keep reports simple:
- less graphics where not needed
- more data-focused tables
- compact but clear status badges
- readable labels for freight, discount, adjustment, reversal, etc.
- optional expand for detail

==================================================
SECTION 16 — DELIVERABLE QUALITY RULE
==================================================

The final markdown must be practical enough that:
- a frontend developer can implement UI behavior correctly
- a finance/admin user can validate expected output
- future report debugging can use it as the contract

==================================================
RETURN
==================================================

Return:
1. full markdown file content
2. list of reports that still need additional dedicated specs if any
3. note any current UI/report that should remain legacy until parity is complete
