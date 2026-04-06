# AR stabilization report

## Symptoms observed (live)

- Sales **Total Due** (e.g. Rs. 127,000) vs Contacts operational receivables (e.g. Rs. 18,000) vs GL AR **1100** (e.g. Rs. 133,000).

## Root causes (by design + scope)

1. **Sales Total Due**  
   - **Source:** `SalesPage` summary — only **`status === 'final'`** sales.  
   - **Due:** `getEffectiveDue` = `(total + studioCharges) − paid`, capped at ≥ 0.  
   - **Scope:** All qualifying sales in the list context (company / filters), not Contacts tab scope.

2. **Contacts operational receivables**  
   - **Source:** `get_contact_balances_summary` via contact balances map (same RPC as reconciliation).  
   - **Scope:** **Current tab** (All / Customers / Suppliers / Workers) **and** branch — only contacts that pass the tab filter.  
   - **Sales in RPC:** Includes non-cancelled sales with due for that customer (`status != 'cancelled'`), not restricted to `final` only — see function definition in migrations. So RPC and Sales page intentionally differ on **status rules**.

3. **GL AR 1100**  
   - **Source:** Posted journals in range — control account net (Dr−Cr).  
   - **Tie-out:** Compare **customer + both** operational receivables to **1100** on the blue reconciliation strip (`ContactsPage` + `getCompanyReconciliationSnapshot` split fields).

## What we changed (additive)

- **Contacts:** Clarified that **Recv.** totals are **tab- and branch-scoped**; Sales **Total Due** is **all final invoices** company-wide.  
- **Sales:** Footnote under **Total Due** explaining basis.  
- **Reconciliation:** Customer + both vs AR **1100** variance (already wired via `operationalSplitByType` and `contactBalanceReconciliationService`).

## What we did not do

- No manual `UPDATE` to accounts or journals.  
- No change to core TB/P&L without audit proof.

## Verdict

- **AR operational vs GL parity:** **PARTIAL** — customer+both vs **1100** is the correct comparison; **Sales Total Due** vs **Contacts** will not match unless scope and status rules are aligned (documented, not forced to one number).
