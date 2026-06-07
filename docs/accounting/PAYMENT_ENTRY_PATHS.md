# Payment entry paths — audit matrix (Phase A)

**Date:** 2026-06-04  
**Scope:** Web ERP (`src/app`) + canonical DB RPC `record_payment_with_accounting`  
**Out of scope:** Changing GL debit/credit rules, AR/AP mapping, void/reversal triggers, or rewriting historical `payments.reference_number` / `rental_payments.reference`.

This document maps every **user-visible** way money moves through cash/bank/wallet and how reference numbers are allocated today.

---

## Canonical numbering (database)

| `erp_document_sequences.document_type` | Default prefix | Used when |
|----------------------------------------|----------------|-----------|
| `customer_receipt` | **RCV-** | `payment_type = received` via RPC (and some client paths) |
| `payment` | **PAY-** | `payment_type = paid` via RPC (sale/purchase on-account, supplier doc pay, etc.) |
| `supplier_payment` | **PAY-** (same prefix, **separate counter**) | Add Entry supplier + AccountingContext manual pay-out |
| `worker_payment` | **WPY-** | RPC when `reference_type = worker_payment` |
| `expense` | **EXP-** | Add Entry expense payment, AccountingContext expense liquidity |
| `manual_journal` | **JV-** | Pure journal (`journal_entries.document_no`) |
| `fund_transfer` | **FT-** | Internal transfer |

RPC source: [`migrations/20260523130000_received_payment_rcv_numbering.sql`](../../migrations/20260523130000_received_payment_rcv_numbering.sql) — received → `customer_receipt`; paid → `payment`; worker → `worker_payment`.

Prefix map: [`migrations/20260432_erp_customer_receipt_prefix_rcv.sql`](../../migrations/20260432_erp_customer_receipt_prefix_rcv.sql).

---

## Master audit table

