# Payment Isolation Rules (Phase 3)

**Status:** Enforced from Phase 3. Payment is a fully isolated accounting component.  
**Reference:** `docs/accounting/RESET COMPANY/ACCOUNTING_PHASE_PLAN_AND_PROMPTS.md` — Phase 3.

---

## 1. Core rule

**If payment is untouched, payment JE and payment ledger entries remain untouched.**

Editing a Sale or Purchase document must **never** reverse or repost payment unless the payment row itself (amount, account, or method) changed.

---

## 2. Change detection (Sale / Purchase edit)

The edit engine must treat these cases separately:

| Change type | Description | Accounting action |
|-------------|-------------|-------------------|
| **Document-only** | Total, discount, shipping, items, extra expense changed; payment rows unchanged | Post only document delta JEs (sale_adjustment / purchase adjustment). Do **not** touch payment JEs or ledger. |
| **Payment-only** | One or more payment rows added/edited/deleted; document totals unchanged | Create/update/delete payment rows; post only payment JEs (or payment_adjustment delta). Do **not** repost document JEs. |
| **Payment-account-only** | Payment amount unchanged; only payment account or method changed | Post single transfer JE: Dr new account, Cr old account. Original payment JE unchanged. |
| **Mixed** | Both document and payment changed | Post document delta JEs **and** payment delta JEs independently. Never full-reverse document + payment. |

---

## 3. Payment lifecycle (isolated)

| Event | Action |
|-------|--------|
| **Payment create** | One `payments` row; one journal entry (Dr Cash/Bank, Cr AR for sale; Dr AP, Cr Cash/Bank for purchase). No document JE touched. |
| **Payment edit (amount)** | Update `payments.amount`. Post **one** payment_adjustment JE (delta only). Original payment JE **never** modified or deleted. |
| **Payment edit (account only)** | Update `payments.payment_account_id`. Post **one** transfer JE (Dr new account, Cr old account). Original payment JE unchanged. |
| **Payment delete/reverse** | DB trigger or service posts reversal JE (or voids original per policy). Document JEs unchanged. |

---

## 4. Document edit (Sale / Purchase)

- **postSaleEditAdjustments** / **postPurchaseEditAdjustments** must only post **document** deltas (revenue, discount, shipping, extra, inventory, payable).
- They must **not** delete, void, or repost any journal entry with `payment_id` set or `reference_type` = 'payment' / 'payment_adjustment'.
- Supplier/Customer ledger: when syncing after edit, only reverse/repost **payment** ledger entries when **paid** actually changed; when only document changed, do not touch payment ledger rows.

---

## 5. Activity / history

- Do **not** log "Payment edited from Rs X to Rs Y" when amount did not change (e.g. only account or method changed). Use "Payment account changed to Bank" or similar.
- Zero-delta payment edits must not create activity log lines suggesting amount changed.

---

## 6. Files enforcing isolation

| Area | File | Rule |
|------|------|------|
| Sale edit | `saleAccountingService.postSaleEditAdjustments` | Document deltas only; no payment_id JEs. |
| Purchase edit | `purchaseAccountingService.postPurchaseEditAdjustments` | Document deltas only; no payment JEs. |
| Sale payment update | `saleService.updatePayment` | Post payment_adjustment JE only when amount/account changed. |
| Purchase payment update | `purchaseService.updatePayment` | Post payment_adjustment JE when amount/account changed (Phase 3). |
| Payment delta JEs | `paymentAdjustmentService` | postPaymentAmountAdjustment, postPaymentAccountAdjustment. |
| Context | `SalesContext` / `PurchaseContext` | Only sync payment when paid amount or account actually changed. |

---

*Last updated: Phase 3 completion.*
