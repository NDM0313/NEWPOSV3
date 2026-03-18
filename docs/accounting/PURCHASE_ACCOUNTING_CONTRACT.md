# Purchase Accounting Contract (Phase 5)

**Status:** Locked from Phase 5. One standard contract for purchase create, edit, payment, discount, freight/labor/extra.  
**References:** ACCOUNTING_SOURCE_LOCK.md, COA_MAPPING_MATRIX.md, PAYMENT_ISOLATION_RULES.md.

---

## 1. Source lock

- COA: `accounts` only.
- Journal: `journal_entries` + `journal_entry_lines` only.
- Supplier ledger: `ledger_entries` + `ledger_master` (supplier sub-ledger only; GL totals from journal).
- No ledger_entries for GL totals; journal is source of truth for AP/Inventory.

---

## 2. Purchase create (received/final)

One JE per purchase (reference_type = 'purchase', reference_id = purchaseId). Duplicate guard: skip if JE already exists.

| Component | Debit | Credit |
|-----------|-------|--------|
| **Items (subtotal)** | Inventory (1200) = subtotal | AP (2000) = subtotal |
| **Discount** | AP (2000) = discount | Discount Received (5210) = discount |
| **Freight / labor / extra** | Inventory (1200) = otherCharges | AP (2000) = otherCharges |

- Account resolution: Inventory prefer code **1200** then 1500 then name; AP prefer **2000** then name; Discount Received prefer **5210** then name.
- Payment: never part of document JE; payment has its own JEs via supplier payment flow.

---

## 3. Purchase edit (component-level only)

Only changed components get adjustment JEs (reference_type = 'purchase_adjustment'). No blanket reversal; payment untouched unless payment changed.

| Delta | Adjustment JE |
|-------|----------------|
| **Subtotal** (items value) | Dr Inventory / Cr AP (or reverse). |
| **Discount** | Dr AP / Cr Discount Received (or reverse). |
| **Other charges** (freight/labor/extra) | Dr Inventory / Cr AP (or reverse). |

Idempotency: skip if purchase_adjustment with same description already exists.

---

## 4. Purchase payment

- **Create:** One `payments` row; one JE (Dr AP, Cr Cash/Bank). No document JE touched.
- **Edit (amount):** Update payments row; post payment_adjustment JE (delta only).
- **Edit (account only):** Post transfer JE (Dr new account, Cr old account).
- **Delete:** Per PAYMENT_ISOLATION_RULES; document JEs unchanged.

---

## 5. Purchase cancel

- Stock: reversals via purchase_final_stock_movement_trigger / purchase_cancelled logic.
- GL: Phase 5 does not require a reversal JE for cancelled purchase; original purchase JE remains. Optional future: add purchase_reversal JE mirroring create.

---

## 6. Files

| File | Role |
|------|------|
| `purchaseAccountingService.ts` | postPurchaseEditAdjustments (subtotal, discount, otherCharges deltas); account resolution 1200/2000/5210. |
| `PurchaseContext.tsx` | Purchase create JE (line-by-line: items + charges); same account resolution as service; edit path uses postPurchaseEditAdjustments; no blanket reversal. |
| `purchaseService.ts` | Update/cancel; payment not touched by document logic. |
| `paymentAdjustmentService.ts` | Purchase payment amount/account delta JEs only. |
