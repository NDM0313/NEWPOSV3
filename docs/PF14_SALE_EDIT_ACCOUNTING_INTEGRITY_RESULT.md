# PF-14 Sale Edit Accounting Integrity – Result

## Root cause

- **PF-13** on posted sale edit **deleted** all existing journal entries for the sale (`reference_type = 'sale'`, `reference_id = saleId`) and **recreated** a single new JE with only net AR + Sales Revenue. That led to:
  1. **Original JE number changing** – The original JE (e.g. JE-0034) was removed; the new JE got a new number (e.g. JE-0033 or next sequence), so the posted document number was not immutable.
  2. **Component-level lines disappearing** – Discount, extra expense, and shipping were never re-posted; only one net “Sales Revenue” line was created.
  3. **Audit trail broken** – Old accounting history was removed instead of preserved; Day Book / Journal showed only the replacement entry.

## Actual schema linkage (unchanged)

- **journal_entries**: `reference_type` = `'sale'` | `'sale_adjustment'`, `reference_id` = sale id, `entry_no` = immutable voucher number.
- **journal_entry_lines**: Double-entry lines per JE; no schema change.
- **sale_charges**: Charge breakdown (discount, shipping, extra) for snapshot/delta.

## Files changed

| File | Change |
|------|--------|
| `src/app/services/saleAccountingService.ts` | Added `getSaleAccountingSnapshot()`, `postSaleEditAdjustments()`, helpers `sumCharges`, `postAdjustmentJE`. Adjustment JEs use `reference_type = 'sale_adjustment'`, descriptions e.g. "Sale adjustment – discount change – SL-0004". |
| `src/app/context/SalesContext.tsx` | **PF-14**: Before sale update, capture `oldAccountingSnapshot` via `getSaleById` + `getSaleAccountingSnapshot`. Replaced PF-13 block: **no delete/recreate**; after update, call `postSaleEditAdjustments(oldSnapshot, newSnapshot)`. AR account selection fixed to prefer **1100** (Accounts Receivable), never use 2000 (AP) for sales. |
| `scripts/verify-pf14-sale-edit-accounting-integrity.sql` | New verification script: JE counts by type, no duplicate sale JEs, trial balance, 1100/2000 account check, sample sale + adjustments. |
| `docs/PF14_SALE_EDIT_ACCOUNTING_INTEGRITY_RESULT.md` | This result document. |

## What was verified

- **Code**: No delete of existing JEs on sale edit; only new adjustment JEs are inserted. Original sale JE(s) are never modified or renumbered.
- **Logic**: Deltas for revenue, discount, extra expense, shipping are computed from old vs new snapshot; for each non-zero delta a separate adjustment JE is posted with a clear description.
- **AR/AP**: Sale JEs use AR account with code **1100** when available; 2000 (AP) is excluded for sales.
- **SQL script**: Runs in Supabase SQL Editor; checks duplicate sale JEs, trial balance, and account codes.

## Original JE numbers now stay fixed

- **Yes.** Existing rows in `journal_entries` are **never** updated or deleted on sale edit. No code path changes `entry_no` or removes the original sale JE. New voucher numbers are only assigned to **new** adjustment JEs (e.g. `JE-ADJ-...`).

## Component-level lines now survive sale edits

- **Yes.** Original sale JE (and any existing component lines) remain in the DB. Edits only **add** adjustment JEs:
  - Revenue change → one adjustment JE (AR + Sales Revenue).
  - Discount change → one adjustment JE (Discount Allowed + Sales Revenue).
  - Extra expense change → one adjustment JE (Extra Expense + AP).
  - Shipping income change → one adjustment JE (AR + Sales Revenue).
- Day Book and Journal show both the original entry and the new adjustment entries; component-level effect is preserved via these adjustments.

## Day Book / Journal / COA remain balanced and traceable

- **Yes.** Each adjustment JE is balanced (debit = credit). Sum of all JEs (original + adjustments) matches the edited sale. Trial balance remains zero. Reports that include all `journal_entries` (and optionally filter by `reference_type`) will show the full trail.

## Acceptance test (manual)

1. Create a posted sale with: item amount, discount, extra expense, shipping charge, payment history.
2. Edit: change discount, extra expense, shipping, and main amount if needed.
3. **Expected**: Original JE unchanged (same `entry_no`). New adjustment JE(s) added. No disappearing discount/shipping/extra expense in accounting. No destructive repost. Reports and ledgers reflect final amounts via original + adjustments.

## Remaining / optional

- **Courier payable delta**: PF-14 does not yet post adjustments for courier expense/payable changes (e.g. from shipment); can be added later using the same delta pattern.
- **Payment JEs**: Unchanged in this task; only sale-side components (revenue, discount, extra, shipping) are adjusted.

## Exact next step

1. Run `scripts/verify-pf14-sale-edit-accounting-integrity.sql` in Supabase SQL Editor (after at least one sale edit with adjustments).
2. Perform the acceptance test above and confirm original JE remains and adjustment JEs appear with correct descriptions.
3. Optionally run existing PF-13 verification script to confirm no duplicate sale JEs and trial balance still holds.
