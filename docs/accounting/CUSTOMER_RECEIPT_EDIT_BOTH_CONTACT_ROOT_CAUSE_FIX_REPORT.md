# Customer manual receipt edit + both-type contact — root cause and fix

**Date:** 2026-03-29  
**Company (live forensic):** `595c08c2-1e47-4581-89c9-1f78de51c613`  
**Contact ABC (both):** `cc36436f-789c-4fd0-b6ed-e670a47a47e2`  

**Do not regress:**  
[CONTACTS_OPERATIONAL_GL_PARITY_FIX_REPORT.md](./CONTACTS_OPERATIONAL_GL_PARITY_FIX_REPORT.md),  
[PURCHASE_PAYMENT_CONTACTS_GL_FIX_REPORT.md](./PURCHASE_PAYMENT_CONTACTS_GL_FIX_REPORT.md),  
[SUPPLIER_LEDGER_STATEMENT_EDIT_UNIFICATION_FIX_REPORT.md](./SUPPLIER_LEDGER_STATEMENT_EDIT_UNIFICATION_FIX_REPORT.md),  
[SUPPLIER_PAYMENT_EDIT_LIVE_SQL_ROOT_CAUSE_FIX_REPORT.md](./SUPPLIER_PAYMENT_EDIT_LIVE_SQL_ROOT_CAUSE_FIX_REPORT.md).

## 1. Same bug class as supplier manual payment edit — yes

| Layer | Supplier `manual_payment` edit (fixed) | Customer `manual_receipt` edit (this fix) |
|--------|----------------------------------------|-------------------------------------------|
| **`payments`** | Updated in place | Updated in place |
| **Allocations / document totals** | `rebuildManualSupplierFifoAllocations` + `recalc_purchase_payment_totals` | `rebuildManualReceiptFifoAllocations` + `recalc_sale_payment_totals` |
| **Original JE** | Unchanged by design (PF-14.1) | Unchanged by design |
| **Delta GL** | Was missing until `postPaymentAmountAdjustment` from dialog + party AP | Was missing when edit went through **`UnifiedPaymentDialog`** manual branch (Supabase-only) |
| **Stale symptom** | Journal lines / GL showed old amount; operational followed `payments.amount` | Same pattern |

**Invoice-linked sale payments** already called `saleService.updatePayment` → `postPaymentAmountAdjustment` (sale context). **On-account / Add Entry `manual_receipt`** edits used the **same manual Supabase path** as supplier manual payments **without** posting an AR delta JE.

## 2. Live ABC forensic snapshot (proof queries)

**Contact:** `type = both`, `opening_balance = 55,000` (customer opening).

**Payments (contact_id = ABC):**

| id | amount | reference_type | note |
|----|--------|------------------|------|
| `c1aef7d4-…` | 50,000 | `manual_receipt` | **voided** (`voided_at` set) — prior report orphan |
| `fa204961-…` | 50,000 | `manual_receipt` | **PAY-0011**, active |

**Sale SL-0001:** `total 125,000`, `paid_amount 75,000`, `due 50,000` — includes allocated manual receipt effect.

**JE-0041** (`f19d64ae-8c9e-41a3-afeb-7e13c40ebaac`) for PAY-0011:

- Dr Mobile Wallet **50,000**
- Cr **control** `1100` **50,000** (`account_id = 760dd283-4b20-4d19-baf3-5b7dd7ee292a`), `linked_contact_id` null on that line.

**`payment_adjustment` rows for these payment ids:** **none** (before any new edit — confirms amount-edit path did not post deltas for manual-only edits).

**RPC (company-wide branch NULL):**

- `get_contact_balances_summary`: receivables **105,000**, payables **0** for ABC.
- `get_contact_party_gl_balances`: `gl_ar_receivable` **55,000**, `gl_ap_payable` **0**.

The **50k operational vs party GL** gap is largely **architectural**: operational receivable uses **sales due + opening − unallocated manual_receipt subtract** per `get_contact_balances_summary`; party GL AR on live function version aggregates **lines on control `1100` only** with party resolution — mixed with sale lines on **child AR** accounts, different conventions. That is **not** the same as “edit left journal stale”; it is a **reporting / subtree** topic. The **edit** bug class is still: **after changing `payments.amount`, primary `manual_receipt` JE lines are not updated and no `payment_adjustment` was posted** from the dialog manual path.

