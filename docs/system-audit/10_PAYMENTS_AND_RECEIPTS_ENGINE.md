# 10 — Payments and Receipts Engine

## Business Purpose

Records every cash movement between the company and a party (customer, supplier, or worker). A payment row is the canonical operational record of a receipt or disbursement; the matching journal entry (JE) is the canonical GL record. The two are always linked by `payments.id` ↔ `journal_entries.payment_id`. The engine supports customer receipts, supplier payments, advance (on-account) receipts/payments, and refunds, and tracks how each payment is allocated against open invoices through the `payment_allocations` table.

---

## UI Entry Points

| View / Route | Components |
|---|---|
| `/accounting` (Accounting Workbench) | `AccountingDashboard`, `AddEntryV2`, `TransactionDetailModal` |
| `/transactions` (Unified transaction feed) | `UnifiedPaymentDialog`, transaction list with mutation history |
| Sale detail page | `PaymentModal` (inline receipt against a specific invoice) |
| Party ledger pages | `SmartPaymentWidget`, `EffectivePartyLedgerPage` |
| AR/AP Reconciliation Center | `ArApReconciliationCenterPage` (read-only; no payment creation) |

---

## Frontend Files

| File | Role |
|---|---|
| `src/app/components/shared/UnifiedPaymentDialog.tsx` | Modal for creating/editing receipts and payments across sale and purchase contexts |
| `src/app/components/accounting/AddEntryV2.tsx` | Manual accounting entry; routes cash-touching entries through the payment creation path |
| `src/app/components/accounting/AccountingDashboard.tsx` | Journal workbench; lists all JEs with PF-14 chain flags |
| `src/app/components/accounting/TransactionDetailModal.tsx` | Drilldown into a single JE, shows chain history and allows reversal |
| `src/app/context/AccountingContext.tsx` | React context; exposes `createEntry`, `createReversalEntry`, `undoLastPaymentMutation` |
| `src/app/lib/paymentChainMutability.ts` | Client-side: `buildPaymentChainIndex`, `paymentChainFlagsForJournalEntry` — computes `paymentChainIsHistorical` / `paymentChainIsTail` per row |
| `src/app/lib/paymentEditFlowTrace.ts` | Trace helpers for payment edit flows |
| `src/app/utils/paymentUtils.ts` | `generatePaymentReference` — produces the human-readable reference number |

---

## Backend Services

| Service | File | Responsibility |
|---|---|---|
| `paymentAllocationService` | `src/app/services/paymentAllocationService.ts` | FIFO and explicit allocation of receipts/payments against open invoices/bills; both AR (customer) and AP (supplier) paths |
| `paymentLifecycleService` | `src/app/services/paymentLifecycleService.ts` | Void a payment's full JE chain; undo the last mutation in a PF-14 chain |
| `paymentChainMutationGuard` | `src/app/services/paymentChainMutationGuard.ts` | Guards edit and reversal on historical (superseded) JE chain members |
| `paymentChainCompositeReversal` | `src/app/services/paymentChainCompositeReversal.ts` | Builds a single composite `correction_reversal` JE that offsets the full effective payment amount |
| `paymentAdjustmentService` | `src/app/services/paymentAdjustmentService.ts` | Creates `payment_adjustment` JEs for amount edits and account changes (PF-14 delta pattern) |
| `addEntryV2Service` | `src/app/services/addEntryV2Service.ts` | Typed entry paths for manual receipt (`manual_receipt`) and manual payment (`manual_payment`); enforces payments-row-first rule |
| `supplierPaymentService` | `src/app/services/supplierPaymentService.ts` | Creates AP-side payments with AP debit and liquidity credit |
| `transactionMutationService` | `src/app/services/transactionMutationService.ts` | Append-only audit log of every payment state change (`transaction_mutations` table) |
| `accountingService` | `src/app/services/accountingService.ts` | Core JE insert (`createJournalEntry`); duplicate detection via `action_fingerprint`; `hasExistingPaymentAmountAdjustment`, `hasExistingPaymentAccountAdjustment` |
| `effectivePartyLedgerService` | `src/app/services/effectivePartyLedgerService.ts` | Collapses PF-14 mutation chains into single effective rows for party ledger display |

