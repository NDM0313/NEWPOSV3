# ERP Sales List and Draft Closeout Report

## Summary

Three targeted fixes were implemented for the Sales list and draft lifecycle (local only):

1. **Draft lifecycle** – Draft stays draft when reopening; Convert to Final sets status and type correctly.
2. **Pagination** – All pages show the correct rows (client-side filter/sort then slice).
3. **Latest ordering** – Default sort is by created-at descending so newest sales appear first.

---

## Issue 1 – Draft sale lifecycle

**Root cause:** SaleForm initialized status from `initialSale.type` only (quotation vs final), ignoring the saved `status` (draft/quotation/order/final). Drafts could therefore open as final or quotation incorrectly.

**Files changed:**
- `src/app/components/sales/SaleForm.tsx` – Pre-fill status from `(initialSale as any).status` when it is draft/quotation/order/final; otherwise keep type-based fallback.
- `src/app/components/sales/SalesPage.tsx` – Convert to Final now calls `updateSale(sale.id, { status: 'final', type: 'invoice' })`.

**Behaviour:** Reopening a draft shows Draft and stays editable. List action “Convert to Final” marks the sale as final and type invoice; stock and list refresh unchanged.

**Rollback:** Revert the status pre-fill block in SaleForm to the previous type-only logic; revert Convert to Final to only pass `status: 'final'`.

---

## Issue 2 – Sales list pagination

**Root cause:** Server returned one page (offset/limit) while the UI applied date/search/status filters only to that page. So on page 2, the 50 rows might all be outside the selected date range, yielding an empty table with “Showing 51 to 100 of 122”.

**Files changed:**
- `src/app/context/SalesContext.tsx` – Load a single batch of sales (offset 0, limit 5000); removed `page` from `loadSales` deps so changing page does not refetch.
- `src/app/components/sales/SalesPage.tsx` – `paginatedSales` = `sortedSales.slice(page * pageSize, (page + 1) * pageSize)`; `totalFilteredCount` = `sortedSales.length`; pagination uses `totalFilteredCount`; effect to clamp page when total pages shrinks.

**Behaviour:** Filter and sort run on the loaded batch; each page shows the correct slice of that filtered/sorted list. “Showing X to Y of Z” uses the filtered count.

**Rollback:** Restore context to page-based fetch (offset/limit with `page` in deps); restore SalesPage to using full `sortedSales` for display and `totalCount` for pagination.

---

## Issue 3 – Latest sales ordering

**Root cause:** Default sort was by invoice `date` desc, not by creation time. Newest-created sales were not guaranteed to appear first.

**Files changed:**
- `src/app/components/sales/SalesPage.tsx` – Default `sortKey` set to `'createdAt'`, `sortDir` `'desc'`; added `createdAt` to sort key type and `getSaleSortValue` (using `createdAt` or fallback to `date`).

**Behaviour:** With default sort, the list is ordered by creation date descending; newly created sales appear at the top.

**Rollback:** Set default sort back to `'date'` and remove `createdAt` handling.

---

## Verification checklist

| Case | Description | How to verify |
|------|-------------|----------------|
| A | Save as Draft → appears as Draft | Save sale as Draft, check list badge and reopen form |
| B | Open/Edit Draft → remains editable | Open draft, change and save; should stay draft if status not changed |
| C | Convert Draft to Final | Use “Convert to Final” on draft; sale becomes Final, type invoice |
| D | Page 1/2/3 show correct rows | 50 per page, 122 total: page 2 shows 51–100, page 3 shows 101–122 |
| E | Newest sales at top | Default sort; create a new sale and confirm it is at top of list |
| F | New sales in related lists | Confirm in commission/sales reports if they consume same data |

---

## Rollback (all issues)

- **Draft:** SaleForm status init + SalesPage convert_to_final as above.
- **Pagination:** SalesContext load one page per request; SalesPage no slice, use totalCount for pagination.
- **Ordering:** SalesPage default sort back to `date`.

All changes are local; no VPS or production changes in this pass.
