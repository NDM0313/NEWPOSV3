# ERP Customer Ledger — Failing Cases Analysis

**Date:** 2026-03-13

## Why some contacts work and some do not

Ledger data is driven by:

1. **Sales:** RPC `get_customer_ledger_sales(company_id, customer_id, ...)` — filters by `customer_id` only (no contact type, no branch).
2. **Payments:** RPC `get_customer_ledger_payments(company_id, sale_ids, ...)` — returns only rows where `reference_type = 'sale'` and `reference_id = ANY(sale_ids)`.

So:

- **Contacts that work:** Have at least one **final sale**; payments linked to those sales are returned; ledger shows sales + sale-linked payments.
- **Contacts that fail or look wrong:** See below.

## Failing / inconsistent cases

### 1. Customer with on-account payment only (no sales)

- **Behavior:** Ledger is empty or shows no payments.
- **Reason:** `sale_ids = []` → RPC returns no payments. On-account payments are stored as `reference_type = 'on_account'`, `reference_id` NULL, `contact_id = customerId` and are **never** fetched by the current RPC or fallback.
- **Contact type:** Any (customer / both). Type is not the issue; **missing on-account fetch** is.

### 2. Customer with mix of sale-linked and on-account payments

- **Behavior:** Only sale-linked payments appear; on-account payments are missing from ledger and summary.
- **Reason:** Same as above: only `get_customer_ledger_payments(sale_ids)` is used; on-account is not queried.

### 3. Contact type = “both” (customer + supplier)

- **Behavior:** Can work for ledger **if** they have sales (sales RPC uses `customer_id`, not contact type). So type=both is not inherently broken.
- **Caveat:** If the UI or another path ever filtered contacts by type and excluded “both”, they would not see the ledger at all; in the traced code, customer list uses `type in ('customer','both')`, so both are included. So “both” fails only when the main failure is “no sales” or “only on-account” (cases 1–2).

### 4. company_id / branch_id

- **company_id:** All RPCs and queries filter by `company_id`; if a contact’s sales/payments are in another company, they won’t show. Normal.
- **branch_id:** In accountingService, journal lines are filtered by `branch_id` when provided; RPC sales/payments are **not** branch-filtered. So for a given branch, journal might be empty but synthetic/merge still uses all company sales/payments. So branch can change which journal lines show but not whether sales/payments exist; again, the main gap is on-account.

### 5. Opening balance only (no transactions in range)

- **Behavior:** Can show 0 or wrong opening if opening is computed from previous sales/returns/rentals and **on-account payments** are not included in that prior period. So “customer with opening balance but no transactions” can show wrong opening balance when they have on-account payments before fromDate.

### 6. reference_type / reference_id / null

- **Payments:**  
  - Sale-linked: `reference_type = 'sale'`, `reference_id = sale_id`.  
  - On-account: `reference_type = 'on_account'`, `reference_id` NULL, `contact_id` set.  
- Current logic **excludes** on-account because it only asks for payments by `sale_ids`. No explicit exclusion of “null reference_id” in the RPC — the RPC simply never considers on-account rows.

### 7. Old / legacy data

- If old payments were stored with a different `reference_type` or without `contact_id`, they might not match either sale-linked or on-account path. Fix is to add the on-account path; any legacy shape that matches “contact_id = customer and reference_type = 'on_account'” will then be included.

## Summary

| Case | Works? | Reason |
|------|--------|--------|
| Customer with sale only | Yes | Sales RPC returns them; no payments needed. |
| Customer with sale + sale-linked payment | Yes | Both returned by RPCs. |
| Customer with on-account payment only | **No** | Payments RPC not called with sale_ids; on-account never fetched. |
| Contact type = both with mixed records | Partially | Sales and sale-linked payments work; on-account missing. |
| Customer with opening balance, no tx in range | Partially | Opening can be wrong if on-account not included in prior period. |

**Conclusion:** The main fix is to **include on-account payments** for the contact in both accountingService and customerLedgerAPI, using a single canonical filter: `company_id` + `contact_id = customerId` + `reference_type = 'on_account'` (and optionally `reference_id` IS NULL), and to use the same logic for summary and transaction list so they stay in sync.
