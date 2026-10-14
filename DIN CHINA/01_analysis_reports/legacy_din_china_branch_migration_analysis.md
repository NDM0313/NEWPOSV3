# Legacy DIN CHINA Branch Migration Analysis

**Generated:** 2026-06-14T15:14:29.175Z  
**Source dump:** `C:\Users\ndm31\Downloads\zhd.sql`  
**Mode:** Read-only analysis — no import performed

---

## 1. Old DB Tables Found

Total `CREATE TABLE` definitions in dump: **78**

Tables with INSERT data (candidate legacy sources):

| Table | Row count |
|-------|----------:|
| `account_transactions` | 9828 |
| `accounting_accounts` | 88 |
| `accounting_accounts_transactions` | 2 |
| `accounts` | 166 |
| `activity_log` | 415 |
| `brands` | 1 |
| `business` | 1 |
| `business_locations` | 2 |
| `categories` | 1 |
| `contacts` | 66 |
| `expense_categories` | 4 |
| `products` | 14 |
| `purchase_lines` | 17 |
| `transaction_payments` | 97 |
| `transaction_sell_lines` | 63 |
| `transactions` | 40 |
| `users` | 1 |
| `variations` | 19 |

## 2. Branch Confirmation

| Field | Value |
|-------|-------|
| **id** | 2 |
| **location_id** | BL0002 |
| **name** | DIN CHINA |
| **business_id** | 1 |

Filter applied: `transactions.location_id = 2` (maps to `business_locations.id`).

## 3. Sales Count and Total Amount

| Metric | Value |
|--------|------:|
| Final sales (branch) | **34** |
| Total amount | **28,343,979.00** |

## 4. Sale Item Count and Total Quantity

| Metric | Value |
|--------|------:|
| Line items | **63** |
| Total quantity | **73,883.22** |

## 5. Sale Payment Count and Total Paid Amount

| Metric | Value |
|--------|------:|
| Linked payments | **70** |
| Total paid | **8,416,540.00** |
| Outstanding (sales total − paid) | **19,927,439.00** |

## 6. Purchase Count and Total Amount

| Metric | Value |
|--------|------:|
| Purchases (branch) | **1** |
| Total amount | **67,978,418.40** |

## 7. Purchase Item Count and Total Quantity

| Metric | Value |
|--------|------:|
| Line items | **17** |
| Total quantity | **218,406.85** |

## 8. Purchase Payment Count and Total Paid Amount

| Metric | Value |
|--------|------:|
| Linked payments | **4** |
| Total paid | **65,916,440.00** |
| Outstanding (purchase total − paid) | **2,061,978.40** |

## 9. Expense Count and Total Amount

| Metric | Value |
|--------|------:|
| Final expenses (branch) | **4** |
| Total amount | **88,000.00** |

## 10. Customers Involved

Distinct customers on selected sales: **21**

| Legacy contact id | Name | Mobile |
|------------------:|------|--------|
| 47 | LAL   MOHAMMAD | 3219368830 |
| 46 | RAEES   LHR | 3215640268 |
| 48 | SHAHURKH   KHAN | 3354545841 |
| 49 | AZIZ   JAMURAD | 3211391511 |
| 50 | PARVAISE  MARDAN | 3138437211 |
| 51 | MURAD  RAMDAS | 3009346229 |
| 52 | HASSAN   MARDAN | 3429421696 |
| 53 | SALEEM   KARIM ULLAH | 3119121584 |
| 54 | ABDUL WAJID  JAMURAD | 3005893728 |
| 55 | AHMED   ZEB | 3470999700 |
| 56 | HAJI   SHARIF | 30565564 |
| 57 | DIN COUTURE | 03330144496 |
| 58 | MR KHALIL LHR | 03186451818 |
| 59 | MR HAJI IKRAM U DIN | 03219113582 |
| 60 | MR ALMAS NOW | 03329107000 |
| 1 | Walk-In Customer |  |
| 62 | MR HAJI MUTABAR | 03009052383 |
| 63 | MR JALIL | 03009170008 |
| 64 | MR H.BUKHCHA GUL | 03185556597 |
| 65 | MR KHAYAL MOHAMMAD | 0021 |
| 66 | MR MIR WALI | 03376000661 |

## 11. Suppliers Involved

Distinct suppliers on selected purchases: **1**

| Legacy contact id | Name | Mobile |
|------------------:|------|--------|
| 45 | MR DIN MOHAMMAD | 03339104890 |

