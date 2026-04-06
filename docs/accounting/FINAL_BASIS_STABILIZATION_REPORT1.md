# FINAL_BASIS_STABILIZATION_REPORT

**Date:** 2026-04-06  
**Company UUID:** `db1302ec-a8d7-4cff-81ad-3c8d7cb55509`  
**Status:** Basis stabilization complete enough for UI/design continuation, with live UAT screenshots still recommended.  
**Batch 5:** **NOT APPROVED**

---

## 1) Final practical status

- **Accounting truth / basis stabilization:** PASS
- **Need another giant SQL fix program:** NO
- **Need live UAT + screenshot signoff:** YES
- **Can move to design polish next:** YES

**Meaning of “READY FOR DESIGN POLISH = YES”**  
This does **not** mean every operational business case is finished.  
It means the **basis confusion problem** is stabilized enough that UI / design work can continue without the accounting foundation shifting underneath it.

---

## 2) Canonical accounting truth

### GL truth
These surfaces are treated as **GL / journal truth**:

- Trial Balance
- Balance Sheet
- Profit & Loss
- General Ledger / account statements in GL mode
- COA balances when explicitly labeled as GL / journal based

### Operational truth
These surfaces are treated as **operational / document-flow truth**:

- Sales due / receivables from sales flows
- Purchases due / supplier outstanding from purchase flows
- Contact operational balances
- Worker unpaid / studio operational pending amounts
- Reports Overview in operational mode

### Rule
**Do not silently compare GL and operational numbers as if they are the same basis.**  
All critical screens must show basis labels.

---

## 3) Accepted formulas and basis map

### A. Receivables
- **GL AR:** net of account `1100 Accounts Receivable` from journal legs
- **Operational receivables:** customer outstanding from operational/contact logic
- **Contact/customer GL attribution:** party-attributed GL slice using party resolution logic

#### Accepted comparison
- `customer + both` operational contacts vs operational receivables
- GL AR 1100 vs party-attributed GL AR only when clearly labeled as GL

#### Not accepted
- Sales page due vs contact tab vs GL AR without basis label

### B. Payables
- **GL AP:** net of account `2000 Accounts Payable`
- **GL Worker Payable:** net of account `2010 Worker Payable`
- **Operational supplier due:** purchase due / contact operational payable
- **Operational worker due:** unpaid worker / studio operational pending

#### Accepted comparison
- Supplier operational payable vs supplier operational sources
- Worker operational payable vs worker operational sources
- AP 2000 and WP 2010 shown separately in GL views

#### Not accepted
- Mixing supplier AP and worker payable into one unlabeled payable total

### C. Supplier AP running balance convention
For supplier AP statement / liability style:

- **Running balance movement:** `credit - debit`
- **Closing balance:** last displayed running balance
- **Net movement:** `closing - opening`

This is the accepted AP liability convention.

### D. JE / payment display rule
For payment-linked journal detail:

- Prefer **posted journal_entry_lines of that JE**
- Do **not** let merged “effective payment lines” replace the actual JE lines in the main double-entry grid
- Effective / auxiliary payment-account views may be shown separately, but not as the only truth

---

## 4) Core stabilization items completed

### 4.1 GL vs Operational labeling
Additive UI / copy updates were made so critical surfaces clearly state basis:

- Contacts
- Sales
- Purchases
- Dashboard executive cards
- Reports Overview
- Studio Costs
- Rentals
- Financial reports
- COA drill-downs / control panels

### 4.2 Reports Overview split
Reports Overview now has two conceptual modes:

#### Operational Overview
Uses document-flow / operational numbers:
- sales
- purchases
- paid expenses
- document due receivables/payables
- operational net result

#### Financial GL Overview
Uses journal / GL numbers:
- Revenue (GL)
- Expenses (GL)
- Net Profit (GL)
- Cash & Bank (GL position)
- AR 1100
- AP 2000
- WP 2010

### 4.3 Contacts reconciliation split
Contacts reconciliation was stabilized to separate:

