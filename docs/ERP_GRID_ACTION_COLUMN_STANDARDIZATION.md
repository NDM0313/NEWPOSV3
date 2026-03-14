# Grid Action Column Standardization

**Date:** 2026-03-14  
**Scope:** Local only. Action column moved to first column for core list views.

---

## Requirement

- For list/grid views, move the Action column to the beginning (first column) instead of the last.
- Purchases list: keep visible delete icon in addition to the 3-dot menu (already present; only column order changed).

---

## Changes

### 1. Sales (SalesPage)

- Added `'actions'` at the start of `columnOrder`.
- Added `actions: true` to `visibleColumns`, `getColumnWidth('actions') = '60px'`, `alignments['actions'] = 'text-center'`, `labels['actions'] = 'Actions'`.
- `gridTemplateColumns` built from `columnOrder` only (no trailing `60px`).
- Header: when `key === 'actions'` render "Actions" cell; else existing sortable header.
- Body: when `key === 'actions'` render the existing Actions dropdown (View/Edit/Convert/Payments/Ledger/Share/Print/Delete/Return/etc.); else `renderColumnCell(key, sale)`.
- `renderColumnCell('actions', sale)` returns `null`.

### 2. Inventory (InventoryDashboard)

- Table header: moved "Actions" `<th>` to the first column.
- Table body: moved the Actions cell (Adjust + Transfer buttons) to the first `<td>` in each row.

### 3. Contacts (ContactList)

- Table header: first column is empty (actions); removed the last empty header so the first column is the actions column.
- Table body: moved the actions dropdown from the last `<td>` to the first `<td>`.

### 4. Purchases (PurchasesPage)

- Added `'actions'` at the start of `columnOrder`.
- Added `actions: true` to `visibleColumns`, `getColumnWidth('actions') = '60px'`, `alignments['actions']`, `columnLabels['actions'] = 'Actions'`.
- `gridTemplateColumns` built from `columnOrder` only (no trailing `60px`).
- Header: when `key === 'actions'` render "Actions"; else existing header.
- Body: when `key === 'actions'` render the existing actions block (visible delete button + 3-dot menu); else `renderPurchaseCell(purchase, key)`.
- Purchases already had a visible delete icon when `canDeletePurchase`; no new delete action added.

### 5. PurchaseDashboard

- Already had the action column first (empty `<th>` then Date/Reference/…). No change.

---

## Files changed

- `src/app/components/sales/SalesPage.tsx`
- `src/app/components/inventory/InventoryDashboard.tsx`
- `src/app/components/contacts/ContactList.tsx`
- `src/app/components/purchases/PurchasesPage.tsx`

---

## Rollback

- Sales/Purchases: remove `'actions'` from the start of `columnOrder`, remove `actions` from `visibleColumns`/widths/alignments/labels, restore trailing `60px` in `gridTemplateColumns`, and restore the standalone Actions column after the map.
- Inventory: move Actions `<th>` and the actions `<td>` back to the last column.
- Contacts: move the actions `<td>` back to the last column.
