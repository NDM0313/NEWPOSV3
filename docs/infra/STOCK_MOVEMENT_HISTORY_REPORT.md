# Stock Ledger by Product — Report Notes

## Data source

- **Authoritative ledger:** `stock_movements` (signed `quantity`: positive = IN, negative = OUT).
- **Current stock:** `SUM(quantity)` from `stock_movements` for the product (and branch scope when selected).
- **Fallback:** `inventory_balance.qty` is used only when diagnosing missing balance rows; on-hand for reporting always comes from movements when any movement rows exist.
- **Opening stock:** Movements before the selected `dateFrom` (including `reference_type = 'opening_balance'` with `movement_type = 'adjustment'`).
- **No writes:** This report is read-only — no stock posting, GL, or inventory updates.

## Zero-stock handling

| Case | Condition | UI |
|------|-----------|-----|
| **A** | `currentStock = 0` and movement history exists | Full movement table + **Zero Stock** badge |
| **B** | No movement rows ever | Shown only when “Include products with no stock transaction” is checked; summary zeros + single row “No stock movement found for this product.” + **No Movement** badge |

## Branch filter

Branch-scoped reads include rows where `branch_id` matches the selected branch **or** `branch_id IS NULL` (company-wide opening/adjustment rows).

## Supplier filter

Derived from `purchase_items` → `purchases.supplier_id` in the selected date range (not a product column).