---

## DB Tables

### `payments`
Primary operational record. Key columns:
- `id` (UUID PK)
- `company_id`, `branch_id` — multi-tenant scoping
- `reference_type` — `'sale'`, `'purchase'`, `'manual_receipt'`, `'manual_payment'`, `'on_account'`, `'worker_payment'`, etc.
- `reference_id` — FK to the source document (e.g. `sales.id` for `reference_type='sale'`)
- `contact_id` — FK to `contacts` (customer or supplier)
- `amount` — payment amount (mutable; edits create `payment_adjustment` JEs)
- `payment_account_id` — FK to `accounts` (the Cash/Bank/Wallet account used)
- `payment_method` — `'cash'`, `'bank'`, `'mobile_wallet'`, `'other'`
- `reference_number` — human-readable reference (e.g. `REC-001`)
- `payment_date` — date of payment
- `voided_at` — set when payment is voided (does not delete the row)

### `payment_allocations`
Child rows linking a payment to one or more invoices/bills. Key columns:
- `payment_id` — FK to `payments`
- `sale_id` — FK to `sales` (for customer receipts; NULL for supplier)
- `purchase_id` — FK to `purchases` (for supplier payments; NULL for customer)
- `allocated_amount` — amount applied to this document
- `allocation_date`, `allocation_order` — ordering of FIFO allocation
- `company_id`, `branch_id`, `created_by`

Deleting `payment_allocations` rows triggers the DB function `recalc_sale_payment_totals` (for AR side) which recalculates `sales.paid_amount`, `sales.due_amount`, and `sales.payment_status`.

### `journal_entries` (payment JEs)
Each payment row has one or more linked JEs:
- `payment_id` — FK to `payments` (set on primary + all PF-14 adjustment JEs)
- `reference_type` — `'sale'`, `'purchase'`, `'manual_receipt'`, `'manual_payment'`, `'on_account'`, `'payment_adjustment'`, `'correction_reversal'`
- `reference_id` — document FK or payment FK depending on `reference_type`
- `action_fingerprint` — unique string that enforces idempotency via DB partial index `idx_journal_entries_fingerprint_active` (`WHERE action_fingerprint IS NOT NULL AND is_void IS NOT TRUE`)
- `economic_event_id` — chain key linking primary + PF-14 rows (usually equals `payments.id`)
- `is_void`, `void_reason`, `voided_at` — void state

### `transaction_mutations`
Append-only audit log. Key columns: `entity_type` (`'payment'`), `entity_id`, `mutation_type` (`'amount_edit'`, `'account_change'`, `'reversal'`, `'restore'`, etc.), `old_state`, `new_state`, `adjustment_journal_entry_id`, `source_journal_entry_id`, `actor_user_id`.

---

## Payment Types

| Type | `payments.reference_type` | Direction | Party |
|---|---|---|---|
| Customer receipt (against invoice) | `'sale'` | Money in | Customer (AR) |
| Manual customer receipt (FIFO/explicit) | `'manual_receipt'` | Money in | Customer (AR) |
| On-account receipt (advance credit) | `'on_account'` | Money in | Customer (AR) |
| Supplier payment (against PO/bill) | `'purchase'` | Money out | Supplier (AP) |
| Manual supplier payment | `'manual_payment'` | Money out | Supplier (AP) |
| Worker payment | `'worker_payment'` | Money out | Worker (AP/Worker Payable 2010) |
| Advance payment to supplier | `'manual_payment'` with no open bills | Money out | Supplier (AP) — unapplied |
| Refund (customer) | Reversal of `'sale'` or `'manual_receipt'` JE | Money out | Customer (AR) |

