# ERP Action Column Closeout – First Column Globally

**Date:** 2026-03-14  
**Scope:** Local only. Action column is the first visible column on all requested list/grid pages.

---

## Why the previous pass was incomplete

Config (e.g. `columnOrder`) was updated but either:
- The **actual JSX render order** still output Actions last (e.g. a separate Actions div after the column map), or
- The **route** used a different component (e.g. Inventory shows **InventoryDesignTestPage**, not InventoryDashboard), so only some screens were fixed.

---

## Screens fixed (visible behavior)

| Screen | Component | Change |
|--------|-----------|--------|
| **Contacts** | ContactList | Actions column was already first (first `<th>` and first `<td>`). Added page wrapper `bg-[#0B0F19]` for theme. |
| **Sales** | SalesPage | `columnOrder` already had `actions` first; header and row map over `columnOrder` so Actions renders first. **Returns tab:** grid columns and row cells reordered so Actions is first (60px then data columns); single Actions dropdown at start of each return row. |
| **Products** | ProductsPage | Added `actions` to `columnOrder` and `visibleColumns` at the **start**; `gridTemplateColumns` built from columnOrder only (no trailing 60px). Header: when `key === 'actions'` render "Actions" first. Body: when `key === 'actions'` render the full Actions dropdown first; else `renderProductCell`. Removed the standalone Actions div that was after the map. |
| **Inventory** | InventoryDesignTestPage | **This is the view shown for `currentView === 'inventory'` in App.** Put `actions` first in `columnKeys` and `columnsList`. Moved the actions `<td>` (Ledger / Edit / Adjust) to the **first** cell in each data row. Variation rows: added actions cell first ("—"). |
| **Purchases** | PurchasesPage | Already had Actions first from earlier pass. Added `renderPurchaseCell(..., 'actions')` → `null` for safety. |

---

## Files changed

- `src/app/components/products/ProductsPage.tsx` – actions first in columnOrder/visibleColumns/widths/labels; header and row render actions first; removed trailing Actions div.
- `src/app/components/inventory/InventoryDesignTestPage.tsx` – actions first in columnKeys/columnsList; actions `<td>` first in main and variation rows.
- `src/app/components/sales/SalesPage.tsx` – Returns tab: grid columns `60px 120px 130px ...`; Actions dropdown first in each return row; removed duplicate Actions block at end of row.
- `src/app/components/contacts/ContactList.tsx` – (Actions already first); added page wrapper for theme.
- `src/app/components/purchases/PurchasesPage.tsx` – guard in renderPurchaseCell for `actions`.

---

## Verification

1. **Contacts** – Open Contacts; first column is the 3-dot menu.
2. **Sales** – Open Sales; first column is Actions (3-dot). Switch to Returns; first column is Actions.
3. **Products** – Open Products; first column is Actions (3-dot).
4. **Inventory** – Open Inventory (Inventory Design Test page); first column is Actions (Ledger / Edit / Adjust).
5. **Purchases** – Open Purchases; first column is Actions (delete + 3-dot).

---

## Rollback

- **ProductsPage:** Remove `actions` from start of columnOrder/visibleColumns; add back trailing `60px` in gridTemplateColumns; render Actions in a separate div after the map; remove `if (key === 'actions')` branch in header/body.
- **InventoryDesignTestPage:** Put `actions` back at end of columnKeys/columnsList; move actions `<td>` back to last position in row; remove duplicate actions cell from variation rows.
- **SalesPage Returns:** Restore grid to `... 60px` (Actions last); move the full Actions dropdown back to the end of each return row.
