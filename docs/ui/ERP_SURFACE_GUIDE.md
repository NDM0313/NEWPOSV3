# ERP Surface Guide

Canonical UI surfaces for the NEWPOSV3 web ERP. Use these instead of hardcoded hex colors or stacked semi-transparent backgrounds.

## Token mapping

| Old pattern | Use instead |
|---|---|
| `bg-[#111827]` | `bg-background` |
| `bg-[#0B0F19]` / `bg-[#0B1019]` | `bg-secondary` or `bg-popover` |
| `bg-gray-900/50 border border-gray-800` | `bg-card border border-border` |
| `bg-gray-950/50` (table headers) | `bg-muted/40 border-b border-border` |
| `text-gray-400` (muted copy) | `text-muted-foreground` |
| `bg-[#0F1419]` / `bg-[#1F2937]` | `bg-muted/40` or `bg-card` |
| `bg-blue-950/20` info panels | `bg-primary/5 border-primary/25` |
| `text-emerald-100` on tinted banner | `text-emerald-800 dark:text-emerald-100` |

Source of truth: [`src/styles/tokens.css`](../../src/styles/tokens.css) → [`src/styles/theme.css`](../../src/styles/theme.css).

## React components

Import from [`src/app/components/ui/erp-surfaces.tsx`](../../src/app/components/ui/erp-surfaces.tsx):

- **`ErpPage`** — full-height page shell (`bg-secondary text-foreground`). Never use `bg-secondary text-white`.
- **`ErpPageHeader`**, **`ErpPageTitle`**, **`ErpPageDescription`**
- **`ErpSurfaceCard`** — single-layer panel (`bg-card border rounded-xl`)
- **`ErpFilterPanel`** — filter box (`rounded-lg border border-border bg-card p-4`)
- **`ErpInfoPanel`** — tinted callout (`variant`: `info` | `success` | `warning` | `cyan`; use dark text in light mode)
- **`ErpSegmentedTab`**, **`ErpSegmentedTabSm`** — pill tab buttons (inactive `bg-muted`, active `bg-primary`)
- **`ErpTableShell`** + **`ErpTable`** / **`ErpTableHead`** / **`ErpTableBody`** / **`ErpTableRow`** / **`ErpTableCell`**
- **`ErpMoneyCell`**, **`ErpStatusBadge`**, **`ErpMovementBadge`**, **`ErpCategoryBadge`**
- **`ErpPositiveMoney`**, **`ErpNegativeMoney`**, **`ErpDrawerPanel`** — themed currency digits and drawer shell
- **`ErpDataGridShell`**, **`ErpDataGridHeader`**, **`ErpDataGridHeaderRow`**, **`ErpDataGridBody`**, **`ErpDataGridRow`**, **`ErpDataGridCell`** — CSS-grid list tables (Sales, Purchases) with **per-row** hover

Inventory lists use [`InventoryOverviewTable`](../../src/app/components/inventory/InventoryOverviewTable.tsx) (`<table>` based).

## Row hover

List tables highlight the **entire row** on mouse over, not individual cells.

- CSS variable: `--erp-row-hover` (defined in [`theme.css`](../../src/styles/theme.css); defaults use `color-mix` with `--accent`)
- Applied on **`ErpDataGridRow`** and **`ErpTableRow`** via `hover:bg-[var(--erp-row-hover)]`
- Do **not** add `hover:bg-*` on `ErpDataGridCell` or `ErpTableCell`
- Users can customize row-hover color under **Settings → Appearance → Customize colors**

## Grid tables vs table tables

| Pattern | Use when |
|---|---|
| `ErpTable` + `ErpTableCell` | Standard HTML tables (inventory, reports, returns lists) |
| `ErpDataGrid*` | Wide CSS-grid lists with custom column widths (Sales, Purchases) |

Grid rows use **row-level** hover on `ErpDataGridRow`; cells stay transparent on hover.

## CSS utilities

[`src/styles/erp-patterns.css`](../../src/styles/erp-patterns.css) exposes:

- `erp-page`, `erp-page-header`, `erp-surface-card`, `erp-table-shell`, `erp-table-header`, `erp-table-row`, `erp-table-row-child`, `erp-data-grid-row`, `erp-money-positive`, `erp-money-negative`, `erp-overlay`, `erp-drawer-panel`

## Forbidden patterns

1. **Nested `/50` or `/60` backgrounds** on tables (e.g. `bg-gray-900/50` inside `bg-secondary` page) — causes visible “box” misalignment and extra compositing.
2. **Per-row tinted blocks** for child/variation rows — use `ErpTableRow child` (left border indent) instead of `bg-gray-900/60`.
3. **Money / currency digits** — use `ErpPositiveMoney`, `ErpNegativeMoney`, or `erp-money-positive` / `erp-money-negative` utilities (`--erp-money-positive`, `--erp-money-negative`). Do not use raw `text-green-400` for amounts.
4. **New hardcoded hex** in feature components — add to `tokens.css` if a new token is required.
5. **Shell chrome** — Sidebar, header, and mobile nav must use `bg-sidebar`, `text-sidebar-foreground`, `border-sidebar-border` (driven by theme engine in light/dark).
6. **List row borders** — data list rows, grid rows, and command menu items use `border-b border-border` (or `divide-border` on containers). Never `border-gray-800` / `divide-gray-800`.
7. **Page shells** — use `ErpPage` or `bg-secondary text-foreground`. Never `bg-secondary text-white` (breaks light mode).
8. **Pagination footer** — [`pagination.tsx`](../../src/app/components/ui/pagination.tsx) uses `bg-muted/40 border-t border-border`; never `#0F1419`.
9. **Info / basis banners** — use `ErpInfoPanel` or `reportBasisBannerClass()`; tinted backgrounds need **readable text in light mode** (`text-{color}-800 dark:text-{color}-100`).
10. **Dropdown menus** — do not override `DropdownMenuContent` with hex backgrounds; use default `bg-popover`.
11. **Drawers / overlays** — use `ErpDrawerPanel` or `bg-background` + `bg-[var(--erp-overlay)]`; avoid `bg-[#0B0F17]` and `bg-black/80`.

## Appearance (Settings)

Under **Settings → General → Appearance**, users can configure:

| Setting | Options |
|---|---|
| **Color mode** | Light / Dark (toggles `document.documentElement` `.dark` class) |
| **Preset** | Default, High Contrast, Compact |
| **Custom colors** | Surfaces (background, panel, card, text, accent, border) plus advanced: row hover, sidebar/chrome, money positive/negative, overlay. Color pickers are collapsed by default — click **Edit colors** to open; **Use preset colors** returns to Default preset. |
| **Font size** | Small / Default / Large |

Preferences are stored in `localStorage` per user (`erp-ui-preferences:{userId}`) and applied via [`applyErpTheme()`](../../src/app/lib/erpThemePresets.ts) which sets CSS variables on `<html>`.

Legacy saves (`{ preset: 'dark' }`) migrate automatically to `{ colorMode: 'dark', preset: 'default' }`.


Use [`Card`](../../src/app/components/ui/card.tsx) for form sections and static content blocks. Use `ErpTableShell` when the primary content is a scrollable data table.
