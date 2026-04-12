# FINAL: Edit-flow audit and duplicate posting trace

This document records the **code-level** audit of payment/receipt edit paths, how to **prove** duplicate posting in live data, and what was delivered (Truth Lab, SQL, DEV tracing). It does **not** replace running SQL against production/staging for Ali/Salar-specific UUIDs—those must be pasted from your database after tracing.

## Read first (canonical context)

- [HOTFIX_PAYMENT_EDIT_ORDERING_AND_ACCOUNT_STATEMENT_PRESENTATION.md](./HOTFIX_PAYMENT_EDIT_ORDERING_AND_ACCOUNT_STATEMENT_PRESENTATION.md)
- [FINAL_GENERIC_TRANSACTION_MUTATION_LEDGER_AND_EFFECTIVE_READ_MODEL.md](./FINAL_GENERIC_TRANSACTION_MUTATION_LEDGER_AND_EFFECTIVE_READ_MODEL.md)
- [FINAL_TRUTH_LAB_TABLE_TRACE_AND_PAYMENT_MUTATION_WORKBENCH.md](./FINAL_TRUTH_LAB_TABLE_TRACE_AND_PAYMENT_MUTATION_WORKBENCH.md)
- [FINAL_AR_TRUTH_LAB_FREEZE_AND_CUSTOMER_DELTA_CLOSE.md](./FINAL_AR_TRUTH_LAB_FREEZE_AND_CUSTOMER_DELTA_CLOSE.md)
- [FINAL_CONTACTS_GL_STRIP_NUMBERING_AND_SIMPLE_LEDGER_FIX.md](./FINAL_CONTACTS_GL_STRIP_NUMBERING_AND_SIMPLE_LEDGER_FIX.md)

## A) Edit entry point matrix (code)

Legend: **Y** = yes when conditions in code are met; **—** = not applicable; **Sync** = `syncPaymentAccountAdjustmentsForCompany` on accounting load.

| UI / entry point | Component / file | Service / action | DB row updated first | `postPaymentAmountAdjustment` | `postPaymentAccountAdjustment` | Rebuild allocations | `transaction_mutations` | New `journal_entries` / lines | Duplicate-fire risk | Idempotency / fingerprint |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Customer sale-linked payment edit | `UnifiedPaymentDialog.tsx` | `saleService.updatePayment` | `payments` | Y if amount changed | Y if account changed & amount &gt; 0 | Y if `reference_type === manual_receipt'` (FIFO) | Y via adjustment service | Delta + transfer JEs + primary unchanged | **High** if same save also triggers `SalesContext.sync_sale_payment.updatePayment` (second `updatePayment`) | Amount: `payment_adjustment_amount:…:liquidity`; account: `payment_adjustment_account:…`; skip if `hasExisting*` |
| Supplier purchase-linked payment edit | `UnifiedPaymentDialog.tsx` | `purchaseService.updatePayment` | `payments` | Y if amount changed | Y if account changed | — | Y | Same pattern | Medium: UI + rare Integrity Lab | Same |
| Customer manual / on-account receipt edit | `UnifiedPaymentDialog.tsx` | Direct `payments` update + manual PF-14 | `payments` | Y if amount changed | Y if account changed | Y manual_receipt FIFO | Y | Delta + transfer | Medium: manual path + **Sync** if account drift | Same |
| Supplier manual / on-account payment edit | `UnifiedPaymentDialog.tsx` | Direct `payments` update + manual PF-14 | `payments` | Y if amount changed | Y if account changed | Y manual_payment FIFO | Y | Delta + transfer | Medium + **Sync** | Same |
| Rental payment edit | `UnifiedPaymentDialog.tsx` | `rentalService.updateRentalPayment` | `rental_payments` | **—** | **—** | Recompute rental totals | **—** | Date patch on linked JE only; **no PF-14 delta/transfer** | Low for PF-14; **different subledger** | N/A |
| Sale save syncs paid amount | `SalesContext.tsx` | `saleService.updatePayment` | `payments` | Same as row 1 | Same | Same | Same | Same | **High overlap** with dialog when user edits sale paid amount/account | Same |
| Accounting journal load | `AccountingContext.tsx` | `syncPaymentAccountAdjustmentsForCompany` | Reads `payments` vs primary JE liquidity | — | Y when mismatch | — | Y when JE created | Transfer-style correction | **High** if UI also posted transfer | `hasExistingPaymentAccountAdjustment` |
| Integrity Lab (admin) | `AccountingIntegrityLabPage.tsx` | `saleService` / `purchaseService` `updatePayment` | `payments` | Y | Y | manual_receipt only via service | Y | Same as service | Medium (test harness) | Same |
| Journal “Edit payment” routing | `unifiedTransactionEdit.ts` | Opens `UnifiedPaymentDialog` | — | — | — | — | — | — | Routes sale/purchase header+`payment_id` as **payment**, not document | N/A |

### Wrapper note

There is **no** separate duplicate wrapper around `paymentAdjustmentService` in the app layer beyond the call sites above; the only “second path” to watch is **Sync on load** vs **explicit save**.

## B) Tracing live cases (Ali, Salar)

**Payment UUIDs are not in the repository.** For each case:

