# Final closure: sales return engine — party AR, resolver, and inventory notes

## Executive summary

Sales return settlement was posted through `createEntry` with `source: 'Sale Return'`, which produced `journal_entries.reference_type = 'sale return'` (lowercased string with a **space**). Postgres party resolution and UI normalization expect **`sale_return`**. As a result, `_gl_resolve_party_id_for_journal_entry` did not classify the row as a sale-side document, so **`party_id` resolved to NULL** for lines on the AR **control** account (no `accounts.linked_contact_id`). Customer AR statement / party GL slices that filter by `party_id = customer` **dropped the return credit**, while revenue and control-level TB still moved — the classic “return shows elsewhere but due does not drop on the customer strip” failure.

Separately, the settlement leg used the generic **“Accounts Receivable”** name resolution, which prefers the **control 1100** row, not the **per-customer receivable sub-account** created by `resolveReceivablePostingAccountId` (the same pattern already used for finalized sales and for `recordPurchaseReturn` on AP).

This closure:

1. Introduces **`recordSaleReturn`** in `AccountingContext`, mirroring **`recordPurchaseReturn`**: Dr **Sales Revenue**, Cr **party AR** when `refundMethod === 'adjust'`, with `metadata.creditAccountId` from `resolveReceivablePostingAccountId`; cash/bank uses optional `refundAccountId` (standalone form).
2. Sets canonical **`source: 'Sale_Return'`** so stored **`reference_type` is `sale_return`** and `reference_id` is the **`sale_returns.id`** (first in `createEntry` metadata precedence via `saleReturnId`).
3. Ships migration **`20260444_gl_resolve_party_return_documents.sql`**: replaces `_gl_resolve_party_id_for_journal_entry` so **`sale_return` / `purchase_return`** resolve party from **`sale_returns` / `purchase_returns`**, and **`sale` / `purchase`** rows no longer misinterpret return UUIDs as sale/purchase ids. Normalizes legacy **`sale return`** headers to **`sale_return`**.
4. Enriches journal list party display for sale returns (`_sale_return_customer_name`) and **root_reference_* = sale_return** in `accountingService.ts`.

## Affected live pattern (e.g. Nadeem / SL-0004 / JE-0099)

- **Symptom:** Return / settlement amount visible in journal or revenue-side views; **customer receivable / party AR strip unchanged** (e.g. closing still **84,500** after a **~40,926** style return when expecting a lower due).
- **Mechanism:** Bad `reference_type` and/or AR credit on **control** 1100 without party resolution → excluded from **`get_customer_ar_gl_ledger_for_contact`** / party rollups that require `party_id = customer_id`.

Exact live UUIDs and before/after balances must be captured in your environment after running the migration and optional line remap (below).

## Code paths changed

| Area | Change |
|------|--------|
| `src/app/context/AccountingContext.tsx` | `Sale_Return` transaction source; `SaleReturnParams`; **`recordSaleReturn`**; `saleReturnId` in metadata; `reference_id` precedence; **`Sales Revenue`** on `AccountType`; debit account matcher for **Sales Revenue**; `sourceMap` **`sale_return`** |
| `src/app/components/sales/SaleReturnForm.tsx` | Calls **`accounting.recordSaleReturn`** with `postingDate`, `originalSaleId`, `customerId` |
| `src/app/components/sales/StandaloneSaleReturnForm.tsx` | Same; passes **`refundAccountId`** for cash/bank |
| `src/app/services/accountingService.ts` | Batch load customer names for **`sale_return`**; **`root_reference_type/id`** for sale_return JEs |
| `migrations/20260444_gl_resolve_party_return_documents.sql` | Resolver + legacy **`reference_type`** cleanup |
| `scripts/verify_sales_return_party_ar_consistency.sql` | Read-only checks for one return id |
| `scripts/repair_sales_return_party_ar_live.sql` | Optional remap of AR credit lines from control 1100 → party child |

## SQL / repair actions (operator checklist)

1. **Apply migration** `20260444_gl_resolve_party_return_documents.sql` on production Postgres (Supabase SQL editor or your migration runner).
2. **Re-check party AR** for the affected customer: `get_customer_ar_gl_ledger_for_contact` / Contacts reconciliation — return credits should appear once resolver + type are correct **if** lines are on the 1100 **subtree** with correct party attribution.
3. If historical JEs still have **AR credit on the control id** (not party child), run **`scripts/repair_sales_return_party_ar_live.sql`** after editing `YOUR-COMPANY-UUID` (and optionally scoping one `sale_return` id). Preview with the commented `SELECT` first. This is an **UPDATE** to `journal_entry_lines.account_id` only (no delete of history).
4. **Void/repost** is preferred if amounts or descriptions are wrong; remap is for **mis-posted account id** only.

## Inventory / COGS (explicit scope boundary)

- **Stock:** `saleReturnService.finalizeSaleReturn` already creates **`sale_return`** stock movements (quantity positive / stock in).
- **GL inventory / COGS reversal:** not added in this change set; prior behavior was revenue + settlement only from the form. A full ERP-style return would add **Dr Inventory / Cr COGS** (or your COA equivalent). Track as a follow-up if required for P&amp;L + balance sheet parity with stock.

## Purchase return

- Resolver now treats **`purchase_return`** reference_id as **`purchase_returns.id`** (aligned with `recordPurchaseReturn`), fixing resolver consistency when lines are not on a linked AP child.

## Verification

- Local: **`npm run build`** — passing after these edits.
- Live: push branch, deploy VPS (`bash deploy/deploy.sh` from `/root/NEWPOSV3` after `git pull`), apply migration, run **`scripts/verify_sales_return_party_ar_consistency.sql`** for a known `sale_return` id, then re-test **adjust** settlement: party AR, control subtree, revenue, stock.

## Remaining risks

- **Cash/bank refund** on linked `SaleReturnForm` still has **no account picker**; settlement uses name-based Cash/Bank resolution (unchanged). Prefer **Standalone** pattern (explicit account) or add UI later.
- **COGS / inventory GL** on return remains a product gap if stock and P&amp;L must tie exactly.
