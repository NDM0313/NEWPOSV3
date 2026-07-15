# List pagination — shipped vs remaining (2026-07-15)

## Shipped in this change

| Surface | Default rows | Page size options | Notes |
|---|---|---|---|
| Ledger & Statement Center V2 (Accounting → Account Statements) | **50** | 50 / 100 / 200 | Client-side slice of filtered statement rows; summaries / CSV / PDF still use full filtered series |
| Shared [`Pagination`](../../src/app/components/ui/pagination.tsx) | — | **50 / 100 / 200** (new default) | Rows-per-page `<select>` was missing; page numbers + “Page X of Y” now always visible when mounted |
| Cash Flow (prior session) | 50 | 50 / 100 / 200 | Table pager + HTTP 431 fix on `payments.reference_id` IN batches |

## Already had pagination (no work required this pass)

Sales, Purchases, Products, Contacts, Rentals, Stock report, Stock movement history (product accordion), Accounting dashboard bits that already use `Pagination`.

## Remaining tasks (next waves)

### Wave A — Accounting statement / book tables still painting all rows

Priority order for freeze risk (wide date ranges):

1. **Journal Entries** list / Advanced accounting entry grids (if painting hundreds of DOM rows).
2. **Day Book** — confirm pager parity with Roznamcha (partial coverage today).
3. **Party Ledger** / Customer–Supplier report tables that still `.map` full series into the DOM.
4. **Trial Balance / P&L detail drill-downs** that expand to line lists without a pager.
5. **Roznamcha** — already paginated; re-check after 431 fix that Legacy vs Unified both stay responsive.

### Wave B — Ops / inventory reports with incomplete page-size UX

1. Screens that call `<Pagination onPageSizeChange={…}>` but relied on the old component (no Rows select) — they now get 50/100/200 automatically; **verify** each list’s local default `pageSize` is **50** (some may still default to 25 or 10).
2. Studio sales / workflow long lists — confirm `pageSize` default 50.
3. Expenses dashboard list — confirm pager + default 50.

### Wave C — Performance beyond DOM paging (separate approval)

These reduce fetch cost, not only paint cost:

1. Server `LIMIT` / cursor on unified ledger / cash-bank RPCs (running-balance design required).
2. Ledger V2: optional period auto-narrow (same idea as Cash Flow >92 days → current month) when header is FY-wide.
3. Strip or gate attachment enrichment for off-page rows on shared Roznamcha/CF loaders.

## Acceptance checklist (Ledger V2 — this pass)

- [ ] Open Accounting → Account Statements / Ledger V2 with a party that has many rows.
- [ ] Table shows at most **50** rows initially.
- [ ] Footer shows Showing… / Page X of Y / Rows select / page number buttons / Next.
- [ ] Changing Rows to 100/200 updates the table; KPIs and export still reflect **all** filtered rows.
- [ ] Search / type / entity change resets to page 1.

## Out of scope

- Full Chart of Accounts picker on Cash Flow (liquidity books only).
- R8-R2 legacy deletion merge to production.
- DB migrations for server-side paging.
