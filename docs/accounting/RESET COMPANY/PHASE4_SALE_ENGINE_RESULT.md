# Phase 4 — Sale Engine Rebuild: RESULT

**Date:** 2025-03-18  
**Plan reference:** `ACCOUNTING_PHASE_PLAN_AND_PROMPTS.md` — Phase 4  
**Status:** Complete (awaiting approval before Phase 5)

---

## 1. Root cause

Sale accounting was not fully aligned to one standard contract:

- **Shipping income:** Shipping charged to customer was posted to **Sales Revenue (4000)** in both create and edit. Per COA mapping, it must go to **Shipping Income (4100)**. Edit delta also credited Sales Revenue instead of 4100.
- **Sale create:** Did not split product revenue vs shipping; total was credited entirely to Sales Revenue even when sale had shipment_charges. Reversal (cancel) did not reverse Shipping Income.
- **Sale create/reverse:** discountAmount and shipmentCharges were not passed from saleService, so create/reverse could not split correctly.
- **Activity:** Already guarded (log only when value changed); clarified as Phase 4 requirement.

Phase 4 rebuilds the sale engine to one contract: source lock, COA mapping lock, payment isolation; component-level edit only; no blanket reversal.

---

## 2. Final sale accounting rules implemented

| Event | Rule |
|-------|------|
| **Sale create** | One JE: Dr AR (total), Dr Discount Allowed (if any), Cr Sales Revenue (grossTotal − shipmentCharges), Cr Shipping Income (4100) for shipmentCharges, plus COGS/Inventory. Extra expense: separate JE. |
| **Sale edit** | Only changed components get sale_adjustment JEs (revenue, discount, shipping, extra). Shipping delta → Cr Shipping Income (4100), not Sales Revenue. Payment untouched unless payment changed. |
| **Sale cancel** | One reversal JE matching create: Sales Revenue, Shipping Income (if any), Discount, AR, COGS/Inventory. |
| **Sale payment** | Per PAYMENT_ISOLATION_RULES; create/edit/delete isolated; no document JE touched. |
| **Activity** | sale_component_edited only when value actually changed; payment_edited only when amount or account changed. |

---

## 3. Files changed

| File | Change |
|------|--------|
| `docs/accounting/SALE_ACCOUNTING_CONTRACT.md` | **New.** Single contract for sale create, edit, payment, shipping, discount, extra, COGS. |
| `src/app/services/saleAccountingService.ts` | ensureShippingIncomeAccount (4100); createSaleJournalEntry accepts shipmentCharges and credits 4100; reverseSaleJournalEntry accepts shipmentCharges and reverses 4100; postSaleEditAdjustments uses Shipping Income (4100) for shipping delta; header updated to Phase 4 contract. |
| `src/app/services/saleService.ts` | createSaleJournalEntry calls pass discountAmount and shipmentCharges; reverseSaleJournalEntry call passes discountAmount and shipmentCharges; cancel select includes discount_amount, shipment_charges. |
| `src/app/context/SalesContext.tsx` | Comment: Phase 4 activity only when value changed. |

---

## 4. SQL used

**None.** Phase 4 is code-only; no migrations, no destructive DB changes.

---

## 5. Verification (real sale cases)

- **Sale create with shipping:** Finalize a sale that has shipment_charges and (optionally) discount_amount. Expected: one sale JE with Dr AR, Cr Sales Revenue (product part), Cr Shipping Income (4100) for shipping part, and Dr Discount / COGS as applicable. No blanket reversal.
- **Sale edit – shipping only:** Edit only shipping charged to customer. Expected: one sale_adjustment JE with Dr AR, Cr Shipping Income (4100). No change to Sales Revenue or payment JEs.
- **Sale edit – document only:** Edit total or discount only; do not change payment. Expected: only sale_adjustment JEs; payment JEs and payment ledger untouched (Phase 3).
- **Sale cancel:** Cancel a finalized sale that had shipping. Expected: one reversal JE including Dr Shipping Income (4100) and Dr Sales Revenue, Cr AR, etc.

Verification can be done on current live edited sale records: run a few create/edit/cancel flows and confirm journal entries match the contract (4100 for shipping, component-level adjustments only, payment isolated).

---

## 6. Summary

- **Goal:** Rebuild sale accounting to one standard contract (source lock, COA mapping, payment isolation); component-level edit only; no blanket reversal.
- **Deliverables:** SALE_ACCOUNTING_CONTRACT.md; Shipping Income (4100) on create, edit delta, and reversal; saleService passes discount/shipment to create and reverse; activity only on change.
- **Acceptance:** Sale create/edit/payment/shipping/discount/extra/COGS follow one contract; only changed components adjust on edit; payment untouched unless payment changed.
- **Next:** Stop. Wait for approval. Then Phase 5 (Purchase Engine Rebuild).

---

## 7. Git commit hash

`c0b7099` — Phase 4: Sale engine rebuild - Shipping Income 4100, one contract, no blanket reversal