---

## Payment Create Flow (PF14 Framework)

The following steps apply to a manual receipt created through `addEntryV2Service` / `AddEntryV2`:

1. **Document number** — `documentNumberService.getNextDocumentNumber(companyId, branchId, 'customer_receipt')` generates `reference_number` (e.g. `REC-001`).
2. **Payments row insert** — a `payments` record is inserted first with `reference_type = 'manual_receipt'`, `contact_id`, `amount`, `payment_account_id`, `payment_date`.
3. **Journal entry insert** — `accountingService.createJournalEntry` inserts a `journal_entries` header with `payment_id = payments.id`, `reference_type = 'manual_receipt'`, `reference_id = contact_id` (for customer ledger matching). Lines:
   - Dr `payment_account_id` (Cash/Bank/Wallet, codes 1000/1010/1020) for `amount`
   - Cr AR control account (1100) or party subledger account for `amount`
4. **Fingerprint guard** — if `action_fingerprint` is set on the JE, the DB partial index `idx_journal_entries_fingerprint_active` blocks a duplicate insert. On conflict code `23505`, `accountingService` recovers the existing row instead of throwing.
5. **Allocation** — `applyManualReceiptAllocations` is called:
   - If `explicitAllocations` is provided: `validateExplicitAllocations` checks each sale belongs to this customer, is `status='final'`, and allocation does not exceed `due_amount`.
   - Otherwise: `buildManualReceiptAllocationPlan` → `fetchOpenInvoicesForFifo` (FIFO: `invoice_date ASC`, `invoice_no ASC`, `id ASC`) → `computeFifoAllocationPlan`.
   - `insertPaymentAllocationsFromPlan` writes `payment_allocations` rows with `allocated_amount` and `allocation_order`.
6. **Allocation triggers** — `payment_allocations` inserts trigger the Supabase DB function `recalc_sale_payment_totals(p_sale_id)` which updates `sales.paid_amount`, `sales.due_amount`, `sales.payment_status`.
7. **Mutation log** — `recordTransactionMutation` appends a `'create'` row to `transaction_mutations`.
8. **Activity log** — `activityLogService.logActivity` records per-invoice allocation events and any unapplied credit.
9. **Cache invalidation** — `notifyAccountingEntriesChanged()` fires `accountingEntriesChanged` custom event; `CONTACT_BALANCES_REFRESH_EVENT` fires to refresh party balance displays.

---

## Payment Allocation (`payment_allocations` table)

### AR (Customer Receipt)
- Function: `applyManualReceiptAllocations` in `paymentAllocationService.ts`
- FIFO fetch: `fetchOpenInvoicesForFifo` — queries `sales WHERE status='final' AND due_amount > 0.009`, ordered `invoice_date ASC, invoice_no ASC, id ASC`
- Compute plan: `computeFifoAllocationPlan` — epsilon check `0.02`; `Math.round(take * 100) / 100`
- Rebuild after edit: `rebuildManualReceiptFifoAllocations` — deletes all existing `payment_allocations` rows then re-runs `applyManualReceiptAllocations(skipActivityLog: true)`
- Summary: `getManualReceiptAllocationSummary` — returns `{ receiptTotal, allocatedTotal, unapplied, lines[] }`
- Unapplied remainder logged as `'manual_receipt_unapplied_credit'`

### AP (Supplier Payment)
- Function: `applyManualSupplierPaymentAllocations` — mirrors the AR path
- FIFO fetch: `fetchOpenPurchasesForFifo` — queries `purchases WHERE status IN ('final','received') AND due_amount > 0.009`, ordered `po_date ASC, po_no ASC, id ASC`
- Compute plan: `computeFifoPurchaseAllocationPlan`
- Rebuild after edit: `rebuildManualSupplierFifoAllocations`
- Unapplied remainder logged as `'manual_payment_unapplied_advance'`