| # | UI entry point | Component | Service / backend | Table(s) | `payment_type` | `reference_type` | `reference_id` | Sequence key | Voucher prefix (`payments` / rental) | JE `entry_no` | Branch source | Backend class |
|---|----------------|-----------|-------------------|----------|------------------|------------------|----------------|--------------|--------------------------------------|---------------|-----------------|---------------|
| 1 | Sale list / drawer → **Add Payment** | [`SalesPage.tsx`](../../src/app/components/sales/SalesPage.tsx), [`ViewSaleDetailsDrawer.tsx`](../../src/app/components/sales/ViewSaleDetailsDrawer.tsx) | [`saleService.recordPayment`](../../src/app/services/saleService.ts) | `payments` + JE | `received` | `sale` | Sale UUID | RPC → `customer_receipt` | **RCV-** | RPC-linked JE | Session `branchId`; passed to RPC | **RPC** |
| 2 | Sale form → Add Payment | [`SaleForm.tsx`](../../src/app/components/sales/SaleForm.tsx) | Same as #1 via [`UnifiedPaymentDialog`](../../src/app/components/shared/UnifiedPaymentDialog.tsx) | `payments` + JE | `received` | `sale` | Sale UUID | RPC → `customer_receipt` | **RCV-** | RPC-linked JE | Session / first branch fallback | **RPC** |
| 3 | POS checkout payment | [`POS.tsx`](../../src/app/components/pos/POS.tsx) | `UnifiedPaymentDialog` → `saleService` | `payments` + JE | `received` | `sale` | Sale UUID | RPC → `customer_receipt` | **RCV-** | RPC-linked JE | Session branch | **RPC** |
| 4 | Contact → **Receive Payment** | [`ContactsPage.tsx`](../../src/app/components/contacts/ContactsPage.tsx), [`ContactList.tsx`](../../src/app/components/contacts/ContactList.tsx) | `UnifiedPaymentDialog` → `saleService.recordOnAccountPayment` | `payments` + JE | `received` | `on_account` | Contact UUID | RPC → `customer_receipt` | **RCV-** | RPC-linked JE | Session or first branch | **RPC** |
| 5 | Accounting → Add Entry → **Customer Receipt** | [`AddEntryV2.tsx`](../../src/app/components/accounting/AddEntryV2.tsx) | [`createCustomerReceiptEntry`](../../src/app/services/addEntryV2Service.ts) | `payments` + JE via `accountingService.createEntry` | `received` | `manual_receipt` | `null` (contact on `contact_id`) | Client → `customer_receipt` | **RCV-** | Client `JE-{timestamp}` | UI branch selector | **Client insert + manual JE** |
| 6 | Accounting → manual entry (cash **in**) | [`AccountingContext.createEntry`](../../src/app/context/AccountingContext.tsx) | Direct `payments.insert` | `payments` + JE | `received` | `manual_receipt` | `null` | Client → `customer_receipt` | **RCV-** | `allocateEntryNo()` / JE | Settings branch | **Client insert** |
| 7 | Purchase → **Add Payment** | [`PurchasesPage.tsx`](../../src/app/components/purchases/PurchasesPage.tsx), drawer | `UnifiedPaymentDialog` → [`purchaseService.recordPayment`](../../src/app/services/purchaseService.ts) → [`createSupplierPayment`](../../src/app/services/supplierPaymentService.ts) | `payments` + JE | `paid` | `purchase` | Purchase UUID | RPC → `payment` | **PAY-** | RPC-linked JE | **Purchase row `branch_id`**, else session | **RPC** |
| 8 | Contact → **Make Payment** (supplier) | Contacts | `UnifiedPaymentDialog` → `purchaseService.recordOnAccountPayment` → `createSupplierPayment` | `payments` + JE | `paid` | `on_account` | Supplier contact UUID | RPC → `payment` | **PAY-** | RPC-linked JE | Session / first branch | **RPC** |
| 9 | Accounting → Add Entry → **Supplier Payment** | `AddEntryV2` | [`createSupplierPaymentEntry`](../../src/app/services/addEntryV2Service.ts) | `payments` + JE | `paid` | `manual_payment` | `null` | Client → **`supplier_payment`** | **PAY-** (different counter) | Client `JE-{timestamp}` | UI branch | **Client insert + manual JE** |
| 10 | Accounting → manual entry (cash **out**, AP) | `AccountingContext` | Direct `payments.insert` | `payments` + JE | `paid` | `manual_payment` | `null` | Client → **`supplier_payment`** | **PAY-** (different counter) | JE | Settings branch | **Client insert** |
| 11 | Studio / worker → Pay | [`StudioSaleDetailNew.tsx`](../../src/app/components/studio/StudioSaleDetailNew.tsx), `UnifiedPaymentDialog` `context=worker` | [`AccountingContext.recordWorkerPayment`](../../src/app/context/AccountingContext.tsx) → [`createWorkerPayment`](../../src/app/services/workerPaymentService.ts) | `payments` + JE | `paid` | `worker_payment` | Worker contact UUID | RPC → `worker_payment` | **WPY-** | RPC-linked JE | `resolveBranchIdForPaymentRpc` | **RPC** |
| 12 | Add Entry → **Worker Payment** | `AddEntryV2` | [`createWorkerPaymentEntry`](../../src/app/services/addEntryV2Service.ts) | `payments` + JE | `paid` | `worker_payment` | Worker UUID | Client → **`payment`** | **PAY-** (not WPY) | Client `JE-{timestamp}` | UI branch | **Client insert** (duplicate-risk comment in code) |
| 13 | Add Entry → **Courier Payment** | `AddEntryV2` | [`createCourierPaymentEntry`](../../src/app/services/addEntryV2Service.ts) | `payments` + JE | `paid` | `courier_payment` | Courier id | Client → **`payment`** | **PAY-** | `JE-COUR-{timestamp}` | UI branch | **Client insert** |
| 14 | Add Entry → **Expense Payment** | `AddEntryV2` | [`createExpensePaymentEntry`](../../src/app/services/addEntryV2Service.ts) | `payments` + JE | `paid` | `expense` | `null` | Client → **`expense`** | **EXP-** (not PAY) | Client `JE-{timestamp}` | UI branch | **Client insert** |
| 15 | Expense module liquidity | `AccountingContext` (source `Expense`) | `payments.insert` | `payments` + JE | `paid` | `expense` | Expense id | Client → `expense` | **EXP-** | JE | Settings branch | **Client insert** |
| 16 | Add Entry → **Internal Transfer** | `AddEntryV2` | [`createInternalTransferEntry`](../../src/app/services/addEntryV2Service.ts) | JE + optional `payments` via [`ensurePaymentsForLiquidityJournal`](../../src/app/services/journalLiquidityPaymentService.ts) | IN/OUT rows | `manual_receipt` / `manual_payment` | `journal_entry_id` | `fund_transfer` (JE); payment ref = **entry no** | **FT-** on JE; roznamcha may show **JV/FT** on payment row | `fund_transfer` | UI branch | **JE-first** |
| 17 | Add Entry → **Pure Journal** | `AddEntryV2` | [`createPureJournalEntry`](../../src/app/services/addEntryV2Service.ts) | JE + liquidity backfill | N/A unless cash leg | `journal` | — | `manual_journal` | **JV-** on JE; liquidity rows may copy **JV** as `reference_number` | **JV-** | UI branch | **JE-first (not RCV/PAY)** |
| 18 | Rental → receive / penalty | [`RentalsPage.tsx`](../../src/app/components/rentals/RentalsPage.tsx), dashboard, list | [`rentalService.addPayment`](../../src/app/services/rentalService.ts) | **`rental_payments`** (not `payments`) | N/A (rental table) | N/A | `rental_id` | **None** (booking-based string) | **`{booking_no}-PAY`** e.g. REN-0002-PAY | Separate rental JEs via `AccountingContext` | Rental row | **Rental subledger** |
| 19 | Journal row → Receive / Pay | [`TransactionDetailModal.tsx`](../../src/app/components/accounting/TransactionDetailModal.tsx) | Routes to `UnifiedPaymentDialog` | Depends on context | — | — | — | — | — | — | — | **Mixed** |
| 20 | Integrity Lab / test pages | [`AccountingIntegrityLabPage.tsx`](../../src/app/components/admin/AccountingIntegrityLabPage.tsx), [`AccountingTestPage.tsx`](../../src/app/components/test/AccountingTestPage.tsx) | `saleService` / `purchaseService` / `testAccountingService` | `payments` | varies | varies | varies | Mixed / legacy | Mixed | Mixed | Lab branch | **Test only** |

