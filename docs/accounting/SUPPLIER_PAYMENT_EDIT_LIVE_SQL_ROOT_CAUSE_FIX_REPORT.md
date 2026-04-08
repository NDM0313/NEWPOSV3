# Supplier payment edit — live SQL root cause and fix report

**Date:** 2026-03-29  
**Company (live):** `595c08c2-1e47-4581-89c9-1f78de51c613`  
**Do not regress:** [CONTACTS_OPERATIONAL_GL_PARITY_FIX_REPORT.md](./CONTACTS_OPERATIONAL_GL_PARITY_FIX_REPORT.md), [PURCHASE_PAYMENT_CONTACTS_GL_FIX_REPORT.md](./PURCHASE_PAYMENT_CONTACTS_GL_FIX_REPORT.md), [SUPPLIER_LEDGER_STATEMENT_EDIT_UNIFICATION_FIX_REPORT.md](./SUPPLIER_LEDGER_STATEMENT_EDIT_UNIFICATION_FIX_REPORT.md).

## 1. Exact root cause (proven on live Postgres)

After a user edited supplier **`manual_payment`** **PAY-0010** from **20,000 → 30,000**:

| Layer | Source | What happened |
|--------|--------|----------------|
| **`payments`** | Row `dc7d9652-a10d-4430-a63d-f6c327836e32` | **`amount = 30,000`** — updated correctly by the dialog’s Supabase `UPDATE`. |
| **`payment_allocations`** | Row `292180cc-c6a2-472a-86c4-b3244b932a2a` | **`allocated_amount = 30,000`** — `rebuildManualSupplierFifoAllocations` after edit kept allocations in sync. |
| **`purchases.paid_amount` / `due_amount`** | `PUR-0003` `d3d289d0-8764-4fcf-9b28-f57c4df8a27a` | **`paid_amount = 40,000`**, **`due_amount = 360,000`** — correct for `recalc_purchase_payment_totals` (10k direct purchase payment + 30k allocated manual). |
| **Operational RPC** | `get_contact_balances_summary` | Used purchase **due** + opening + unallocated manual subtract — reflected **30k** payment row; **no stale 20k** here. |
| **Supplier operational ledger (UI)** | `getSupplierOperationalLedgerData` → `payments.amount` | Showed **30,000** per row — correct. |
| **Supplier GL tab / party GL** | `journal_entry_lines` on party AP + wallet | **Original JE-0039 lines stayed 20,000 / 20,000.** No `payment_adjustment` JE was posted for the **manual** edit path. |

So the **stale “20,000 effect”** was **not** `payments`, **not** allocations, **not** `purchases.paid_amount`, and **not** the operational RPC. It was **journal truth**: the **primary `manual_payment` JE** (`JE-0039`, `journal_entries.id = 93e0f90c-5af3-4243-a5e2-cf3fc30c7f98`) **was never updated** and **no delta JE** was posted because **`UnifiedPaymentDialog`**’s manual edit branch only ran:

- `UPDATE payments`
- `rebuildManualSupplierFifoAllocations`
- `syncJournalEntryDateByPaymentId`

— and **did not** call **`postPaymentAmountAdjustment`** (unlike **`purchaseService.updatePayment`** for **purchase-linked** payments).

**Contrast:** Purchase-linked payment edits go through `purchaseService.updatePayment`, which posts a **`payment_adjustment`** entry. **Supplier `manual_payment` edits** used the generic Supabase path → **GL drift**.

## 2. Live rows involved (DIN COUTURE)

| Role | id / ref |
|------|-----------|
| Supplier contact | `eea21856-8fef-4501-9906-93d3e3a94a7c` (DIN COUTURE) |
| Purchase | `d3d289d0-8764-4fcf-9b28-f57c4df8a27a` (PUR-0003, total 400,000) |
| Manual payment PAY-0010 | `dc7d9652-a10d-4430-a63d-f6c327836e32` |
| Allocation to PUR-0003 | `292180cc-c6a2-472a-86c4-b3244b932a2a` (30,000) |
| Original manual JE | `93e0f90c-5af3-4243-a5e2-cf3fc30c7f98` (JE-0039) |
| AP line (party) | `b52b5bfb-019d-40d3-bf6a-5562eaad24fe` → account `12f4a7ac-20e1-403d-b683-a0c7b725c2a7` (AP-EEA218568FEF) |
| Wallet line | `5d2c28e0-d3d8-4684-9488-72798b72f242` (1020 Mobile Wallet) — **still 20,000** until repair |

## 3. Forensic matrix — where each screen gets its numbers