### Allocation Row Schema (`payment_allocations`)
- `payment_id`, `sale_id` (AR) or `purchase_id` (AP), `allocated_amount`, `allocation_date`, `allocation_order`
- Legacy fallback: if `allocation_order` column absent from schema cache, inserts without it

---

## Payment Edit / Mutation (paymentChainMutationGuard.ts)

### What the guard protects
The `paymentChainMutationGuard` prevents editing or reversing a JE that has already been superseded by a later mutation in the same payment's PF-14 chain.

**Chain definition**: all active (non-void, non-`correction_reversal`) JEs where either:
- `journal_entries.payment_id = paymentId`, or
- `journal_entries.reference_type = 'payment_adjustment' AND reference_id = paymentId`

Sorted oldest → newest by `created_at`.

**Tail**: the last entry in the sorted chain (`fetchPaymentChainTailJournalEntryId`).

**Guard check** (`getPaymentChainMutationBlockReason`):
1. Load the target JE; if void, return null (already terminal).
2. Extract `paymentId` via `extractPaymentChainIdFromJournalRow` (checks `payment_id` first, then `reference_type = 'payment_adjustment'` + `reference_id`).
3. Fetch the current tail JE id.
4. If `tail !== journalEntryId`, return the block message: "This payment line is historical (a later edit or transfer exists). Use the latest journal row for this receipt to edit or reverse..."

**Historical prefix**: `HISTORICAL_PREFIX = 'PAYMENT_CHAIN_HISTORICAL:'` — callers can detect guard messages via `isPaymentChainHistoricalErrorMessage(msg)` and strip the prefix with `stripPaymentChainHistoricalPrefix(msg)`.

### Mutation types tracked in `transaction_mutations`
`'create'`, `'update_metadata'`, `'date_edit'`, `'amount_edit'`, `'qty_edit'`, `'account_change'`, `'contact_change'`, `'allocation_rebuild'`, `'reversal'`, `'void'`, `'restore'`, `'status_change'`

### Undo last mutation (`undoLastPaymentMutation` in paymentLifecycleService.ts)
1. Fetch the most recent `transaction_mutations` row for this payment (`entity_type='payment'`, `ORDER BY created_at DESC LIMIT 1`).
2. Void the `adjustment_journal_entry_id` JE on that mutation record.
3. Restore `payments.amount` (if `mutation_type='amount_edit'`) or `payments.payment_account_id` (if `mutation_type='account_change'`) from `old_state`.
4. Append a `'restore'` mutation log row.

---

## Payment Chain Reversal (paymentChainCompositeReversal.ts)

Standard JE reversal (mirroring only the tail JE) fails when a chain has multiple active members because the tail may represent only a delta (e.g. Rs 5,000 edit), not the full effective amount (e.g. Rs 50,000).

`tryBuildCompositePaymentChainReversal` builds a single `correction_reversal` JE based on the full `payments.amount` and the current `payments.payment_account_id`:

| Payment `reference_type` | Reversal lines |
|---|---|
| `'sale'` | Dr AR (party subledger via `resolveReceivablePostingAccountId`), Cr `payment_account_id` |
| `'manual_receipt'` / `'on_account'` | Dr AR (party subledger), Cr `payment_account_id` |
| `'purchase'` | Dr `payment_account_id`, Cr AP (party subledger via `resolvePayablePostingAccountId`) |
| `'manual_payment'` | Dr `payment_account_id`, Cr AP (party subledger) |

Returns `null` if party subledger account cannot be resolved → caller falls back to mirroring tail JE lines (legacy path).

---

## Accounting Effect (JE Format per Payment Type)

All amounts in functional currency (PKR). Epsilon for allocation: 0.02.

### Customer Receipt (sale or manual_receipt)
```
Dr  Cash/Bank/Wallet (1000/1010/1020)   [payment_account_id]   amount
    Cr  Accounts Receivable (1100)       [AR control or party subledger]   amount
```
`reference_type = 'sale'` or `'manual_receipt'`; `payment_id` set on header.

