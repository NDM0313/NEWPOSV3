# Phase 6 — Inventory Valuation and Cost Flow Repair: RESULT

**Date:** 2025-03-18  
**Plan reference:** `ACCOUNTING_PHASE_PLAN_AND_PROMPTS.md` — Phase 6  
**Status:** Complete (awaiting approval before Phase 7)

---

## 1. Root cause

- **Product/variant mismatch:** Inventory valuation aggregated `stock_movements` by `product_id` only and ignored `variation_id`. The stock screen (inventoryService) uses the same movements but with product+variant rules: for products with variations it sums only variation-level movements; for products without variations it sums only parent-level (variation_id null) movements. Valuation was therefore double-counting or mis-counting when both parent-level and variation-level movements existed for the same product.
- **"Unknown product (id)":** When the product row was missing (e.g. deleted) and no name was found in sales_items or purchase_items, the report showed `Unknown product (${id})`. Requirement: remove this completely; use a neutral last-resort label.
- **Quantity/cost source:** Valuation already used stock_movements for quantity and unit_cost/total_cost; the fix was to align the **grouping** with the stock screen, not to change the source.
- **Balance sheet:** Already uses GL (trial balance, account 1200). Documented that balance sheet inventory = 1200 from journal; valuation report = movement-based; consistency expected when flows are correct (no full reconciliation in Phase 6).

---

## 2. Final inventory valuation / cost flow rules implemented

| Rule | Implementation |
|------|----------------|
| **Single source** | Quantity and cost from `stock_movements` only. |
| **Product/variant alignment** | Same as inventory overview: has_variations → sum only movements where variation_id in product’s variations; else sum only movements where variation_id is null. |
| **Unit cost** | Weighted average from movements (total_cost/quantity); fallback product.cost_price / cost. |
| **Total value** | Sum of (quantity × unit_cost) per product; as-of date filter on movement created_at. |
| **Product name** | product.name → product.sku → sales_items.product_name → purchase_items.product_name → product_variations.sku → **"Product"** (never "Unknown product (id)"). |
| **Balance sheet inventory** | Account 1200 from trial balance (unchanged). Documented that it should align with valuation when purchase/COGS flows are correct. |

---

## 3. Files changed

| File | Change |
|------|--------|
| `docs/accounting/INVENTORY_VALUATION_AND_COST_FLOW.md` | **New.** Contract for valuation source, product/variant rules, unit cost, names, balance sheet. |
| `src/app/services/accountingReportsService.ts` | getInventoryValuation: select variation_id; fetch products (has_variations) and product_variations; aggregate with same product+variant rules as inventoryService; name fallback chain including product_variations.sku; last resort "Product" (removed "Unknown product (id)"); branch filter with 'all' guard. |

---

## 4. SQL used

**None.** Phase 6 is code-only; no migrations, no destructive cleanup.

---

## 5. Verification (real inventory/product cases)

- **Stock screen vs valuation quantity:** For a company with products (with and without variations), run stock screen (inventory overview) and inventory valuation report as at same date. For each product, quantity in valuation should equal the stock shown on the overview (same product+variant grouping).
- **No "Unknown product (id)":** Run valuation for a company that has (or had) deleted products with movements; ensure no row shows "Unknown product (id)". Last-resort rows should show "Product".
- **Balance sheet inventory:** Balance sheet assets should include account 1200 (Inventory) from trial balance. Valuation report total is movement-based; full reconciliation (trial balance vs valuation) is Phase 7.

Verification can be done on current live inventory/product records and as-of dates.

---

## 6. Summary

- **Goal:** Fix inventory valuation and cost flow per source lock, COA, sale/purchase contracts; resolve product/variant mismatch; remove "Unknown product (id)"; align with stock screen and balance sheet.
- **Deliverables:** INVENTORY_VALUATION_AND_COST_FLOW.md; getInventoryValuation aligned to inventory overview (product+variant); name fallbacks and "Product" last resort; no destructive cleanup.
- **Acceptance:** Stock screen, valuation report, and balance sheet inventory use consistent rules; quantity/cost from stock_movements with correct grouping; no "Unknown product (id)".
- **Next:** Stop. Wait for approval. Then Phase 7 (Reporting Reconciliation Layer).

---

## 7. Git commit

**Commit:** `a523749`  
Message: `Phase 6: Inventory valuation and cost flow – product/variant alignment, remove Unknown product, one source`
