# Final: Sale return partial value + terminal void closure

## Corrected understanding

- **Rental income (4200)** on sale returns was a separate, already-fixed issue. This closure does not change that path.
- **Remaining bug (confirmed):** For a **partial** linked sale return, **quantity** followed the returned amount correctly, but **inventory / line economics** could still reflect the **full original sale line total** (or an inconsistent `unit_price` × `qty`), so stock `total_cost` and `sale_return_items.total` diverged from the proportional share of the original invoice line.
- **Void / cancel:** Engine paths already use **status claim** (`final` → `void`), **idempotent** `voidSaleReturn` (`alreadyVoided`), **deduped** `sale_return_void` stock lines, and **`createReversalEntry`** idempotency (`alreadyExisted`). UI hides void on voided returns. This task **aligns settlement JE amount** with post-finalize header totals and **documents** verification SQL.

## Root cause (with proof)

1. **Client payload / stale `total`:** `SaleReturnForm` could persist `sale_return_items.total` inconsistently with `return_quantity * unit_price` (e.g. empty `useEffect` that never re-synced totals after load in edge flows). Stock movement used `Number(item.total)` from DB → wrong `total_cost` when `total` was wrong.
2. **No server-side proportional rule:** `finalizeSaleReturn` trusted stored line `total` / `unit_price` for `createStockMovement` instead of deriving from **original sale line** `total / quantity` for linked returns.
3. **Settlement JE vs lines:** `recordSaleReturn` used React `total` computed before finalize could reconcile header/line sums after server-side corrections.

**Wrong-value source:** Primarily **`sale_return_items.total`** (and propagated to **`stock_movements.total_cost`**), not the rental account.

## Engine fix (local)

### Canonical economics

- **Linked** sale return (has `original_sale_id` and matching original line):  
  `line_total = (returned_qty / original_qty) * original_line_total` (full return uses full line total).  
  Implemented in `canonicalSaleReturnStockEconomics` in `src/app/services/saleReturnService.ts`.
- **Standalone** return: `qty * unit_price` with `total/qty` fallback when unit is missing.

### `finalizeSaleReturn`

- Loads original `sales_items` / `sale_items` with **`total`, `unit_price`** (and `price` on legacy `sale_items`).
- **Patches** `sale_return_items` when canonical differs from stored.
- Inserts **`sale_return`** stock movements using **canonical** `unit_cost` / `total_cost`.
- **Recomputes** `sale_returns.subtotal` from line sum and **`total` = subtotal − discount + tax**.

### `voidSaleReturn`

- Stock reversal (`sale_return_void`) uses the **same canonical** economics so void mirrors the corrected movement.

### Forms

- **`SaleReturnForm`:** `buildItemsPayload` sets `total` from `return_quantity * unit_price` always; after finalize, **`getSaleReturnById`** supplies **`settlementAmount`** for `recordSaleReturn`. Removed the no-op `useEffect` that ran only on mount.
- **`StandaloneSaleReturnForm`:** Settlement amount from **refreshed** return after finalize.

### Policy / routing

- **`inferTransactionKind`:** `sale_return` / `purchase_return` return `generic_adjustment` so they are never mistaken for `payment` in downstream policy.
- Journal / unified edit: **`resolveUnifiedJournalEdit`** and **`journalReversalBlockedReason`** already block sale return rows from unsafe journal edits/reversals; `updateManualJournalEntry` only allows `reference_type = journal`.

## Files touched

| File | Change |
|------|--------|
| `src/app/services/saleReturnService.ts` | Canonical economics, patch lines, sync header, void stock uses canonical |
| `src/app/components/sales/SaleReturnForm.tsx` | Line total from qty×price; settlement JE from refreshed return |
| `src/app/components/sales/StandaloneSaleReturnForm.tsx` | Settlement amount from refreshed return |
| `src/app/lib/unifiedTransactionEdit.ts` | Explicit `sale_return` / `purchase_return` kind |
| `scripts/verify_sale_return_partial_value_and_terminal_state.sql` | Read-only checks |
| `scripts/repair_sale_return_partial_value_live_cases.sql` | Auditable repair playbook (no auto DML) |
| This doc | Evidence + rules |

## SQL scripts

- **Verify:** `scripts/verify_sale_return_partial_value_and_terminal_state.sql` — set `company_id` in `params`.
- **Repair:** `scripts/repair_sale_return_partial_value_live_cases.sql` — commented patterns only; no hard delete.

## Live data

- Run verify on production clone or read replica first. Repair only after sign-off; prefer **void return** from Sales UI where the business intent is to unwind a mistaken posting.

## Business rules adopted

1. **Partial return:** Stock and line value use **exact returned quantity** × **original line effective unit** (`line_total / line_qty` on the invoice), unless standalone rules apply.
2. **Void:** One-time terminal transition; repeated void is **no-op** with user messaging; no duplicate reversal intent (reversal JE idempotent per source JE).
3. **Journal:** Source-owned sale / sale_return / purchase / purchase_return rows remain **module-owned**; journal amount edit / reverse from journal stays blocked for those types.

## Test evidence (manual)

1. **Partial value:** Create sale line qty 15 with known line total T. Return qty 5. Expect `sale_return_items.total ≈ (5/15)*T`, stock `sale_return` `total_cost` matches, JE amount matches refreshed `sale_returns.total` (after discounts if any).
2. **Void once:** Void return → status `void`, one `sale_return_void` row per product (unique index if present), second void → “already cancelled”.
3. **Journal:** Open sale return JE in Transaction Detail → unified edit blocked with return message.
4. **Regression:** Re-run verify script; count **A** should be **0** for new returns after deploy.

## Restore a voided sale return (undo void, re-apply later)

If you voided a return and want the document **back to `final`** (same stock in as before void, GL effects of void reversed by soft-voiding `correction_reversal` rows):

1. **App / service:** `saleReturnService.restoreVoidedSaleReturnToFinal(returnId, companyId)` or `restoreLatestVoidedSaleReturnToFinal(companyId, branchId?)`.
2. **Service role (recommended if RLS blocks deletes):**  
   `npx tsx scripts/admin/restore-last-voided-sale-return.ts --company <uuid> --apply`  
   or `--return-id <uuid> --apply`. Use `--dry-run` first.
3. **Raw SQL template:** `scripts/restore_voided_sale_return_to_final.sql` (commented).

This does **not** hard-delete original `sale_return` stock or original `sale_return` JEs; it removes **`sale_return_void`** rows and voids **`correction_reversal`** headers linked to those document JEs. Arbitrary manual journals are not auto-undone.

## Constraints honored

- Local code changes only in this task; **no git push** requirement satisfied from agent side.
- **No VPS app deploy** in this task.
- DB changes only via auditable SQL files when operators run them.