### Supplier Payment (purchase or manual_payment)
```
Dr  Accounts Payable (2000)             [AP control or party subledger]   amount
    Cr  Cash/Bank/Wallet (1000/1010/1020) [payment_account_id]            amount
```
`reference_type = 'purchase'` or `'manual_payment'`; `payment_id` set on header.

### On-Account (Advance Receipt from Customer)
```
Dr  Cash/Bank/Wallet (1000/1010/1020)   amount
    Cr  Accounts Receivable (1100)       amount
```
`reference_type = 'on_account'`; `reference_id = contact_id`.

### PF-14 Amount Edit Adjustment JE
When `payments.amount` is edited from `oldAmount` to `newAmount` (delta = `newAmount - oldAmount`):
```
If delta > 0 (increase):
  Dr  Cash/Bank/Wallet   delta
      Cr  AR/AP           delta

If delta < 0 (decrease):
  Dr  AR/AP              |delta|
      Cr  Cash/Bank/Wallet |delta|
```
`reference_type = 'payment_adjustment'`, `reference_id = paymentId`.
`action_fingerprint = 'payment_adjustment_amount:{companyId}:{paymentId}:{oldAmount}:{newAmount}:{liquidityAccountId}'`

### PF-14 Account Change Adjustment JE
When `payments.payment_account_id` changes from `oldAccountId` to `newAccountId`:
```
Dr  newAccountId (new liquidity account)   amount
    Cr  oldAccountId (old liquidity account)   amount
```
`reference_type = 'payment_adjustment'`, description includes "Payment account changed".

---

## Party Balance Effect

- **AR**: Customer's outstanding receivable balance is the net of all JE lines on AR accounts (1100 + party subledger children) attributed to that customer's sales and receipts. The `effectivePartyLedgerService.loadEffectivePartyLedger` collapses PF-14 chains into single effective rows, computing `runningBalance` as debit − credit on AR lines.
- **AP**: Supplier's outstanding payable balance is the net of JE lines on AP accounts (2000 + party subledger children). Same service handles `partyType='supplier'`.
- **Unapplied credit/advance**: If `allocatedTotal < amount`, the difference is the customer's advance credit or supplier's prepayment — shown in `EffectiveLedgerSummary.unapplied` and activity-logged as `'manual_receipt_unapplied_credit'` / `'manual_payment_unapplied_advance'`.

---

## Payment Status on Documents

### Sales (`sales.payment_status`)
Values: `'paid'`, `'partial'`, `'unpaid'`

Updated by the DB function `recalc_sale_payment_totals(p_sale_id UUID)` which is triggered:
- On `payment_allocations` insert or delete (via DB trigger)
- Explicitly from `saleReturnService` (`supabase.rpc('recalc_sale_payment_totals', { p_sale_id })`)
- On void of a payment (`voidPaymentAfterJournalReversal` deletes `payment_allocations`, which triggers the function)

### Purchases (`purchases.payment_status`)
Values: `'paid'`, `'partial'`, `'unpaid'`

Updated by DB function `recalc_purchase_payment_totals(p_purchase_id UUID)`, called explicitly from `purchaseReturnService`.

---

## Reports Impact

| Report | Payment contribution |
|---|---|
| Trial Balance | JE lines on Cash/Bank (1000/1010/1020) and AR/AP show payment receipts and disbursements |
| Balance Sheet | Cash/Bank positions reflect all unvoided payment JE lines |
| AR/AP Reconciliation Center (`arApReconciliationCenterService`) | `IntegrityLabSummary` compares GL AR net (1100 TB balance) against operational receivables from Contacts RPC; payment allocations that clear invoices reduce both sides |
| Day Book / Roznamcha | Payments rows with `payment_account_id` matching Cash/Bank/Wallet appear in the daily cash flow register |
| Effective Party Ledger | `loadEffectivePartyLedger` — payment rows grouped by `paymentId`, PF-14 mutations collapsed, `runningBalance` computed on AR or AP lines |

