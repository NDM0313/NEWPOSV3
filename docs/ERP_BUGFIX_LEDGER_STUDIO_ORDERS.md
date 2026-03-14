# ERP Bugfix: Ledger Broken / studio_orders Reference

**Date:** 2026-03-13  
**Issue:** Day Book / Roznamcha showed data, but customer ledger (and possibly account ledger) was broken or empty. Console/API errors referenced `public.studio_orders`, which no longer exists (table dropped).

---

## Root cause

- The **customer ledger** API (`customerLedgerApi.ts`) still queried the dropped table **studio_orders** in several places:
  1. Opening balance: "studio orders before fromDate" (total_cost, advance_paid).
  2. Range totals: "studio orders in date range" (studioOrderDebit, studioOrderCredit).
  3. Transaction list: fetch studio_orders and push a "Studio Order" row per order.
  4. Second balance path: same "studio orders before fromDate" for prevStudioOrderNet.
- When the table does not exist, PostgREST/Supabase can return 404 or an error that was not always handled gracefully, causing the whole ledger response to fail or return empty.

---

## Fix

- **Removed all queries to `studio_orders`** from `src/app/services/customerLedgerApi.ts`.
- Replaced with constants (zero / empty) and short comments:
  - `prevStudioOrderNet = 0`
  - `studioOrderDebit = 0`, `studioOrderCredit = 0`
  - No transaction rows from studio_orders (removed the loop that pushed "Studio Order" entries).
- **Rationale:** Studio revenue is already represented in **sales**: sales with `is_studio = true` have `studio_charges` and are included in the ledger as "Studio Sale" with the full total (base + studio_charges). The legacy studio_orders table was redundant; no replacement query to studio_productions was added to avoid double-counting.

---

## Files changed

- `src/app/services/customerLedgerApi.ts`: removed four blocks that queried `studio_orders`; use zero/empty and comments only.

---

## Verification

- Open Customer Ledger (classic or modern) for a customer with sales/payments: data loads without 404 or "relation studio_orders does not exist".
- Day Book / Roznamcha unchanged.
- Studio sales continue to appear as Sales with documentType "Studio Sale" and correct totals (including studio_charges).

---

## Rollback

- Revert changes to `customerLedgerApi.ts`. If the studio_orders table is re-created and populated, the old queries would run again (not recommended; table was intentionally dropped).
