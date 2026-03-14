# ERP Final Theme / Background / Border Mismatch Fix

**Date:** 2026-03-14  
**Scope:** Local only. Targeted fixes for dark theme consistency.

---

## Observed issue

Some pages (e.g. Inventory center/table area) showed mismatched background tones or light/odd panels on interaction or open/click.

---

## Standard (from ERP_UI_THEME_NORMALIZATION.md)

- **Card / section:** `bg-gray-900/50 border border-gray-800 rounded-xl`
- **Table container:** `bg-gray-900` or `bg-gray-900/50` + `border border-gray-800 rounded-xl`
- **Table header:** `bg-gray-800/50` or `bg-gray-950/80` + `border-b border-gray-800`
- **Borders:** `border-gray-800` (primary)
- **Row hover:** `hover:bg-gray-800/30`

---

## Changes made

1. **InventoryDashboard**
   - Wrapped page in `min-h-full bg-[#0B0F19] text-white space-y-6 p-6` so the whole Inventory screen uses the same dark base as Sales (`#0B0F19`).
   - Table already used `bg-gray-900 border border-gray-800 rounded-xl`; no change.
   - Action column moved to first (see ERP_GRID_ACTION_COLUMN_STANDARDIZATION.md).

2. **Payment choice dialog (SaleForm)**
   - Already used `AlertDialogContent className="bg-gray-900 border-gray-700 text-white"`; no change.

3. **Print layout modals**
   - SaleForm and ViewSaleDetailsDrawer use `bg-white` for the inner invoice preview (intentional for print). Outer overlay is `bg-black/80`. No change.

---

## Files touched

- `src/app/components/inventory/InventoryDashboard.tsx` – page wrapper background; Actions column first.

---

## Rollback

Revert InventoryDashboard: remove `min-h-full bg-[#0B0F19] text-white` and `p-6` from the root div if desired; restore `space-y-6` only.