---

## Source of Truth

| Data | Canonical source | Forbidden alternatives |
|---|---|---|
| GL balance (AR, AP, Cash) | `journal_entries` + `journal_entry_lines` | `contacts.current_balance`, `contacts.balance`, `ledger_master`, `ledger_entries` |
| Payment existence | `payments` table | — |
| Invoice allocation | `payment_allocations` | — |
| Payment status on sale | `recalc_sale_payment_totals` result on `sales.paid_amount` / `due_amount` | Direct `UPDATE sales SET paid_amount` without RPC |
| Mutation history | `transaction_mutations` | — |

`accountingCanonicalGuard.ts` enforces this via `assertGlTruthQueryTable`, `warnLegacyRead`, and `failLegacyReadInDev`. Forbidden tables: `ledger_master`, `ledger_entries`, `chart_accounts`, `account_transactions`, `backup_cr`, `backup_pf145`.

---

## Known Failure Points

1. **Orphan payment without JE**: If `accountingService.createJournalEntry` throws after the `payments` row is inserted but before the JE is committed, the system has a payment with no GL entry. No compensating transaction or rollback runs. Detection: query `payments LEFT JOIN journal_entries ON payment_id = payments.id WHERE journal_entries.id IS NULL AND payments.voided_at IS NULL`.

2. **Double-allocation on rebuild**: `rebuildManualReceiptFifoAllocations` first calls `deletePaymentAllocationsByPaymentId` then re-inserts. If the delete succeeds but re-insert errors, the payment has zero allocations and the sale's `due_amount` is incorrect.

3. **Chain head vs tail confusion**: Reversing a historical (non-tail) JE in a PF-14 chain applies the wrong amount or wrong accounts. The `paymentChainMutationGuard` blocks this in the UI but does not prevent direct DB or API manipulation.

4. **`recalc_sale_payment_totals` not called on direct `payment_allocations` delete**: If `payment_allocations` rows are deleted by a maintenance script without the DB trigger firing, `sales.due_amount` and `payment_status` go stale.

5. **Composite reversal fallback**: If `resolveReceivablePostingAccountId` or `resolvePayablePostingAccountId` returns null, `tryBuildCompositePaymentChainReversal` returns null and the caller falls back to mirroring the tail JE lines. This is correct only if the chain has a single member.

6. **`allocation_order` schema cache miss**: `insertPaymentAllocationsFromPlan` has a legacy fallback that omits `allocation_order` when the column is missing from PostgREST's schema cache. This silently degrades allocation ordering.

7. **`action_fingerprint` partial index bypass**: The fingerprint guard applies only when `action_fingerprint IS NOT NULL`. Payment JEs created without a fingerprint (older code paths, or direct DB inserts) can be duplicated.

---

## Recommended Standard

1. **Always insert the `payments` row first**, then the JE with `payment_id` set. Never insert a JE for a payment event without the `payments` row.
2. **Set `action_fingerprint`** on every payment JE and every `payment_adjustment` JE. Format: `payment_adjustment_amount:{companyId}:{paymentId}:{oldAmount}:{newAmount}:{liquidityAccountId}`.
3. **Use `paymentChainMutationGuard.getPaymentChainMutationBlockReason`** before allowing any UI edit or reversal of a JE that carries a `payment_id`.
4. **Use `tryBuildCompositePaymentChainReversal`** for all payment reversals — fall back to tail-mirror only when it returns null.
5. **Never read `contacts.current_balance`** or any retired subledger table for GL reporting. Always derive balances from `journal_entry_lines` joined to `journal_entries`.
6. **All allocation changes must go through `rebuildManualReceiptFifoAllocations` / `rebuildManualSupplierFifoAllocations`** rather than direct `payment_allocations` manipulation, to ensure `recalc_sale_payment_totals` fires and activity logs are written.
