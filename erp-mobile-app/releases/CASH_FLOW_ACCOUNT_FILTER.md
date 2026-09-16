# Cash Flow — account filter + full transaction list (mobile)

**Date:** 2026-07-22  
**App:** NDM ERP (Capacitor / `/m/`)  
**Scope:** Mobile Cash Flow report only (no migration, no GL/posting change)

---

## What changed

1. **Full list** — removed the previous `rows.slice(0, 100)` cap so every cash/bank/wallet movement in the selected date range is shown.
2. **Account filter** — horizontal chips under the date range: **All** plus each payment account (`code — name` from `getPaymentAccounts`). Selecting an account reloads the report for that account only.
3. **Any transaction type** — sale, purchase, expense, transfer, rental, journal, etc. that touch the selected liquidity account appear (same source as Roznamcha / cash-bank ledger).
4. **Row account label** — when **All** is selected, each row shows a small account label (e.g. `1000 — CASH G140`) so you can see which drawer/bank moved.
5. **Stats** — Cash In / Cash Out always reflect the filtered set. **Closing** is shown only for **All** (account-specific opening is not shown as Closing to avoid a misleading figure). With a filter, an **Entries** count is shown instead.

---

## Loader behavior

File: `erp-mobile-app/src/api/unifiedReports.ts` → `loadMobileCashFlow`

| Mode | Source |
|------|--------|
| **All** accounts | Prefer unified `get_unified_cash_bank_ledger` when enabled; else legacy `getRoznamcha(..., 'all')` |
| **One account** | Legacy `getRoznamcha(..., paymentLedgerAccountId)` — filters by `payment_account_id` (reliable). Unified cash-bank RPC has no account id, so it is skipped for filtered views. |

`CashFlowRow` now optionally carries `accountLabel`, `accountName`, `accountCode`, `paymentAccountId`.

---

## UI

File: `erp-mobile-app/src/components/accounts/reports/CashFlowReport.tsx`

- Loads payment accounts once per `companyId`
- Passes `{ id, code, name }` into `loadMobileCashFlow` when a chip is selected
- Renders all rows (no hard cap)

---

## Verify

1. Accounts → Reports → Cash Flow → date range with known activity.
2. **All** — many rows; each can show account label; Closing visible.
3. Pick **CASH G140** (or branch cash) — only that account’s movements; sale/expense/etc. still listed if they hit that account.
4. Pick a bank — only bank movements.
5. Hard-refresh `https://erp.dincouture.pk/m/` after deploy.
