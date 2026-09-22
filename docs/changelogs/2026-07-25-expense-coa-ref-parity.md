# 2026-07-25 — Expense date, row preview, COA/EXP reference parity

## Expenses UI

- List + detail + export dates use `formatRelativeListDateTime` (`en-PK`, e.g. `16 Jul 2026`) instead of bare `toLocaleDateString()`.
- Table row click opens **View Details** (same as kebab); kebab / attachment use `stopPropagation`.
- Detail header: primary `expense_no`; secondary **Payment / COA** ref when linked payment differs.

## Numbering unify (forward + safe backfill)

- Migration `migrations/20260725140000_expense_payment_reuse_expense_no.sql`:
  - `_ensure_expense_payment_row` uses `expenses.expense_no` as `payments.reference_number` (falls back to `payment` sequence only on missing no / unique conflict).
  - Historical UPDATE aligns payment refs to `expense_no` where unique allows.
- `AccountingContext` expense payment insert: if `metadata.expenseId` present, reuse that row’s `expense_no` (no second EXP burn). Add Entry–only cash (no expense row) still allocates EXP.

## COA detail

- `TransactionDetailModal`: load `expenses.expense_no` for expense-linked JE/payment; `voucherDisplayRef` prefers document EXP over JE / mismatched payment voucher.