| Engine | Code | SQL / data |
|--------|------|------------|
| **Supplier operational tab** | `getSupplierOperationalLedgerData` | `purchases` + `payments` (amounts on rows) |
| **Supplier GL tab** | `accountingService` party AP query in `GenericLedgerView` | `journal_entry_lines` joined to AP subtree / `linked_contact_id` |
| **Reconciliation** | `getSingleSupplierPartyReconciliation` | `get_contact_balances_summary` vs `get_contact_party_gl_balances` |
| **Contacts grey payables** | `contactService.getContactBalancesSummary` | RPC `get_contact_balances_summary` |
| **Journal / Day Book** | `AccountingContext` / Day Book query | `journal_entries` + lines |
| **Purchases paid/due** | Purchase row | `recalc_purchase_payment_totals` (payments + allocations) |

**Stale path:** only **GL / journal-derived** views that sum **lines** without treating **`payments.amount`** as override.

## 4. Live SQL repair (applied on VPS `supabase-db`)

Inserted one **`payment_adjustment`** journal entry **+10,000** delta (Dr party AP `12f4a7ac-20e1-403d-b683-a0c7b725c2a7`, Cr same wallet account as JE-0039), `reference_id = dc7d9652-a10d-4430-a63d-f6c327836e32`, `entry_no = JE-PAY-ADJ-DC7D-10K`, new JE id **`c9e20910-3ceb-4696-851e-0edab08f4b02`**.

**Verification after insert:**

```sql
SELECT * FROM get_contact_balances_summary('595c08c2-1e47-4581-89c9-1f78de51c613'::uuid, NULL)
WHERE contact_id = 'eea21856-8fef-4501-9906-93d3e3a94a7c';
-- payables = 430000

SELECT * FROM get_contact_party_gl_balances('595c08c2-1e47-4581-89c9-1f78de51c613'::uuid, NULL)
WHERE contact_id = 'eea21856-8fef-4501-9906-93d3e3a94a7c';
-- gl_ap_payable = 430000
```

Operational and party GL **matched** after repair.

## 5. Repository fixes (prevent recurrence)

| File | Change |
|------|--------|
| `src/app/services/paymentAdjustmentService.ts` | Optional **`payableAccountId`** on `postPaymentAmountAdjustment` so purchase-side deltas hit **party AP**, not only generic **2000**. |
| `src/app/services/purchaseService.ts` | On purchase-linked payment amount edit, resolve **`resolvePayablePostingAccountId(companyId, supplier_id)`** and pass **`payableAccountId`**. |
| `src/app/components/shared/UnifiedPaymentDialog.tsx` | On **edit** of **`manual_payment`** with **`context === 'supplier'`**, when amount changes, call **`postPaymentAmountAdjustment`** with party AP + dispatch **`accountingEntriesChanged`**. |

Idempotency: `hasExistingPaymentAmountAdjustment` matches description “was Rs …, now Rs …”; the live SQL repair used that pattern so the app will **not** duplicate the same 20k→30k adjustment on next deploy.

## 6. Why one screen showed 30,000 and another still “20,000”

- **30,000** came from **`payments.amount`** (and from operational math that includes payment debits).
- **20,000** came from **`journal_entry_lines`** on **`JE-0039`** (unchanged original posting).
- Reconciliation then showed **operational vs GL variance** until the **+10k adjustment JE** aligned party GL with subledger.

## 7. Remaining risks

1. **Customer `manual_receipt` amount edit** — same class of bug may exist if the manual path does not post AR delta; not patched in this change set.
2. **Historical JEs** — any other **manual_payment** amount edits done before this fix may still need a one-off **`payment_adjustment`** or line correction (query: `payments.amount` vs sum of primary JE lines for same `payment_id`).
3. **`postPaymentAmountAdjustment` + generic 2000** — without **`payableAccountId`**, purchase-linked deltas could still miss party sub-accounts; mitigated for **`purchaseService.updatePayment`** and supplier manual dialog path.

## 8. Acceptance checklist

1. **Source of 30,000:** `payments.amount` on `dc7d9652-a10d-4430-a63d-f6c327836e32`.  
2. **Source of stale impact:** `journal_entry_lines` on `93e0f90c-5af3-4243-a5e2-cf3fc30c7f98` (20k) with **no** adjustment until live SQL + code fix.  
3. **Live SQL:** adjustment JE inserted; RPC parity verified **430k / 430k**.  
4. **Code:** manual supplier payment edits now post **`payment_adjustment`**; purchase-linked adjustments use **party AP** when resolvable.