## 12. Products Involved

Distinct products on sale/purchase lines: **12**

| Legacy product id | SKU | Name |
|------------------:|-----|------|
| 14 | 0014 | VELVET SETECHABLE |
| 3 | 0003 | TR |
| 13 | 0013 | WOOL |
| 12 | 0012 | TC |
| 17 | 0017 | TAIBO |
| 4 | 0004 | KATAN RIYAN |
| 5 | 0005 | SHAMIZ RIYAN |
| 8 | 0008 | DUBAL SHADE POLYSTER |
| 9 | 0009 | SILK COLOR POLYSTER |
| 10 | 0010 | RIYAN SILK PRINT |
| 7 | 0007 | GRIAB RIYAN |
| 11 | 0011 | RAD RIYAN |

## 13. Payment Methods / Accounts Involved

### Sale & purchase payment methods

| Method | Count | Total amount |
|--------|------:|-------------:|
| cash | 17 | 66,616,140.00 |
| custom_pay_2 | 46 | 6,508,500.00 |
| custom_pay_1 | 10 | 1,171,340.00 |
| custom_pay_3 | 1 | 37,000.00 |

### Legacy account ids (payment register)

| Account id | Account name | Used in payments |
|-----------:|--------------|-----------------:|
| 106 | MCB | 1 |
| 108 | DIN FHD MZ | 35 |
| 115 | DIN CASH TR G140 | 11 |
| 133 | WALI DIN T/T | 1 |
| 157 | YAQOOB | 3 |
| 159 | DIN NDM MZ | 6 |

## 14. Skipped Account Transactions Summary

Raw `account_transactions` are **not** imported. Audit-only breakdown:

| Skip reason | Count |
|-------------|------:|
| deposit | 5956 |
| fund_transfer | 3645 |
| deleted | 122 |
| linked_selected_txn_excluded_from_import | 57 |
| opening_balance | 29 |
| linked_other_branch_or_excluded_doc | 19 |

**Total account_transactions rows:** 9828

Also excluded from operational CSVs (not in account_transactions):

- 9828 account_transactions rows → audit CSV only
- 19 unlinked transaction_payments (advance/contact credits)
- Fund transfers and opening_balance account_transactions excluded

## 15. Missing or Risky Records

### Validation

All automated validation checks **passed**.

### Skipped documents (audit only)

- sell_return txn 21 invoice=CN2025/0001 total=198853 status=final
- 19 transaction_payments with null transaction_id (19 advance headers) — excluded from payment CSVs

### Data quality notes

- Sales outstanding AR ≈ 19,927,439.00 (partial payments expected)
- Purchase outstanding AP ≈ 2,061,978.40
- 1 sell_return document(s) excluded from import set

## 16. Suggested Mapping Needed Before Import

- **Branch:** legacy `business_locations.id = 2` (`BL0002`, DIN CHINA) → new `branches` row for DIN CHINA
- **Company:** legacy `business_id = 1` → target `company_id` in new ERP (not branch id 2)
- **Payment methods:** `cash`, `custom_pay_1`, `custom_pay_2`, `custom_pay_3` → cash / bank / wallet in new ERP
- **Payment accounts:** legacy ids 115, 108, 159, 106, 157, 133 → new payment account UUIDs
- **Contacts:** import or match 21 customers + 1 suppliers before document load
- **Products:** import or match 12 products (parent + variation SKUs) before line items
- **Do not import:** account_transactions, fund transfers, opening balances, manual GL rows
- **Outstanding balances:** preserve as partial payment_status on sales/purchases; do not backfill from raw ledger

## 17. Final Recommendation

**needs mapping**

Documents are branch-clean and reconcilable, but legacy payment methods, account ids, contacts, and products must be mapped to the new DIN ERP before import.

---

## Review CSV Files

| File | Rows |
|------|-----:|
| `legacy_din_china_sales.csv` | 34 |
| `legacy_din_china_sale_items.csv` | 63 |
| `legacy_din_china_sale_payments.csv` | 70 |
| `legacy_din_china_purchases.csv` | 1 |
| `legacy_din_china_purchase_items.csv` | 17 |
| `legacy_din_china_purchase_payments.csv` | 4 |
| `legacy_din_china_expenses.csv` | 4 |
| `legacy_din_china_skipped_account_transactions.csv` | 9828 |
