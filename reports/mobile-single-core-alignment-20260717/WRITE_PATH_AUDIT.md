# WRITE_PATH_AUDIT — Mobile (Phase 1 read-only)

No production writes performed during this audit.

## Canonical write RPCs (approved)

| Workflow | Mobile API | RPC / contract | Notes |
|----------|------------|----------------|-------|
| Sale finalize | `sales.ts` | `record_sale_with_accounting` | Stock via `ensure_sale_stock_movements` |
| Sale payment | `sales.ts` / `accounts.ts` | `record_payment_with_accounting` | |
| Sale cancel/void | `sales.ts` | `cancel_sale_full_void` | |
| Sale return | `sales.ts` | `finalize_sale_return` | Credit-note path |
| Sale edit | `sales.ts` + `saleEditAccounting.ts` | `update_sale_with_items` + JE helpers | **Risk:** hard-coded AR 1100 |
| Purchase finalize | `purchases.ts` | `record_purchase_with_accounting` | |
| Purchase void | `purchases.ts` | `cancel_purchase_full_void` | |
| Purchase edit | `purchaseEditAccounting.ts` | helpers | **Risk:** hard-coded 2000/2100 |
| Expense | `expenses.ts` | `create_expense_document` | Post-RPC field patches |
| Transfers / business | `business.ts` | `create_business_transaction` | Verify vs web transfer contract |
| Shipment JE | `shipmentAccounting.ts` | `post_sale_shipment_journal` | |
| Studio finalize | `studioFinalizeAfterInvoice.ts` | sale RPC + 2010 | |

## Rules enforced by this program

- Do not create a mobile-only posting engine
- Do not post stock/GL except FINAL approved contracts
- Do not mutate historical 4100 revenue
- Add idempotency / double-tap guards on slow networks (Phase 4 — not completed)
- After successful write: invalidate affected balances/reports (Phase 6 — partially true via refresh epochs)

## Phase 4 remaining

Full create/update/finalize/void matrix with web parity evidence is **not** executed in this delivery (approval-gated for production mutations; needs QA company sandbox).
