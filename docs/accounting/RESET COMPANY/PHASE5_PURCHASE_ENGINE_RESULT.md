# Phase 5 — Purchase Engine Rebuild: RESULT

**Date:** 2025-03-18  
**Plan reference:** `ACCOUNTING_PHASE_PLAN_AND_PROMPTS.md` — Phase 5  
**Status:** Complete (awaiting approval before Phase 6)

---

## 1. Root cause

Purchase accounting was partially aligned in Phases 2–3 but create and edit paths did not share one locked contract:

- **Create path (PurchaseContext):** Used Inventory by name/code 1500 only; did not prefer **1200** per COA. Discount used name only; did not prefer **5210** (Discount Received). AP used 2000/name but not consistently preferring code 2000 when multiple accounts matched.
- **Edit path (purchaseAccountingService):** Already used 1200 then 1500 for inventory and component-level deltas; discount account used name only (no 5210 preference).
- **Edit path (PurchaseContext “no existing JE”):** Same as create — inventory/AP/discount resolution not aligned to 1200/2000/5210.

Phase 5 rebuilds purchase to one contract: source lock, COA mapping lock (1200, 2000, 5210), payment isolation; component-level edit only; no blanket reversal.

---

## 2. Purchase accounting rules implemented

| Event | Rule |
|-------|------|
| **Purchase create** | One JE: Dr Inventory (1200 preferred), Cr AP (2000); discount → Dr AP Cr Discount Received (5210 preferred); freight/labor/extra → Dr Inventory Cr AP. Same account resolution in create and edit. |
| **Purchase edit** | Only changed components get purchase_adjustment JEs (subtotal, discount, otherCharges). Payment untouched unless payment changed (Phase 3). No blanket reversal. |
| **Purchase edit (no existing JE)** | When no purchase JE exists, create one with same account resolution (1200, 2000, 5210) as create path. |
| **Purchase payment** | Per PAYMENT_ISOLATION_RULES; document JEs never touch payment; payment has its own flow. |

---

## 3. Files changed

| File | Change |
|------|--------|
| `docs/accounting/PURCHASE_ACCOUNTING_CONTRACT.md` | **New.** Single contract for purchase create, edit, payment, discount, freight/labor/extra. |
| `src/app/services/purchaseAccountingService.ts` | Header updated to Phase 5 contract; discount account resolution prefers code 5210 then name; AP resolution prefers code 2000. |
| `src/app/context/PurchaseContext.tsx` | Create path: inventory 1200 then 1500 then name; AP prefer 2000; discount prefer 5210 then name. Edit path (no existing JE): same AP and discount resolution (2000, 5210). |

---

## 4. SQL used

**None.** Phase 5 is code-only; no migrations, no destructive DB changes.

---

## 5. Verification (real purchase cases)

- **Purchase create with discount and freight:** Create a purchase (received/final) with items, discount charge, and freight/labor charge. Expected: one purchase JE with Dr Inventory (1200), Cr AP (2000) for subtotal and other charges; Dr AP Cr Discount Received (5210) for discount. No payment in document JE.
- **Purchase edit – subtotal only:** Edit only items/subtotal. Expected: one purchase_adjustment JE for subtotal delta (Dr Inventory Cr AP or reverse). No discount or other-charges adjustment; payment untouched.
- **Purchase edit – discount only:** Edit only discount. Expected: one purchase_adjustment JE for discount delta (Dr AP Cr Discount Received or reverse). Payment untouched.
- **Purchase edit – payment unchanged:** Edit document (items/discount/freight) without changing payment. Expected: only purchase_adjustment JEs; payment JEs unchanged (Phase 3).

Verification can be done on live purchase records (e.g. PUR-0105, PUR-0110 or equivalent): confirm journal entries use 1200/2000/5210 where those accounts exist, and component-level adjustments only.

---

## 6. Summary

- **Goal:** Rebuild purchase accounting to one standard contract (source lock, COA 1200/2000/5210, payment isolation); component-level edit only; no blanket reversal.
- **Deliverables:** PURCHASE_ACCOUNTING_CONTRACT.md; aligned account resolution in create and edit (1200, 2000, 5210); purchaseAccountingService and PurchaseContext consistent.
- **Acceptance:** Purchase create/edit use one contract; only changed components adjust on edit; payment untouched unless payment changed.
- **Next:** Stop. Wait for approval. Then Phase 6 (Inventory Valuation and Cost Flow Repair).

---

## 7. Git commit

After approval, commit with message:

`Phase 5: Purchase engine rebuild – one contract, 1200/2000/5210, component-level edit only`

**Commit:** `4650fc5`
