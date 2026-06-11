# Roznamcha home expense fix (2026-06-10)

## Symptoms

- Home expense paid from **cash** appeared as **Cash In (+)** in Roznamcha (should be Cash Out).
- Home expense paid from **mobile wallet** missing from Roznamcha while COA/JE correct.

## Root cause

1. Roznamcha reads expense cash movement from **`payments`** rows (`reference_type = expense`, `payment_type = paid`).
2. Expense **journal entries** were always skipped in the journal liquidity path — if no `payments` row or liquidity classification failed, the line was invisible.
3. Wrong `payment_type` on expense payments could show as Cash In.

## Code changes

- [`roznamchaExpenseRules.ts`](../../src/app/services/roznamchaExpenseRules.ts) — expense always OUT on payments; expense JE credit = OUT.
- [`roznamchaService.ts`](../../src/app/services/roznamchaService.ts) — orphan expense JE fallback when no live payment; wallet `classifyRoznamchaLiquidity` fallback via `isLiquidityPaymentAccount`.
- Mobile parity: [`erp-mobile-app/src/api/roznamcha.ts`](../../erp-mobile-app/src/api/roznamcha.ts).

## Data repair (when DB connected)

1. `scripts/sql/diag_roznamcha_home_expense_je.sql` — inspect JE-0015 / JE-0016.
2. `scripts/sql/preview_roznamcha_missing_expense_payments.sql` — orphan expense JEs.
3. `scripts/sql/apply_roznamcha_missing_expense_payments.sql` — backfill payments rows.
4. `scripts/sql/fix_expense_payment_type_for_roznamcha.sql` — fix `payment_type` on expense payments.
5. `npm run migrate` — ensure `20260612120000_record_expense_with_accounting_payments_row.sql` applied.

## VPS

After local verification: `git pull`, migrate, run backfill SQL on production DB.
