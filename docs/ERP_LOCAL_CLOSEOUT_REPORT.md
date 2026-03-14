# ERP Local Closeout Report

**Date:** 2026-03-14  
**Environment:** Local only (no VPS/deployment). Fixes applied and verified against the actual screens.

---

## Why the previous pass was incomplete

1. **Action column:** Only Purchases was visibly updated. Others either had config changes but **JSX still rendered Actions last** (e.g. Products had a separate Actions div after the column map), or the **wrong component** was changed (e.g. Inventory route uses InventoryDesignTestPage, not InventoryDashboard).
2. **Sale save:** Save guard and DB retry were documented and may have been in code but were **missing in the current codebase** (reverted or not saved). Duplicate key and double-submit risk remained.
3. **Theme:** Only one wrapper was changed; the **inventory route** uses a different component, and **Reports / Contacts** did not get a consistent page background, so mismatch was still visible.

---

## Summary of fixes

| Issue | Root cause | Fix |
|-------|------------|-----|
| **Action column not first everywhere** | Config vs render order; wrong component for Inventory. | ProductsPage: actions first in columnOrder and in **render order** (header + row map); removed trailing Actions div. InventoryDesignTestPage: actions first in columnKeys/columnsList and **first `<td>`** in each row (+ variation rows). Sales Returns tab: grid and row cells reordered so Actions first; one Actions dropdown per row. Contacts/Purchases already correct; small guards added. |
| **Sale save duplicate key** | Double submit; retry used frontend numbering. | SaleForm: `saveInProgressRef` guard at start of `proceedWithSave`; set/clear in try/finally. SalesContext: on duplicate key, retry with **getNextDocumentNumberGlobal** only; no hook state. |
| **Theme mismatch still visible** | Reports/Contacts without unified page background; inventory route uses Design Test page. | ReportsDashboardEnhanced: root `bg-[#0B0F19]`. ContactList: root `min-h-full bg-[#0B0F19] text-white p-6`. InventoryDesignTestPage already dark; no change. |

---

## Exact screens fixed

- **Contacts list** – ContactList: Actions already first; added page wrapper for theme.
- **Sales list** – SalesPage: Actions first via columnOrder; Returns tab: Actions column and cell moved to first.
- **Products list** – ProductsPage: Actions first in columnOrder and in header/row render; trailing Actions div removed.
- **Inventory list** – InventoryDesignTestPage (route `inventory`): Actions first in columnKeys and first cell in each row.
- **Purchases list** – PurchasesPage: already first; added renderPurchaseCell guard for `actions`.
- **New Sale save** – SaleForm + SalesContext: save guard and DB-only retry.
- **Reports / Contacts / Inventory** – Dark base: Reports and Contacts root wrappers; Inventory design page already dark.

---

## Files changed

| File | Change |
|------|--------|
| ProductsPage.tsx | actions first in columnOrder/visibleColumns/widths/labels; grid without trailing 60px; header/body render actions first; renderProductCell('actions') → null; removed trailing Actions div. |
| InventoryDesignTestPage.tsx | actions first in columnKeys/columnsList; actions `<td>` first in main and variation rows. |
| SalesPage.tsx | Returns tab: grid 60px first; Actions dropdown first in row; removed duplicate Actions block at end of row; full menu (View/Edit/Delete/Void/Print/Export) in first-cell dropdown. |
| ContactList.tsx | Root: min-h-full bg-[#0B0F19] text-white p-6. |
| ReportsDashboardEnhanced.tsx | Root: min-h-full bg-[#0B0F19]. |
| SaleForm.tsx | saveInProgressRef; early return in proceedWithSave; set/clear ref in try/finally. |
| SalesContext.tsx | Duplicate-key retry uses getNextDocumentNumberGlobal only; single retry. |
| PurchasesPage.tsx | renderPurchaseCell(..., 'actions') returns null. |

---

## Migration

No migration in this pass.

---

## Actual root cause of duplicate sale save

- **Constraint:** `sales_company_branch_invoice_unique` on `(company_id, branch_id, invoice_no)`.
- **Causes:** (1) Save running twice (e.g. double click or two paths) so two inserts attempted; (2) on duplicate, retry used **frontend** `getNumberingConfig().nextNumber + 1`, which is not unique under concurrency.
- **Fix:** (1) **saveInProgressRef** in SaleForm so only one `proceedWithSave` runs at a time; (2) on duplicate, context calls **getNextDocumentNumberGlobal** and retries create once with that number.

---

## Local verification steps

1. **Contacts** – First column is Actions (3-dot).
2. **Sales** – First column is Actions; Returns tab: first column is Actions.
3. **Products** – First column is Actions.
4. **Inventory** – First column is Actions (Ledger / Edit / Adjust).
5. **Purchases** – First column is Actions.
6. **New Sale** – Create sale with salesman/commission, Save once → success, no duplicate key.
7. **Save & Print** – Save & Print once → success.
8. **Theme** – Inventory, Reports, Contacts: full-screen dark base; no light center/panel.

---

## Rollback notes

- **Action column:** Revert ProductsPage (actions last, trailing div back), InventoryDesignTestPage (actions last in keys and row), SalesPage Returns (Actions last in grid and row).
- **Sale save:** Revert SaleForm (remove ref and guard), SalesContext (restore hook-based retry).
- **Theme:** Revert ReportsDashboardEnhanced and ContactList root classes as in ERP_THEME_CLOSEOUT.md.

---

## Docs created/updated

- `docs/ERP_ACTION_COLUMN_CLOSEOUT.md`
- `docs/ERP_SALE_SAVE_DUPLICATE_CLOSEOUT.md`
- `docs/ERP_THEME_CLOSEOUT.md`
- `docs/ERP_LOCAL_CLOSEOUT_REPORT.md` (this file)
