# Sale Accounting Contract (Phase 4)

**Status:** Locked from Phase 4. One standard contract for sale create, edit, payment, shipping, discount, extra expense, COGS.  
**References:** ACCOUNTING_SOURCE_LOCK.md, COA_MAPPING_MATRIX.md, PAYMENT_ISOLATION_RULES.md.

---

## 1. Source lock

- COA: `accounts` only.
- Journal: `journal_entries` + `journal_entry_lines` only.
- Roznamcha: `payments`.
- No ledger_entries/ledger_master for GL totals.

---

## 2. Sale create (finalize)

One JE per sale (reference_type = 'sale', reference_id = saleId). Duplicate guard: skip if JE already exists.

| Component | Debit | Credit |
|-----------|-------|--------|
| **Receivable** | AR (1100) = total | — |
| **Product revenue** | — | Sales Revenue (4000) = grossTotal − shipmentCharges |
| **Shipping (charged to customer)** | — | Shipping Income (4100) = shipmentCharges |
| **Discount** | Discount Allowed (5200) = discountAmount | — |
| **COGS** | Cost of Production (5000) = totalCogs | Inventory (1200) = totalCogs |

- grossTotal = total + discountAmount (subtotal before discount).
- Extra expense (if any): separate JE, reference_type = 'sale_extra_expense'.

---

## 3. Sale edit (component-level only)

Only changed components get adjustment JEs (sale_adjustment). No blanket reversal; payment untouched unless payment changed.

| Delta | Adjustment JE |
|-------|----------------|
| **Revenue** (subtotal change) | Dr AR / Cr Sales Revenue (or reverse). |
| **Discount** | Dr Discount Allowed / Cr Sales Revenue (or reverse). |
| **Extra expense** | Dr Extra Expense / Cr AP (or reverse). |
| **Shipping** | Dr AR / Cr **Shipping Income (4100)** (or reverse). |

Idempotency: skip if adjustment with same description already exists.

---

## 4. Sale payment

- **Create:** One `payments` row; one JE (Dr Cash/Bank, Cr AR). No document JE touched.
- **Edit (amount):** Update payments row; post one payment_adjustment JE (delta only).
- **Edit (account only):** Post one transfer JE (Dr new account, Cr old account).
- **Delete:** Per PAYMENT_ISOLATION_RULES; document JEs unchanged.

---

## 5. Sale cancel (reversal)

One reversal JE (reference_type = 'sale_reversal'). Reverses: Sales Revenue, Shipping Income (if any), Discount, AR, COGS/Inventory. Matches create amounts (total, discountAmount, shipmentCharges).

---

## 6. Activity / history

- **sale_component_edited:** Only when value actually changed (oldVal !== newVal).
- **payment_edited:** Only when amount or account/method changed; no "from X to X" when amount unchanged.

---

## 7. Files

| File | Role |
|------|------|
| `saleAccountingService.ts` | createSaleJournalEntry, reverseSaleJournalEntry, postSaleEditAdjustments; Shipping Income (4100). |
| `saleService.ts` | Calls create/reverse with discountAmount, shipmentCharges; no blanket reversal. |
| `shipmentAccountingService.ts` | Shipment JE (Dr AR Cr Shipping Income; Dr Shipping Expense Cr Courier Payable). |
| `paymentAdjustmentService.ts` | Payment amount/account delta JEs only. |
| `SalesContext.tsx` | Document deltas + payment sync only when changed; activity only on change. |

---

*Last updated: Phase 4 completion.*
