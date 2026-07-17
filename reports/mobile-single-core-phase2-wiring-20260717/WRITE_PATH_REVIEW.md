# WRITE_PATH_REVIEW.md

**Scope:** Code-level audit only. **No production mutations.**

## Primary mobile writes (approved backend RPCs)

| Flow | Mobile contract | Matches web family |
|------|-----------------|--------------------|
| Sale finalize | `record_sale_with_accounting` (`sales.ts`, studio finalize) | Yes |
| Purchase finalize | `record_purchase_with_accounting` (`purchases.ts`) | Yes |
| Payments / receipts | `record_payment_with_accounting` (sales, accounts, rentals, couriers) | Yes |

## Client-side JE helpers still present (do not expand)

| Helper | Risk |
|--------|------|
| `createJournalEntry` in `accounts.ts` | Used by rental booking accounting, studio finalize edge paths |
| `rentalBookingAccounting.ts` | Hard rules around AR-CUS* vs control **1100** |
| `saleEditAccounting.ts` | Hard-coded **1100** AR control for edit parity |
| `purchaseEditAccounting.ts` | Hard-coded **2000** / **2100** AP control lookup |
| `studioFinalizeAfterInvoice.ts` | May call `createJournalEntry` plus sale RPC |

**Decision this phase:** Document only; no rewrite of JE helpers without web parity evidence.

## Duplicate-submit protection

`useSubmitLock()` already used on MobilePaymentSheet, SalesModule, Purchase, Expense, Account transfer, General entry, etc. Phase 2 adds unit contract test for in-flight mutex semantics. **Server idempotency not claimed.**

## Cache after writes

AccountsModule listens for `MOBILE_DATA_INVALIDATED_EVENT` and bumps `reportRefreshEpoch`. Helper `invalidateAfterAccountingWrite` added for explicit party/ledger cache clears.
