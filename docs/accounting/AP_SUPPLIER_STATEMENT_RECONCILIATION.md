# AP control vs supplier statement vs contacts (reconciliation trace)

## Source of truth (aligned in code)

| Surface | Mechanism |
|--------|------------|
| **Contacts — Khuram GL (AP)** | RPC `get_contact_party_gl_balances`: AP lines on **account code `2000` only**, party via `_gl_resolve_party_id_for_journal_entry` / `_gl_party_id_from_payment_row` (G-PAR-02 / 02b). |
| **Supplier Statement (Reports)** | RPC `get_supplier_ap_gl_ledger_for_contact`: **same** control account and **same** party resolver. Replaces legacy client filter `supplierApJournalLineMatchesSupplier` (which missed purchase-linked payments when `payments.contact_id` was null). |

## Debug / tie-out (SQL)

**1) AP control balance (trial balance — code 2000)**  
Sum of `credit − debit` on `journal_entry_lines` for the control `2000` account (company scope, non-void JEs). This is the **posted** AP control total.

**2) Sum of mapped supplier AP (party-attributed, 2000)**  
`SELECT SUM(gl_ap_payable)` from `get_contact_party_gl_balances(company_id, branch_id)` — same basis as Contacts.

**3) Residual (unmapped AP on 2000)**  
`SELECT * FROM get_control_unmapped_party_gl_buckets(company_id, branch_id, '2000');`  
Buckets `reference_type` where `_gl_resolve_party_id_for_journal_entry` returned **NULL** for lines on that control account. Sum of net amounts ≈ **AP control − sum(per-contact mapped AP)** when rounding is negligible.

**4) Per-supplier tie-out**  
For supplier *S*: compare `gl_ap_payable` from `get_contact_party_gl_balances` to the **closing** on **Supplier Statement** for contact *S* (same date range and branch). After `get_supplier_ap_gl_ledger_for_contact`, they should match when filters match.

## Typical residual causes (e.g. Rs. 50,000)

- Journals on AP **without** resolvable party (manual journals, legacy `reference_type`, expenses coded to 2000, opening entries without `opening_balance_contact_ap`).
- **correction_reversal** / void handling edge cases (resolver follows original JE).
- **Branch filter**: statement vs TB using different branch scope.

## Deployment

Apply migration `20260407_get_supplier_ap_gl_ledger_for_contact.sql` so the RPC exists in the tenant database.
