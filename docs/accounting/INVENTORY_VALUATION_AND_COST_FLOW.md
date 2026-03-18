# Inventory Valuation and Cost Flow (Phase 6)

**Status:** Locked from Phase 6. Single source and rules for stock screen, valuation report, and balance sheet inventory.  
**References:** ACCOUNTING_SOURCE_LOCK.md, COA_MAPPING_MATRIX.md, SALE_ACCOUNTING_CONTRACT.md, PURCHASE_ACCOUNTING_CONTRACT.md.

---

## 1. Source lock

- **Quantity and cost:** `stock_movements` only. No product.current_stock or other source for on-hand quantity or unit cost in valuation.
- **GL inventory balance:** `journal_entries` + `journal_entry_lines` (account 1200). Balance sheet inventory = trial balance for account 1200.
- **Consistency:** Purchase (Dr Inventory 1200, Cr AP) and sale COGS (Dr COGS, Cr Inventory 1200) post to GL; valuation report is movement-based. Over time, GL 1200 and valuation total should align when all flows are posted.

---

## 2. Product / variant alignment (same as stock screen)

- **Products with variations:** `has_variations === true` or product has rows in `product_variations`. Only movements with `variation_id` in that product’s variation set are counted. Parent-level movements (variation_id null) for that product are ignored.
- **Products without variations:** Only movements with `variation_id` null are counted.
- **Result:** Valuation quantity per product = same as inventory overview (stock screen) per product.

---

## 3. Unit cost and total value

- **Unit cost:** Weighted average from `stock_movements`: sum(total_cost) / sum(quantity) for the product (with same variant rule above). If no cost on movements, use `product.cost_price` or `product.cost`.
- **Total value:** quantity × unit_cost per product; report total = sum of product total values.

---

## 4. Product name (no "Unknown product (id)")

Display name resolution order:

1. `product.name` (if non-empty)
2. `product.sku` (if non-empty and name empty)
3. `sales_items.product_name` (first non-null for that product_id)
4. `purchase_items.product_name` (first non-null for that product_id)
5. `product_variations.sku` (first for that product_id when product row missing)
6. **Last resort:** `"Product"` (never "Unknown product (id)").

---

## 5. Balance sheet inventory

- Balance sheet inventory line = account **1200** (Inventory) from trial balance as at report date.
- Valuation report total = sum of (quantity × unit_cost) from stock_movements with rules above.
- No full reconciliation in Phase 6; Phase 7 may reconcile trial balance vs valuation.

---

## 6. Files

| File | Role |
|------|------|
| `accountingReportsService.ts` | getInventoryValuation: stock_movements, product+variant grouping, name fallbacks, no "Unknown product (id)". |
| `inventoryService.ts` | getInventoryOverview: same product/variant rules (single source for stock screen). |
| Sale/purchase/COGS | Post to GL 1200; cost flow into stock_movements (unit_cost, total_cost). |
