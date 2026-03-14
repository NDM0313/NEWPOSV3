# ERP Theme Closeout – Visible Dark Consistency

**Date:** 2026-03-14  
**Scope:** Local only. Consistent dark base across list/report/accounting screens.

---

## Why the previous pass was incomplete

- Only **InventoryDashboard** was given a page wrapper; the **inventory** route actually renders **InventoryDesignTestPage**, so the visible Inventory screen was unchanged.
- Reports and Contacts did not get a unified page background, so center/panel areas could still look inconsistent.

---

## Visible theme standard

- **Page background:** `bg-[#0B0F19]` (same as Sales) so the full viewport is one dark base.
- **Card / table container:** `bg-gray-900/50` or `bg-gray-900` with `border border-gray-800 rounded-xl`.
- **Table header:** `bg-gray-950/80` or `bg-gray-900` with `border-b border-gray-800`.
- **No** white or light panels in the main content area.

---

## Screens fixed

| Screen | Component | Change |
|--------|-----------|--------|
| **Inventory** | InventoryDashboard | Already had `min-h-full bg-[#0B0F19] ... p-6` from earlier pass. (Shown only if route were to use it.) |
| **Inventory** (actual route) | InventoryDesignTestPage | Already uses `bg-[#0B0F19]` on root; table uses `bg-gray-900/50 border border-gray-800`. No change this pass. |
| **Reports** | ReportsDashboardEnhanced | Root wrapper set to `min-h-full bg-[#0B0F19]` (was `bg-gray-950`) so it matches Sales/Inventory. |
| **Contacts** | ContactList | Root wrapper set to `min-h-full bg-[#0B0F19] text-white ... p-6` so the whole page has the same dark base. Table already `bg-gray-900 border border-gray-800`. |
| **Products** | ProductsPage | Already has `bg-[#0B0F19]` on root. No change. |
| **Purchases** | PurchasesPage | Already has `bg-[#0B0F19]` on root. No change. |
| **Sales** | SalesPage | Already has `bg-[#0B0F19]`. No change. |

---

## Files changed

- `src/app/components/reports/ReportsDashboardEnhanced.tsx` – root div: `bg-gray-950` → `min-h-full bg-[#0B0F19]`.
- `src/app/components/contacts/ContactList.tsx` – root div: added `min-h-full bg-[#0B0F19] text-white ... p-6`.

---

## Verification

1. Open **Inventory** – entire screen dark; table area gray-900/50, no white panels.
2. Open **Reports** – same dark base; cards and tables gray-900 / gray-800 borders.
3. Open **Contacts** – same dark base; table and cards consistent.
4. Open **Accounting** – existing dark styling; no new change in this pass.

---

## Rollback

- **ReportsDashboardEnhanced:** Revert root to `bg-gray-950`.
- **ContactList:** Remove `min-h-full bg-[#0B0F19] text-white` and `p-6` from root.