1. customer + both vs AR  
2. supplier + both vs AP  
3. worker vs GL WP 2010  
4. variance summary with note that mixed payables must not be compared to AP 2000 alone

### 4.4 COA control drill-downs
COA control drill-downs support:
- operational parties view
- GL / Trial Balance drill-down
- unmapped buckets drill-down

### 4.5 Financial reports labeling
The following reports are explicitly GL-based:
- Trial Balance
- Profit & Loss
- Balance Sheet

Export titles and filenames include GL / period context.

---

## 5) Key fixes that were part of stabilization

### A. Reversal visibility in party statements
Correction reversal handling was addressed so party statements can include reversal-linked entries using the same attribution logic as source truth.

### B. Supplier AP statement alignment
Supplier statement path was stabilized toward AP journal truth and liability-style running balance logic.

### C. Journal row specificity
Journal / day book / transaction views were improved so account display is more specific and can show actual leaf account context rather than vague generic labels.

### D. Payment JE modal safety
Transaction details should prefer posted lines for the current JE rather than replacing them with merged payment-effective lines.

### E. Party GL vs operational split
Contacts / COA / control breakdowns were updated so:
- operational values remain primary where the screen is operational
- party GL slices are shown as GL, not silently as operational
- residuals / unmapped buckets are explained, not hidden

---

## 6) Residuals and what they mean

Residuals are **not automatically a bug**.  
A residual can mean one of these:

- unmapped / non-party GL on a control account
- manual journals posted on control account without resolved party
- legacy reference_type mapping gap
- operational vs GL basis mismatch
- subtree vs direct-code mismatch

### Important residual case
A remaining AP control residual should be investigated with:

- control breakdown
- unmapped party GL buckets
- party-attributed GL totals
- operational contact totals

Residuals should be **explained**, not silently merged away.

---

## 7) SQL / audit artifacts referenced in this stabilization

The following were part of the stabilization flow:

- `sql/final_accounting_stabilization_audit.sql`
- `sql/final_basis_stabilization_views.sql`

Purpose:
- TB check
- control nets
- party GL vs operational comparison
- dashboard metric snapshot
- unmapped control bucket tracing

If `CREATE VIEW` is restricted in Supabase, the same SELECT bodies can be run ad hoc in SQL editor.

---

## 8) Manual screenshot checklist before freezing the phase

Take final screenshots of the critical surfaces:

- Reports Overview — Operational view
- Reports Overview — Financial GL view
- Contacts reconciliation tiles
- COA control drill-downs
- Trial Balance
- Profit & Loss
- Balance Sheet
- Supplier statement
- Worker statement
- Dashboard executive cards with basis labels

---

## 9) Freeze this accounting phase in docs

Save these items in docs so the same confusion does not reopen later:

- final screenshots
- accepted formulas
- basis map
- company UUID used in audit
- final signoff status
- known residual explanation notes

**Company UUID used in this phase:**  
`db1302ec-a8d7-4cff-81ad-3c8d7cb55509`

---

## 10) Caution before next phase

Do **not** reopen another giant accounting rewrite unless a new live fact proves a real GL or operational truth bug.

At this point the correct next step is:

1. quick live UAT screenshot signoff on critical surfaces  
2. freeze the accepted accounting basis in docs  
3. move to design polish / Figma with confidence that basis labels are stable  

---

## 11) Final verdict

| Item | Verdict |
|---|---|
| Canonical GL truth | PASS |
| Reports Overview basis separation | PASS |
| Contacts reconciliation split | PASS |
| Supplier operational vs GL labeling | PASS |
| Worker operational vs GL labeling | PASS |
| Dashboard card basis clarity | PASS |
| Need another giant SQL fix program | NO |
| Need live UAT screenshot signoff | YES |
| Ready for design polish next | YES |

---

## 12) Final one-line conclusion

**Accounting basis stabilization is complete enough to continue with UI/design work, provided final live screenshot signoff is captured and this phase is frozen in documentation.**