1. Resolve `payments.id` (Truth Lab, Contacts, or `reference_number`).
2. Run `scripts/verify-payment-mutation-chain.sql` (replace `PAYMENT_UUID_HERE`).
3. Run `scripts/detect_duplicate_payment_posting.sql` (optionally scoped by `company_id`).
4. In app: **Developer → AR / AP Truth Lab** → payment trace → **Expected posting vs actual** + **Duplicate posting detector**.

### Case 1 — Ali (narrative from HOTFIX doc)

- **Expected sequence** (single combined save 35k→40k, wallet→cash): (1) amount delta **5k** on **old** liquidity; (2) transfer **40k** old→new.
- **Actual sequence**: list every `journal_entries` row in `created_at` order; compare `action_fingerprint` liquidity segment to **primary JE** liquidity.
- **Mismatch classification**: wrong-liquidity delta (historical bug) vs duplicate fingerprint (double post) vs Sync + UI both transferring.

### Case 2 — Salar (multi-step)

- Repeat per **save** boundary if you can infer timestamps from `journal_entries.created_at` and `transaction_mutations.created_at`.
- **Each step** should use **pre-save** liquidity for delta and **final amount** for transfer.

Fill in after SQL:

| Case | `payments.id` | Classification (old-bad / new-bad / both) | Duplicate source (UI twice / Sync+UI / historical only) |
| --- | --- | --- | --- |
| Ali | *(paste)* | *(paste)* | *(paste)* |
| Salar | *(paste)* | *(paste)* | *(paste)* |

## C) Delivered audit surfaces

1. **Truth Lab** (`/test/ar-ap-truth-lab`): **Duplicate posting detector** (fingerprint duplicates, same amount-triple, same transfer key) + existing expected vs actual + `transaction_mutations` JSON.
2. **`scripts/detect_duplicate_payment_posting.sql`**: company-scoped duplicate queries.
3. **`scripts/repair_bad_payment_edit_chains.sql`**: dry-run / playbook only (no silent deletes).
4. **DEV tracing** (`src/app/lib/paymentEditFlowTrace.ts`): grep console for `[PAYMENT_EDIT_TRACE]`.

### Trace events emitted (prove double-fire)

- `UnifiedPaymentDialog.edit.sale_purchase_routed` / `manual_patch_done` / `manual_amount_adjust` / `manual_account_transfer`
- `saleService.updatePayment.*` / `purchaseService.updatePayment.*`
- `paymentAdjustment.post_*`
- `AccountingContext.loadEntries.sync_payment_accounts`
- `SalesContext.sync_sale_payment.updatePayment`

**Interpretation:** One user save should produce a **single ordered sequence** of `db_updated` → optional `post_amount_adjust` → optional `post_account_adjust`. Two `post_amount_adjust.createEntry` with different fingerprints may be valid (multi-step edits); two with **identical** fingerprint or **same old/new amount pair** on two JEs indicates duplicate posting.

## D) Duplicate detector rules (implemented)

| Rule | Where |
| --- | --- |
| Same `action_fingerprint` on &gt;1 JE | SQL script §1; Truth Lab `DUPLICATE_IDENTICAL_FINGERPRINT` |
| Same payment + old_amount + new_amount on &gt;1 amount JE | SQL §2; Truth Lab `DUPLICATE_AMOUNT_DELTA_SAME_OLD_NEW` |
| Same payment + old/new account + amount on &gt;1 transfer JE | SQL §3; Truth Lab `DUPLICATE_TRANSFER_SAME_ACCOUNTS_AMOUNT` |
| Amount adjustment with no fingerprint | SQL §4; Truth Lab warn `ORPHAN_AMOUNT_ADJUSTMENT_NO_FINGERPRINT` |
| Delta on wrong liquidity / nets | Truth Lab **Expected posting vs actual** (heuristic) |

## E) Root cause hypotheses (to confirm per payment, not assumed)

1. **Historical wrong-liquidity deltas** (pre-hotfix): extra residue on old wallet; fingerprints may differ by liquidity segment.
2. **Double `updatePayment`**: `UnifiedPaymentDialog` + `SalesContext` in one user action.
3. **Sync + UI**: `loadEntries` posts account transfer while dialog also posted.
4. **Legacy JEs** without fingerprint: idempotency weak; new code may add a second row.

## F) Repair strategy (after proof only)

- **Option A** — Bug only on new saves: patch the **exact** duplicate path; verify with trace + detector; leave historical rows for controlled repair.
- **Option B** — Historical + current: patch path + run repair playbook SQL / manual reversing entries.
- **Option C** — Presentation only: adjust effective/audit display; **no** GL change.

Do not mix options without classifying each bad JE.

## G) Build result

Last verified in this repo (local):

```bash
npm run build
```

**Result:** exit code **0** — `✓ built in ~16s` (Vite production build + PWA generateSW). Chunk size warnings only; no compile errors.

---

**Success criteria checklist:** (1) Every extra row in Ali/Salar explained with JE ids; (2) save path duplication proven or ruled out via `[PAYMENT_EDIT_TRACE]`; (3) historical vs current classified; (4) affected UUIDs listed from SQL; (5) repair plan references `repair_bad_payment_edit_chains.sql` patterns; (6) no further blind posting tweaks until the above is true for your tenant.
