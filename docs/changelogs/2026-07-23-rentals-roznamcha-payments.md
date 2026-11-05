# 2026-07-23 — Rentals, Roznamcha liquidity, order payments

## Rentals (web)

- List: **Actions** column first (before Created); full row click opens View detail.
- Edit drawer: submit label **Update Order**; persists `booking_date`; hydrates dates via local parse (no UTC 05:00 AM artifact).
- List **Created** prefers `booking_date` over `created_at`.
- Edit: **Advance / paid** field locked — change cash only via View Payments / Receive Payment (not booking edit).

## Rentals (mobile)

- List/detail dates: stop using `toISOString().slice(0, 10)`; use local calendar helpers (`toLocalDateString` / `rentalDateToYmd`).
- `createBooking` duration uses local date math (`parseLocalDateInput`).

## Roznamcha / unified liquidity

- `_unified_ledger_is_liquidity_account`: name heuristic no longer treats liability AP names like **Payable — CASH PURCHASE** as cash.
- TS mirrors: `liquidityPaymentAccount` (web + mobile) + `unifiedLedgerLiquidityAccount`.
- Migration: `migrations/20260723180000_unified_ledger_liquidity_exclude_ap_cash_name.sql`.
- Result: purchase cash payment shows **one** Cash Out row (e.g. PAY-0237 / CASH G140), not JE + AP false legs.

## Sale payments

- `canRecordSaleCustomerPayment`: allow customer receipts on sale status **order** + **final** (not draft/quotation).
- Revenue/COGS/stock gate (`canPostAccountingForSaleStatus`) remains final-only.

## Other in this batch

- Roznamcha unified mapper `rows` shape + related loader/parity wiring.
- Perf migration (if present): `migrations/20260723140000_perf_low_stock_and_account_balances.sql`.
- Related accounting/settings/account/product service touch-ups from the same working tree.
