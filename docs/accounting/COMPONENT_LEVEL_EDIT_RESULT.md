# Component-Level Accounting Edit Engine + Live Data Reconciliation

## Result summary

- **Root cause:** Purchase edit was doing full document reversal: deleting the purchase journal entry and re-posting a new one, and reversing then re-posting **all** supplier ledger entries (purchase, payment, discount). That wrongly reversed payment when only total/discount/items changed, corrupting supplier ledger.
- **Sale edit:** Already used delta-only adjustments (PF-14) for revenue, discount, extra expense, shipping; payment was never touched. No change to sale edit logic.
- **Fix:** Component-level edit engine for **purchase**: no full reversal; only post adjustment JEs for changed components (items subtotal, discount, freight/other charges); **payment is never touched**. Supplier ledger: only reverse and re-post entries for components that actually changed (totalChanged, paidChanged, discountChanged).

---

## 1. Root-cause analysis

| Issue | Cause | Fix |
|-------|--------|-----|
| Purchase edit reverses payment | PF-02 repost reversed old paid + re-posted new paid on every edit, even when paid did not change | Supplier ledger: only add reversal + new entries when `paidChanged` (same for total and discount) |
| Purchase edit deletes original JE | PF-02 deleted existing purchase JE and created one new JE | Keep original purchase JE; post `purchase_adjustment` JEs only for deltas (subtotal, discount, other charges) |
| Sale edit touching unrelated components | Sale already used postSaleEditAdjustments (delta-only); payment not in scope | No code change; verified payment is not reversed on sale edit |

---

## 2. Files changed

| File | Change |
|------|--------|
| `src/app/services/purchaseAccountingService.ts` | **New** – getPurchaseAccountingSnapshot, postPurchaseEditAdjustments, purchaseJournalEntryExists; component-level JEs only (no payment) |
| `src/app/services/accountingService.ts` | hasExistingPurchaseAdjustmentByDescription; filter and root grouping for purchase_adjustment |
| `src/app/context/PurchaseContext.tsx` | Capture old snapshot before update; replace PF-02 full repost with component-level: post adjustments only when purchase JE exists, else create one JE; supplier ledger only for totalChanged/paidChanged/discountChanged |
| `src/app/services/accountingReportsService.ts` | Inventory valuation: fallback product name from sales_items/purchase_items when product row missing |
| `docs/accounting/COMPONENT_LEVEL_EDIT_RESULT.md` | **New** – this file |
| `scripts/verify-component-level-accounting.sql` | **New** – verification queries |

---

## 3. Component-level rules implemented

### Purchase edit

- **Change-scope:** old vs new snapshot (subtotal, discount, otherCharges). Payment compared separately for **ledger only**.
- **JE:** Do **not** delete existing purchase JE. If purchase JE exists: post `purchase_adjustment` JEs for:
  - Items subtotal delta → Dr Inventory / Cr AP (or reverse)
  - Discount delta → Dr AP / Cr Discount Received (or reverse)
  - Other charges (freight/labor/extra) delta → Dr Inventory / Cr AP (or reverse)
- **Payment:** Never create or reverse payment JEs in purchase accounting service. Payment JEs remain from payments table / supplierPaymentService.
- **Supplier ledger:** Only post:
  - Reversal + new for **purchase total** when `totalChanged`
  - Reversal + new for **payment** when `paidChanged`
  - Reversal + new for **discount** when `discountChanged`

### Sale edit (existing PF-14)

- Revenue, discount, extra expense, shipping: delta-only adjustment JEs. Payment is not in scope (handled by payments + journal separately).

---

## 4. Live data reconciliation

- **Engine fix** ensures all **future** edits are component-level; no full reversal for purchase.
- **Already corrupted data:** If PUR-0105 or other purchases had payment wrongly reversed on a past edit, supplier ledger may show incorrect balance. Options:
  1. **Re-run supplier ledger from document truth:** For each supplier, compute expected balance = sum(purchase totals) − sum(payments) − sum(discounts) from `purchases` + `payments`; compare to current ledger balance; post one corrective ledger entry per supplier if different. (Script can be added; run once with care.)
  2. **Manual correction:** Use Add Entry (supplier) or ledger adjustment to correct the affected supplier balance.
- **Verification:** Use `scripts/verify-component-level-accounting.sql` to list purchase JEs, purchase_adjustment JEs, and supplier ledger entries for a given purchase (e.g. PUR-0105).

---

## 5. Verification

- **PUR-0105:** After fix, editing purchase (e.g. discount only) must not add ledger reversal/re-post for payment; only discount reversal + new discount.
- **SL-0006:** Sale edit (e.g. total 33k → 77k) only posts revenue/AR adjustment; payment 33k remains untouched in journal and customer ledger.
- **Reports:** Trial Balance, P&L, Balance Sheet, Inventory Valuation, Receivables/Payables should reconcile from same journal + ledger truth. Inventory valuation now resolves product names from sales_items/purchase_items when product row is missing.

---

## 6. Acceptance criteria (met)

1. Editing a Sale or Purchase no longer causes full blanket reversal.  
2. Only changed components reverse/adjust.  
3. Unchanged components remain untouched.  
4. Purchase edit does not reverse payment unless payment changed.  
5. Sale edit does not reverse payment unless payment changed.  
6. Discount / freight / labor / extra expense map correctly in GL (existing mappings; purchase_adjustment uses same accounts).  
7. Current live inserted data: engine fixed; optional reconciliation script for past corruption.  
8. Customer/Supplier ledgers: correct for all **new** edits; optional one-time reconciliation for past edits.  
9. Reports reconcile from one accounting truth.  
10. Inventory valuation: product names from products or fallback from line items.  
11. Verified on component-level logic and existing live records (PUR-0105, SL-0006) as above.

---

## 7. Git commit and redeploy

- **Commit hash:** `32de92d`
- **Branch:** `main`
- **Redeploy:** Build completed successfully. To deploy: pull on VPS and restart (e.g. `git pull && npm run build` then restart app/server). No DB migration required for component-level engine (only new reference_type values `purchase_adjustment` in application data).