---

## Unified Payment Dialog (`context` prop)

Single component: [`src/app/components/shared/UnifiedPaymentDialog.tsx`](../../src/app/components/shared/UnifiedPaymentDialog.tsx).

| `context` | Money direction | Service called | Numbering path |
|-----------|-----------------|----------------|----------------|
| `customer` | In (sale due or on-account) | `saleService.recordPayment` / `recordOnAccountPayment` | **RPC → RCV** |
| `supplier` | Out | `purchaseService` → `createSupplierPayment` | **RPC → PAY** |
| `worker` | Out | `AccountingContext.recordWorkerPayment` → `createWorkerPayment` | **RPC → WPY** |
| `rental` | In (advance / remaining / penalty) | `rentalService.addPayment` + rental JEs | **`rental_payments.reference` = REN-*-PAY** (not RCV) |
| `sale` / POS | In | Same as customer with `referenceId` = sale | **RPC → RCV** |

**Note:** For sale-linked customer payments, dialog calls `saleService.recordPayment` then `accounting.recordSalePayment` — the latter only **verifies** JE linkage; it does not allocate a second ref ([`AccountingContext.tsx`](../../src/app/context/AccountingContext.tsx) ~2103).

---

## Roznamcha (daily cash book)

Source: [`src/app/services/roznamchaService.ts`](../../src/app/services/roznamchaService.ts).

- Primary: `payments` where `payment_account_id` is cash/bank/wallet.
- Also: `rental_payments` merged by date/amount/account (ref often **REN-*-PAY**).
- Journal-only cash legs merged when no payment row; ref display via [`resolveCanonicalRoznamchaRef`](../../src/app/services/roznamchaService.ts) (RCV / PAY / WPY / REN / EXP / JE priority).
- Branch filter: [`paymentMatchesRoznamchaBranch`](../../src/app/services/roznamchaService.ts).

---

## SQL audit (run on VPS / Supabase — read-only)

Use to see **counter drift** between sequence keys (same prefix, different `last_number`):

```sql
SELECT document_type, branch_id, prefix, last_number, year
FROM erp_document_sequences
WHERE company_id = '<company_uuid>'
  AND document_type IN (
    'customer_receipt', 'payment', 'supplier_payment', 'worker_payment', 'expense'
  )
ORDER BY document_type, branch_id NULLS FIRST, year;
```

Sample recent vouchers:

```sql
SELECT reference_number, payment_type, reference_type, branch_id, created_at
FROM payments
WHERE company_id = '<company_uuid>'
ORDER BY created_at DESC
LIMIT 50;
```

