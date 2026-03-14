# ERP Local Final UI + Commission Usability – Report

**Date:** 2026-03-14  
**Environment:** Local only (no VPS/deployment).

---

## Summary

| Issue | Root cause | Fix |
|-------|------------|-----|
| **1. Theme/background mismatch** | Inventory (and similar) pages had no consistent page background; table already standard. | InventoryDashboard wrapped in `bg-[#0B0F19]` page wrapper; table unchanged. |
| **2. Sale save duplicate key** | Double submit and/or duplicate-key retry using hook state instead of DB for next invoice number. | Save-in-flight ref guard in SaleForm; duplicate-key retry uses `getNextDocumentNumberGlobal` only. |
| **3. Commission report filter** | No way to filter by salesman. | Salesperson dropdown (All + per-salesman); summary and table use filtered list. |
| **4. Action column position** | Actions were last column on Sales, Inventory, Contacts, Purchases. | Action column moved to first column on Sales, Inventory, Contacts, Purchases; Purchases kept visible delete icon. |
| **5. Dark/light mode** | No theme system; full implementation would need token pass and full audit. | Deferred; documented in ERP_DARK_LIGHT_MODE_FEASIBILITY.md. |

---

## Files changed

| File | Change |
|------|--------|
| `src/app/components/inventory/InventoryDashboard.tsx` | Page wrapper `bg-[#0B0F19]`; Actions column first. |
| `src/app/components/sales/SaleForm.tsx` | `saveInProgressRef` guard in `proceedWithSave`. |
| `src/app/context/SalesContext.tsx` | Duplicate-key retry uses `documentNumberService.getNextDocumentNumberGlobal`. |
| `src/app/components/reports/CommissionReportPage.tsx` | Salesman filter state, Select, `filteredSummary`; cards and table use filtered data. |
| `src/app/components/sales/SalesPage.tsx` | `actions` first in columnOrder/visibleColumns/widths/alignments/labels; header/body render actions first. |
| `src/app/components/contacts/ContactList.tsx` | Actions column moved to first (th + td). |
| `src/app/components/purchases/PurchasesPage.tsx` | `actions` first in columnOrder/visibleColumns/widths/alignments/labels; header/body render actions first (with existing delete icon). |

---

## Migration

No migration added in this pass.

---

## Duplicate invoice / save issue (detail)

- **Constraint:** `sales_company_branch_invoice_unique` on `(company_id, branch_id, invoice_no)`.
- **Causes:** (1) Save handler could run twice (e.g. double click) so two creates attempted; (2) on duplicate, retry used frontend `getNumberingConfig().nextNumber + 1`, which is not guaranteed unique under concurrency.
- **Fix:** (1) `saveInProgressRef` in SaleForm ensures one execution of `proceedWithSave` at a time; (2) on `23505` or message containing `sales_company_branch_invoice_unique`, context calls `getNextDocumentNumberGlobal(companyId, sequenceType)` and retries create once with that number.

---

## List/table actions standardized

- **Sales:** Action column first (dropdown: View/Edit/Convert/Payments/Ledger/Share/Print/Delete/Return/Shipping/Cancel).
- **Inventory:** Action column first (Adjust, Transfer).
- **Contacts:** Action column first (View Ledger, Payment, View Details, Edit, Delete).
- **Purchases:** Action column first (visible delete icon when permitted + 3-dot menu: View/Edit/Print/Make Payment/Cancel/View Ledger/Create Return/Delete).

---

## Dark/light mode

- **Status:** Not implemented. Deferred and documented in `docs/ERP_DARK_LIGHT_MODE_FEASIBILITY.md`.
- **Reason:** No theme tokens or toggle today; a proper implementation would require a full token-based theme pass and testing across all pages.

---

## Local verification steps

1. **Theme:** Open Inventory; confirm page and table use dark background and gray borders (no light panels in center).
2. **Sale save:** Create a new sale, select salesman and commission, set Final, click Save once; confirm success and no duplicate key error; confirm double-click does not create two sales.
3. **Commission report:** Open Reports → Commission; select a date range; confirm "All salesmen" and that selecting one salesman filters summary cards and table.
4. **Action column:** Open Sales, Inventory, Contacts, Purchases; confirm the first column is Actions (3-dot or buttons). Purchases: confirm delete icon is visible when allowed.
5. **Dark/light:** N/A (deferred).

---

## Rollback notes

- **Theme:** Revert InventoryDashboard root div to `className="space-y-6"` (and revert Actions column order if desired).
- **Sale save:** Revert SaleForm (`saveInProgressRef` and guard) and SalesContext (duplicate-key block to previous hook-based retry).
- **Commission filter:** Revert CommissionReportPage (remove filter state, Select, `filteredSummary`; use `data.summary` everywhere).
- **Action column:** Revert SalesPage, InventoryDashboard, ContactList, PurchasesPage to last-column Actions (see ERP_GRID_ACTION_COLUMN_STANDARDIZATION.md).

---

## Documentation created/updated

- `docs/ERP_FINAL_THEME_MISMATCH_FIX.md`
- `docs/ERP_SALE_COMMISSION_SAVE_FIX.md`
- `docs/ERP_COMMISSION_REPORT_FILTER_ENHANCEMENT.md`
- `docs/ERP_GRID_ACTION_COLUMN_STANDARDIZATION.md`
- `docs/ERP_DARK_LIGHT_MODE_FEASIBILITY.md`
- `docs/ERP_LOCAL_FINAL_POLISH_REPORT.md` (this file)
