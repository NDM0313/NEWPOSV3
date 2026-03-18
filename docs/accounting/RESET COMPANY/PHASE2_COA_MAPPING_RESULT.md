# Phase 2 — COA Cleanup and Mapping Lock: RESULT

**Date:** 2025-03-18  
**Plan reference:** `ACCOUNTING_PHASE_PLAN_AND_PROMPTS.md` — Phase 2  
**Status:** Complete (awaiting approval before Phase 3)

---

## 1. Root cause

Component-to-GL mapping was **inconsistent and duplicated** across the codebase:

- **Supplier payable:** saleAccountingService used **2020** for extra-expense credit while rest of app uses **2000**. Two AP-like accounts caused confusion and wrong posting.
- **Inventory:** Sale/COGS side used **1200**; purchase side used **1500** or name-only. One inventory asset account is required for consistent balance sheet and COGS.
- **5100:** Used for both **Shipping Expense** (shipment) and **Sales Commission Expense** (commission). One code, two meanings.
- No single document or code constant defined canonical codes, so new code could introduce more drift.

Phase 2 locks one mapping matrix and aligns code to it **without destructive DB cleanup**.

---

## 2. Final COA mapping matrix

See **`docs/accounting/COA_MAPPING_MATRIX.md`** for the full matrix. Summary:

| Component | Code | Account name |
|-----------|------|---------------|
| Sale revenue | 4000 | Sales Revenue |
| Accounts receivable | 1100 | Accounts Receivable |
| Sales discount | 5200 | Discount Allowed |
| Shipping income | 4100 | Shipping Income |
| Sale extra expense | 5300 | Extra Expense (Cr: 1000 or 2000) |
| Inventory | **1200** | Inventory |
| COGS | 5000 | Cost of Production |
| Supplier payable | **2000** | Accounts Payable |
| Purchase discount | 5210 (or name) | Discount Received |
| Purchase freight/labor/extra | 1200 + 2000 | Inventory + AP |
| Cash / Bank | 1000 / 1010 | Cash / Bank |
| Courier payable | 203x | Per-courier |
| Worker payable | 2010 | Worker Payable |
| Shipping expense | 5100 | Shipping Expense |
| Sales commission expense | **5110** (preferred) / 5100 | Sales Commission Expense |
| Salesman payable | 2040 | Salesman Payable |

---

## 3. Duplicate / conflict list

| Item | Resolution |
|------|------------|
| **2020 vs 2000** | 2020 = legacy/duplicate. Code now uses **2000** only for supplier payable and sale extra expense credit. |
| **Inventory 1200 vs 1500** | **1200** = canonical. Purchase flows prefer 1200, then 1500, then name. 1500-only = legacy when 1200 exists. |
| **5100 dual use** | **5100** = Shipping Expense only. Commission uses **5110** when present, else 5100 fallback. |
| **chartAccountService default 5100** | Default set creates 5100 as "Cost of Goods Sold"; correct COGS = 5000. Documented; no DB change. |

---

## 4. Files changed

| File | Change |
|------|--------|
| `docs/accounting/COA_MAPPING_MATRIX.md` | **New.** Full matrix, duplicate list, usage rules. |
| `src/app/config/coaMapping.ts` | **New.** Canonical codes constant (Phase 2 lock). |
| `src/app/services/saleAccountingService.ts` | ensureAPAccount: 2020 → **2000**; comments updated. |
| `src/app/services/purchaseAccountingService.ts` | Inventory: prefer **1200** then 1500 then name. |
| `src/app/context/PurchaseContext.tsx` | Inventory: same 1200/1500/name preference. |
| `src/app/services/shipmentAccountingService.ts` | Comment fix: AR = 1100 (was 2000 in comment). |
| `src/app/services/commissionReportService.ts` | Commission expense: try **5110** then 5100. |
| `src/app/services/accountingReportsService.ts` | P&L: add **5110** to COST_OF_PRODUCTION_CODES. |

---

## 5. SQL used

**None.** No migrations, no destructive DB cleanup, no live data changes. Phase 2 is mapping lock and code alignment only.

---

## 6. Verification

- **Supplier payable:** saleAccountingService and addEntryV2/supplierPaymentService all use **2000** (saleAccountingService fixed from 2020).
- **Inventory:** purchaseAccountingService and PurchaseContext resolve inventory by 1200 → 1500 → name; saleAccountingService and studio already use 1200.
- **Commission:** commissionReportService uses 5110 when present, else 5100; 5100 remains Shipping Expense in shipmentAccountingService.
- **Docs:** COA_MAPPING_MATRIX.md and coaMapping.ts provide single reference for canonical codes.

---

## 7. Summary

- **Goal:** Lock all component mappings to one GL contract; identify duplicate/conflicting accounts.
- **Deliverables:** COA_MAPPING_MATRIX.md, coaMapping.ts, and mapping-only code fixes (2000 for AP, 1200 for inventory, 5110/5100 for commission).
- **Acceptance:** Every listed business component maps to one explicit GL rule; duplicate/legacy accounts documented; no destructive DB work.
- **Next:** Stop. Wait for approval. Then Phase 3 (Payment Isolation Engine).

---

## 8. Git commit hash

*(To be filled after commit.)*