Rental (separate table):

```sql
SELECT reference, amount, payment_date, rental_id
FROM rental_payments
ORDER BY created_at DESC
LIMIT 30;
```

---

## Target vs current (why office sees different numbers)

| User expectation | Current behavior |
|------------------|------------------|
| All customer **receive** → one **RCV** series | RPC paths yes; Add Entry / manual AccountingContext use same `customer_receipt` key; rental uses **REN-*-PAY** on `rental_payments` |
| All supplier **pay** → one **PAY** series | **Phase B:** RPC + Add Entry supplier/worker/courier use unified `payment` sequence (PAY-). Legacy **`supplier_payment`** / **WPY** counters deprecated; see Settings → Numbering Maintenance |
| Expense pay → PAY | Often **EXP-** prefix |
| Pure journal | **JV-** only (correct); liquidity backfill may put **JV** on `payments.reference_number` |
| Roznamcha = all cash in/out | Merges `payments` + `rental_payments` + some JE legs; refs differ by source |

---

## File index (implementation touch points)

| Area | Files |
|------|--------|
| RPC wrapper | [`src/app/services/recordPaymentWithAccountingRpc.ts`](../../src/app/services/recordPaymentWithAccountingRpc.ts) |
| Sale / customer receive | [`src/app/services/saleService.ts`](../../src/app/services/saleService.ts), [`UnifiedPaymentDialog.tsx`](../../src/app/components/shared/UnifiedPaymentDialog.tsx) |
| Purchase / supplier pay | [`src/app/services/purchaseService.ts`](../../src/app/services/purchaseService.ts), [`src/app/services/supplierPaymentService.ts`](../../src/app/services/supplierPaymentService.ts) |
| Worker pay (canonical) | [`src/app/services/workerPaymentService.ts`](../../src/app/services/workerPaymentService.ts) |
| Add Entry (all types) | [`src/app/services/addEntryV2Service.ts`](../../src/app/services/addEntryV2Service.ts), [`AddEntryV2.tsx`](../../src/app/components/accounting/AddEntryV2.tsx) |
| Manual accounting UI | [`src/app/context/AccountingContext.tsx`](../../src/app/context/AccountingContext.tsx) |
| Numbering API | [`src/app/services/documentNumberService.ts`](../../src/app/services/documentNumberService.ts) |
| Settings numbering UI | [`NumberingRulesTable.tsx`](../../src/app/components/settings/NumberingRulesTable.tsx), [`numberingMaintenanceService.ts`](../../src/app/services/numberingMaintenanceService.ts), [`PHASE_B_PAY_SMOKE.md`](PHASE_B_PAY_SMOKE.md) |

### Settings (admin)

- **Rules:** Edit `PAYMENT` (Outgoing payment), `CUSTOMER_RECEIPT`, `EXPENSE` only — not legacy `SUPPLIER_PAYMENT` / `WORKER_PAYMENT`.
- **Maintenance:** Analyze compares PAY effective counter to max `PAY-*` in `payments`; merge button aligns legacy supplier counter into PAY for **your company only** (owner/admin RPC).
- **Audit log:** Read-only; friendly labels for document types.
| Rental | [`src/app/services/rentalService.ts`](../../src/app/services/rentalService.ts), [`src/app/lib/rentalPaymentRef.ts`](../../src/app/lib/rentalPaymentRef.ts) |
| Roznamcha display | [`src/app/services/roznamchaService.ts`](../../src/app/services/roznamchaService.ts) |
| Liquidity backfill | [`src/app/services/journalLiquidityPaymentService.ts`](../../src/app/services/journalLiquidityPaymentService.ts) |
| DB RPC / sequences | [`migrations/20260523130000_received_payment_rcv_numbering.sql`](../../migrations/20260523130000_received_payment_rcv_numbering.sql), [`migrations/20260432_erp_customer_receipt_prefix_rcv.sql`](../../migrations/20260432_erp_customer_receipt_prefix_rcv.sql) |

---

## Related plans

- Boot stability (chunks): commit `56968836` — separate from payment numbering.
- Unification implementation: [`.cursor/plans/unify_payment_references_0d47bf25.plan.md`](../../.cursor/plans/unify_payment_references_0d47bf25.plan.md) Phases B–E.
