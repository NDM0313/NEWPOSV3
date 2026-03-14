# ERP Sales List Pagination Fix

## Problem

- Total count showed many sales (e.g. 122).
- Page 1 had data; pages 2 and 3 were empty even though “Showing 51 to 100 of 122 results” (or similar) was displayed.

## Root cause

- **Context** requested one page at a time from the API: `getAllSales(companyId, branchId, { offset: page * pageSize, limit: pageSize })`.
- **SalesPage** applied filters (date range, search, status, etc.) **client-side** to that single page of data.
- So on page 2, `sales` contained only rows 51–100 from the server (by `created_at` desc). If the global date range (or other filters) excluded those rows, the filtered list became empty while the pagination still showed “51 to 100 of 122”.

Mismatch: **server pagination** (by offset/limit) vs **client-side filtering** on the current page only.

## Fix

### 1. SalesContext.tsx – Load one full batch for client-side pagination

**File:** `src/app/context/SalesContext.tsx`

- Removed `page` from the `loadSales` dependency list.
- `loadSales` now always requests a single batch: `{ offset: 0, limit: SALES_LOAD_CAP }` with `SALES_LOAD_CAP = 5000`.
- Total count is still set from the API response (total from server for that company/branch).
- When the user changes page, the context does **not** refetch; it only holds the current batch of sales.

### 2. SalesPage.tsx – Filter, sort, then slice for current page

**File:** `src/app/components/sales/SalesPage.tsx`

- **Filtering and sorting** are unchanged: `filteredSales` → `sortedSales` (by sort key/dir).
- **Total for pagination:** `totalFilteredCount = sortedSales.length` (filtered total), not context `totalCount`.
- **Displayed rows:** `paginatedSales = sortedSales.slice(page * pageSize, (page + 1) * pageSize)`.
- **Pagination UI:** `totalItems={totalFilteredCount}` so “Showing X to Y of Z results” uses the filtered count.
- **totalPages** = `Math.ceil(totalFilteredCount / pageSize)`; **currentPage** clamped so it never exceeds totalPages.
- **Effect:** When filters change, page is reset to 0. When total pages shrink (e.g. filter leaves one page), page is clamped to the last valid page.

Result: Every page shows the correct slice of the **filtered and sorted** list; page 2 shows rows 51–100 of that list, not rows 51–100 of the raw server response.

## Verification

- **Case D:** With 122 sales and 50 per page: page 1 shows 1–50, page 2 shows 51–100, page 3 shows 101–122; no empty pages.
- With a date filter that leaves 30 sales: one page of 30, “Showing 1 to 30 of 30 results”; no empty second page.

## Rollback

- In SalesContext: restore `loadSales` to use `{ offset: page * pageSize, limit: pageSize }` and add `page` (and `pageSize`) back to its dependency array.
- In SalesPage: restore `paginatedSales = useMemo(() => sortedSales, [sortedSales])` and `totalItems={totalCount}`; remove the slice, `totalFilteredCount`, and the clamp effect.
