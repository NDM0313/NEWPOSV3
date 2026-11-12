# 2026-07-25 — Expenses global dates + Roznamcha multi-account filter

## Expenses

- Header **Today / week / etc.** (`GlobalFilterContext`) now filters the Expenses list and overview (`setCurrentModule('expenses')`).
- Local Filter panel From/To **override** the header range; Clear restores header range.
- Preset chips: Today, This Week (Sat–Fri), This Month, Clear.
- List date compare uses local calendar helpers (no UTC `toISOString` day-shift).

## Roznamcha (web)

- `PaymentAccountFilter = string | string[] | null` on `roznamchaService` (+ unified main/parity/shadow/preview); queries use `.eq` / `.in`.
- Ledger account control: parent-aware **multi-select** (parent toggles all child leaves); selection is always leaf ids.
- **Save as default** / Reset persist per company in `localStorage` (`roznamcha-default-payment-accounts:<companyId>`).
- Payment account loader includes `parent_id` for grouping.
