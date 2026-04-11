# Final closure: sale return cancel idempotency + revenue routing (4200 vs 4000)

## Summary

Two production failures were addressed:

1. **Repeat void / race** — `voidSaleRun` applied stock reversals and `SALE_RETURN_VOID` rows **before** atomically claiming the return row. Concurrent or repeated voids both saw `status = final`, both inserted stock, then both attempted status update. **Fix:** exclusive `UPDATE … SET status = 'void' WHERE status = 'final' RETURNING` first; if zero rows, re-read and **no-op** when already void. Stock and GL work run only after a successful claim. **Rollback** to `final` if post-claim work throws. **Dedupe:** skip `createStockMovement` when an identical `(sale_return_void | sale_return)` line already exists for that product/variation.

2. **Ali / 4200 Rental Income** — `createEntry` resolved **debit** label `Sales Revenue` with a matcher that treated any account whose **name contained `"income"`** as sales revenue. **Rental Income (4200)** matched first in some COA orderings. **Fix:** (a) tighten debit/credit matchers so **Sales Revenue** requires **4000/4010** or **“sales” + (revenue|income) without “rental”**; **Rental Income** requires **4200** or name containing **rental** plus income/revenue; (b) **`recordSaleReturn`** always sets **`metadata.debitAccountId`** from **canonical account code `4000`** (optional override `revenueDebitAccountId` for a future true-rental return path).

3. **Accounting on void** — After claiming void, the service loads active **`journal_entries`** with `reference_type = 'sale_return'` and `reference_id = return id`, and calls **`accountingService.createReversalEntry`** (existing PF-07 path → `correction_reversal` with idempotent `alreadyExisted`).

4. **Finalize idempotency** — `finalizeSaleReturn` now: returns if already **final**; claims **draft → final** before stock; skips duplicate **`sale_return`** stock lines; rolls back to **draft** on failure. **`finalizePurchaseReturn` / `voidPurchaseReturn`** follow the same pattern for parity.

## Files changed

| File | Change |
|------|--------|
| `src/app/services/saleReturnService.ts` | `saleReturnHasStockLine`; finalize claim + dedupe + rollback; **`voidSaleReturn` → `Promise<{ alreadyVoided }>`**, claim-void-first, reversal JEs, stock dedupe, rollback |
| `src/app/services/purchaseReturnService.ts` | `purchaseReturnHasStockLine`; finalize claim/dedupe/rollback; **`voidPurchaseReturn`** idempotent + reversal + dedupe |
| `src/app/context/AccountingContext.tsx` | Safer Sales / Rental income matchers; **`revenueDebitAccountId`** + **`debitAccountId`** on `recordSaleReturn` via **4000** |
| `src/app/components/sales/SalesPage.tsx` | Toast for `alreadyVoided`; disabled menu row for void returns |
| `src/app/components/purchases/PurchasesPage.tsx` | Toast for purchase return `alreadyVoided` |
| `scripts/verify_sales_return_cancel_idempotency.sql` | Read-only checks |
| `scripts/repair_sales_return_cancel_live.sql` | Commented template for duplicate void stock cleanup |

## Live repair / SQL

- Run **`scripts/verify_sales_return_cancel_idempotency.sql`** with Nadeem / Ali return UUIDs to confirm no duplicate movement keys and debit codes on active JEs.
- If historical **`sale_return_void`** duplicates exist, use **`scripts/repair_sales_return_cancel_live.sql`** (uncomment CTE, set UUIDs, switch `ROLLBACK` → `COMMIT` after review).
- Wrong **4200** lines on past JEs: prefer **`createReversalEntry`** from the UI/lab for the bad `sale_return` JE, then repost a corrected return if needed — or a one-off correction JE documented per UUID.

## Proof expectations (post-deploy)

- Second void call → **`alreadyVoided: true`**, no new `stock_movements`, toast: *Return already cancelled — no further action applied.*
- New normal sale return → debit account **4000** (not 4200) unless caller passes **`revenueDebitAccountId`** for a documented rental-origin case.
- `npm run build` — green locally after these edits.

## VPS / production

Deploy requires **git push** of this branch, then on the server `git pull` and your usual **`bash deploy/deploy.sh`**. Apply any pending SQL migrations from prior workstreams if not yet on production.

## Residual risk

- Claim-then-work: if the process crashes **after** status = void but **before** stock/JE completes, the row stays void while inventory may still reflect the return — **rare**; recovery is manual (restore-to-draft where supported, or targeted stock/JE repair). Monitor logs after deploy.