## 3. Contacts page three-dots flow — no wrong context for both-type

From `ContactsPage.tsx`:

- **Customer receipt** and **supplier payment** open **`AddEntryV2`** with `initialCustomerContactId` / `initialSupplierContactId` set to the **same** `selectedContact.uuid` when `type === 'both'`.
- **Customer ledger** for `both` opens **`CustomerLedgerPageOriginal`** (not supplier ledger).
- **Supplier ledger** for `both` is **not** shown in the same trigger as customer-only; both-type users the **customer** ledger path for AR UI.

So **both-type** does **not** route customer receipt creation through supplier AP. The failure mode was **edit** via **`UnifiedPaymentDialog`** (manual branch), not contact type confusion.

## 4. Code fixes (recurrence prevention)

| File | Change |
|------|--------|
| `paymentAdjustmentService.ts` | Optional **`receivableAccountId`** for **sale**-context amount adjustments (party AR child via `resolveReceivablePostingAccountId`, else control 1100). Mirrors **`payableAccountId`** on purchase side. |
| `saleService.ts` | **`updatePayment`**: pass **`receivableAccountId`** from **`resolveReceivablePostingAccountId(companyId, sale.customer_id)`** so invoice-linked payment edits post AR deltas to the **party** account when applicable. |
| `UnifiedPaymentDialog.tsx` | After successful **edit** in the **manual** Supabase branch, when **`context === 'customer'`** and **`reference_type === 'manual_receipt'`** and amount changed: call **`postPaymentAmountAdjustment`** with **`receivableAccountId`** from **`resolveReceivablePostingAccountId(companyId, entityId)`**, then **`accountingEntriesChanged`**. |

## 5. Live SQL

No one-off data repair was required on the sampled ABC rows for this report: current PAY-0011 amount **matches** JE-0041 line amounts (50k). If a future case shows **payments.amount ≠ sum of primary JE effect** after an edit, apply a targeted **`payment_adjustment`** JE (same pattern as [SUPPLIER_PAYMENT_EDIT_LIVE_SQL_ROOT_CAUSE_FIX_REPORT.md](./SUPPLIER_PAYMENT_EDIT_LIVE_SQL_ROOT_CAUSE_FIX_REPORT.md)) or re-post using the app after deploying this fix.

## 6. Pure customer vs both-type — what differs

| Aspect | Pure customer | Both (ABC) |
|--------|----------------|------------|
| **Contact UUID** | One role | Same UUID for AR and AP sub-accounts |
| **Receipt create** | `AddEntryV2` + `initialCustomerContactId` | Same — **`initialCustomerContactId`** set |
| **Edit path** | `UnifiedPaymentDialog` manual branch if editing that payment | **Identical** — `context` is **`customer`**, `entityId` = contact |
| **Bug** | Missing adjustment JE on manual edit | **Same** — not caused by `type === 'both'` |

## 7. Verification checklist (post-deploy)

1. Record **on-account manual receipt** for a customer (or both-type) contact.  
2. Edit amount in the UI that uses **`UnifiedPaymentDialog`** (payment history / edit).  
3. Confirm new **`payment_adjustment`** JE exists, description contains “was Rs …, now Rs …”.  
4. Confirm **`get_contact_party_gl_balances`** moves with party AR line when party sub-account is used.  
5. **`npm run build`** — pass.

## 8. Remaining risks

1. **`get_contact_party_gl_balances` AR column** on some DB versions sums **only control 1100**, while AP uses **subtree** — structural AR/AP parity may still need a dedicated migration (AR subtree + `linked_contact_id`), separate from this edit fix.  
2. **`AddEntryV2`** if it ever gains **amount edit** without going through `saleService` / `postPaymentAmountAdjustment`, would need the same delta pattern.  
3. **Idempotency:** duplicate edits use `hasExistingPaymentAmountAdjustment` description match.
