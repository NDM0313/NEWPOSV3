# Mobile transaction cancel / delete (web parity) — 2026-07-21

## Why

Mobile Transactions timeline and detail sheet only had **Edit** / **Copy**. Web Accounting cancels posted payments and manual journals via `createReversalEntry` (correction_reversal + payment void). Mobile had no cancel path.

## What shipped

| Layer | Change |
|-------|--------|
| API | [`erp-mobile-app/src/api/transactionCancel.ts`](../../erp-mobile-app/src/api/transactionCancel.ts) — eligibility + `cancelTransactionWithReversal` (web parity: single JE mirror reversal, multi-member chain void) |
| Confirm UI | [`erp-mobile-app/src/components/common/ConfirmActionSheet.tsx`](../../erp-mobile-app/src/components/common/ConfirmActionSheet.tsx) |
| Timeline | Cancel button + long-press **Cancel Payment / Cancel Entry** on [`TransactionsTimeline.tsx`](../../erp-mobile-app/src/components/accounts/reports/TransactionsTimeline.tsx) |
| Detail | Red cancel under Edit on [`TransactionDetailSheet.tsx`](../../erp-mobile-app/src/components/accounts/reports/TransactionDetailSheet.tsx) |

## Semantics (not hard delete)

- Posts `correction_reversal` JE with swapped debit/credit, or voids multi-member payment chain without extra JE
- Voids linked payment (`voided_at`) + chain JEs when voidable (`manual_receipt`, `on_account`, `manual_payment`, `sale`, `purchase`)
- Blocked: `correction_reversal` rows, already-reversed, voided, source-controlled document roots without `payment_id`
- Worker My Activity `readOnly` rows stay without cancel

## Delivery

| Item | Value |
|------|--------|
| Branch | `main` |
| Commit | *(filled after push)* |
| VPS | `deploy/vps-build-erp-only.sh` |
| Mobile | `https://erp.dincouture.pk/m/` |

Hard-refresh `/m/` (Ctrl+Shift+R) after deploy. Smoke: cancel a manual payment and a manual/expense JE; row should leave live timeline; ledger net stays correct via existing reversal-twin presentation.
