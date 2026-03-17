# PF-05 — Inventory Valuation Report SKU / Name Fix — Execution Result

## 1. Root cause

- **Products query not scoped by company:** `getInventoryValuation` fetched products by `.in('id', productIds)` without `.eq('company_id', companyId)`. In multi-tenant or RLS setups this could return wrong products or fail to resolve names for the current company.
- **Blank display when name/SKU null or empty:** If `products.name` or `products.sku` was null or empty string, the report showed a blank cell. Fallbacks were `p?.name || '—'` and `p?.sku || '—'`, which still yield blank when the value is `''`.
- **Missing product (e.g. deleted):** When a `product_id` from `stock_movements` had no row in `products`, the code used `p?.name || '—'` so name showed "—" but there was no clear "unknown product" identity for audit.

## 2. Was fix code-level or company-scoped?

**Code-level only.** No company-specific SQL or data repair. The service now scopes the products query by `company_id` and uses non-blank fallbacks for name and SKU; applies to all companies.

## 3. What was applied on NEW BUSINESS ID

- **No direct SQL or data changes** on NEW BUSINESS. Application code only. NEW BUSINESS was verified: no positive stock, so inventory valuation report is empty (clean zero state).

## 4. Files changed

| File | Change |
|------|--------|
| **`src/app/services/accountingReportsService.ts`** | In `getInventoryValuation`: (1) Added `.eq('company_id', companyId)` to the products query so product name/SKU are resolved within the same company. (2) `product_name`: use trimmed name, else `'Unnamed product'` when product exists, else `'Unknown product (${pid.slice(0, 8)})'` when product missing. (3) `sku`: use trimmed sku, else `'—'`. Ensures no blank product name or SKU in the report. |
| **`scripts/pf05-verify-inventory-valuation.js`** | **New.** Script to verify valuation data: for NEW and OLD business, samples products with positive stock and checks name/SKU resolution (and blank flags). |
| **`docs/accounting/PF05_INVENTORY_VALUATION_SKU_NAME_RESULT.md`** | **New.** This result document. |

## 5. SQL/scripts run

- **`node scripts/pf05-verify-inventory-valuation.js`** — Ran successfully. NEW BUSINESS: no positive stock (empty valuation). OLD BUSINESS: 2 products with stock; both have product_name and sku resolved; no blank names or SKUs.

## 6. What data changed on NEW BUSINESS ID

- **None.** No data was changed. Code fix only.

## 7. Verification result before vs after on NEW BUSINESS ID

- **Before:** Products query was not explicitly scoped by company; null/empty name or sku could render blank.
- **After:** Products query is scoped by `company_id`; name and SKU always have a non-blank display value (Unnamed product, Unknown product (id), or — for SKU). Verification: NEW BUSINESS has no stock, so report shows "No stock on hand." (clean zero state).

## 8. Verification result before vs after on OLD BUSINESS ID

- **Before:** Same risk of blank if any product had null/empty name or sku; company scope not explicit.
- **After:** Same code fix; verification script showed OLD BUSINESS has 2 products with positive stock, both with product_name and sku present; no blank rows. Report will show correct item identity.

## 9. Fresh test result

- **pf05-verify-inventory-valuation.js** ran successfully. NEW BUSINESS: empty valuation (no stock). OLD BUSINESS: sampled rows have product name and SKU resolvable; no blank name/SKU in sample.

## 10. Remaining exception (if any)

- **None.** No change to frozen accounting or posting logic. Valuation still aggregates by `product_id` (no variation-level rows); if variation-level display is needed later, it would be a separate enhancement.

## 11. Exact next step

1. Deploy or run the app with the updated `accountingReportsService.ts`.
2. In the app, open **Reports → Inventory Valuation** for NEW BUSINESS: expect "No stock on hand." when there is no stock.
3. Open **Reports → Inventory Valuation** for OLD BUSINESS: confirm product name and SKU columns are populated for each row (no blank cells); rows match actual products with stock.
4. Optionally run `node scripts/pf05-verify-inventory-valuation.js` again after data changes to re-check resolution.
