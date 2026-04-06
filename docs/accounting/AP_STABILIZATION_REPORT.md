# AP stabilization report

## Symptoms observed (live)

- Purchases **Amount Due** (supplier-only document list, e.g. Rs. 414,302) vs Contacts **Payables** (operational, e.g. Rs. 439,302) vs GL AP **2000** (e.g. Rs. 464,302). Residual on **2000** vs supplier-only operational ≈ **Rs. 50,000**.

## Interpretation

1. **Supplier-only operational**  
   - Sum **supplier + both** contact payables from `get_contact_balances_summary` — matches purchase order due semantics more closely than “all payables” including workers.

2. **Mixed payables**  
   - **All payables** on Contacts include **worker** payables — **not** AP **2000**; worker liability posts to **2010** / party GL, not **2000**.

3. **GL AP 2000**  
   - Full control balance from journals. Residual vs `sum(gl_ap_payable)` from `get_contact_party_gl_balances` is explained by:
   - Unmapped party on control lines (`get_control_unmapped_party_gl_buckets(..., '2000')`)  
   - Manual journals, opening balance, legacy reference types (per existing docs — no legacy table rewrite).

## What we changed (additive)

- **Contacts:** Reconciliation strip compares **supplier + both** payables to AP **2000**; shows **worker** operational payables as context (not compared to **2000**).  
- **Purchases:** Footnote under **Amount Due** — supplier document list vs Contacts mixed payables vs GL.

## RPCs for tie-out

- `get_contact_party_gl_balances(company_id, branch_id)`  
- `get_supplier_ap_gl_ledger_for_contact` (per supplier statement)  
- `get_control_unmapped_party_gl_buckets(company_id, branch_id, '2000')`

## Verdict

- **AP control residual ≈ 50,000:** **EXPLAINED** if unmapped buckets + non-supplier AP lines + manual entries account for the gap; confirm with audit SQL. Not “fixed” by data patches — trace only.
