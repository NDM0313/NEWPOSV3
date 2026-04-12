# HOTFIX: Payment edit ordering + account statement presentation

## 1. Root cause

When a **customer receipt** (or purchase-linked payment) was updated in **one save** with **both** a higher/lower **amount** and a different **liquidity account**, the amount-delta journal used `updates.accountId` / `selectedAccount` (the **new** account) for the cash/bank/wallet leg instead of the **pre-update** account.

That ordering violates the intended PF-14 economics:

1. **Amount delta** must post on the **old** liquidity account (the one that held the receipt at the time the amount changed).
2. **Account transfer** must move the **final** amount from old → new (`Dr new, Cr old`).

Using the new account for the delta **and** posting a full transfer produced the classic residue pattern (e.g. old wallet **−5000**, cash **+45000** feel) instead of old **0**, new **+40000**, AR reduced by **40000**.

The same bug pattern existed in:

- `saleService.updatePayment` — `postPaymentAmountAdjustment({ paymentAccountId: updates.accountId || paymentAccountId })`
- `purchaseService.updatePayment` — `paymentAccountId: updates.accountId ?? paymentAccountId`
- `UnifiedPaymentDialog` manual `manual_receipt` / `manual_payment` paths — `paymentAccountId: selectedAccount` after the row was already patched to the new account

Additionally, **manual** receipt/payment **account-only** edits did not call `postPaymentAccountAdjustment` from the dialog (only amount deltas were posted there), so liquidity could drift until sync — now explicitly posted in-dialog after save.

**Edit routing:** Sale-linked receipt journal entries use `journal_entries.reference_type = 'sale'` with `payment_id` set. `inferTransactionKind` previously classified those as **document_total** when the embedded `payments` row was missing, so **Edit** could resolve to **open sale** instead of **payment editor**. Rows with `payment_id` and `reference_type` in `sale` / `purchase` are now treated as **payment** for resolution purposes.

## 2. Old vs new ordering logic

**Snapshots (before DB update):**

- `oldAmount`, `oldAccountId` / `payment_account_id` from `payments` (or `preRow` in the dialog).

**After update:**

- `newAmount`, `newAccountId` from request / patched row.

**Posting order (unchanged in sequence, fixed in inputs):**

1. If amount changed → `postPaymentAmountAdjustment` with **liquidity leg = old account only** (`oldAccountId || pre-update payment_account_id`), never the new account.
2. If account changed → `postPaymentAccountAdjustment` with **amount = final** `newAmount`, **oldAccountId → newAccountId**.

**Idempotency:**

- Amount adjustment fingerprint is now  
  `payment_adjustment_amount:{companyId}:{paymentId}:{oldAmount}:{newAmount}:{liquidityAccountId}`  
  so distinct liquidity legs do not collide.
- `hasExistingPaymentAmountAdjustment` matches **exact new fingerprint**, or **legacy** rows with **empty** `action_fingerprint` and the same description needles (pre-hotfix data). Wrong liquidity posts that already have a non-matching fingerprint may require **manual void/repair** before a “correct” duplicate is suppressed.

## 3. Ali-style reproduction (35k → 40k, wallet → cash)

1. Post receipt **35 000** on **1020 Mobile Wallet** (primary JE: Dr 1020, Cr AR).
2. Edit to **40 000** and **1000 Cash** in one save.

**Correct:**

- Delta **5 000**: Dr **1020**, Cr AR.
- Transfer **40 000**: Dr **1000**, Cr **1020**.

**Nets:** 1020 → **0**, 1000 → **+40 000**, AR → **−40 000** vs original.

## 4. Salar-style reproduction (multi-step)

Same rules apply on each combined save: **delta always on liquidity as of before that save**; **each transfer moves the current final amount** between the previous and new account. Use Truth Lab + `scripts/verify-payment-mutation-chain.sql` to verify nets after each step.

## 5. Screens / files touched

| Area | Change |
|------|--------|
| `saleService.ts` | Amount delta uses `oldAccountId \|\| paymentAccountId` only. |
| `purchaseService.ts` | Same for supplier payments. |
| `UnifiedPaymentDialog.tsx` | Pre-fetch `payment_account_id`; delta uses old liquidity; manual receipt/payment **account change** posts `postPaymentAccountAdjustment`. |
| `unifiedTransactionEdit.ts` | `payment_id` + `sale`/`purchase` header → **payment** kind (not document). |
| `paymentAdjustmentService.ts` | Fingerprint includes liquidity; guard empty liquidity. |
| `accountingService.ts` | `hasExistingPaymentAmountAdjustment` + optional liquidity; `getAccountLedger` returns `je_reference_type` / `je_action_fingerprint`. |
| `AccountLedgerReportPage.tsx` | Presentation column, audit/effective row switch (dim PF-14 rows), export column. |
| `truthLabTraceWorkbenchService.ts` | `transaction_mutations` on trace; `buildPaymentPostingExpectedVsActual`. |
| `ArApTruthLabPage.tsx` | “Expected posting vs actual” panel + mutation JSON. |
| `scripts/verify-payment-mutation-chain.sql` | SQL harness for a `payment_id`. |

## 6. Payment edit routing

**Yes — for the main failure mode:** sale-linked receipts with `payment_id` on the JE are classified as **payment**, so **Edit** / auto-launch from `TransactionDetailModal` opens the **payment** path (`UnifiedPaymentDialog`) instead of the sale drawer. **Open source** / document actions remain separate where the modal exposes them.

## 7. Account statement effective mode

**Yes (GL / account-based statement in Reports):** `AccountLedgerReportPage` adds a **Presentation** column (aligned with `journalLinePresentation.ts`) and a **Row presentation: audit** switch. Turning audit **off** dims **transfer** and **amount delta** rows like the Day Book.

Party statements that do not populate `je_action_fingerprint` may show generic presentation labels until those RPCs are extended similarly.

## 8. SQL verification

Use `scripts/verify-payment-mutation-chain.sql`: replace `PAYMENT_UUID_HERE`, run the sections, and confirm per-account nets and fingerprints.

## 9. Remaining risks

- **Historical bad JEs** posted with the old bug may still sit in the ledger; this hotfix prevents **new** wrong chains. Repair may require voiding or posting offsetting entries under controlled procedures.
- **Idempotency:** if an old amount JE has **no** fingerprint but matching description, a duplicate save may still be skipped even when lines are wrong — prefer void + fix.
- **Rental payments** use a different update path (`rentalService.updateRentalPayment`) and were **not** part of this hotfix.
- **Customer/supplier statement** data sources other than `getAccountLedger` may not yet expose fingerprints in every row.

## 10. Build result

`npm run build` completed **successfully** (exit code 0) after these changes.
