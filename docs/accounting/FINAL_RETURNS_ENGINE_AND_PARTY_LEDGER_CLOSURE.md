# Final closure: returns engine, party AP/AR alignment, and Party Ledger

**Date:** 2026-04-11  
**Scope:** Purchase return → party payable + due + stock + GL; sale return → sale due + customer views; Party Ledger selection and read models; control vs party sub-ledger alignment.

---

## 1. Root causes (verified in code and live symptoms)

### 1.1 Party Ledger “empty” / unusable contact list

- **`contactService.getContacts` was missing** while `EffectivePartyLedgerPage` called it. Only `getAllContacts` existed, so the contact list failed to load and the party picker could not populate.
- **Stale `partyLedgerParams`:** Closing the ledger or opening **Party Ledger** from the sidebar did not clear navigation params, so a previous contact could remain “selected” while props no longer matched intent.
- **Props arriving after mount:** Opening from Contacts sets params in context; the page needed to **re-sync** when `contactId` / `contactType` props change and to **clear local selection** when params are explicitly cleared (sidebar “browse” mode).

**Fixes:** `getContacts` → alias of `getAllContacts`; Sidebar clears `partyLedgerParams` when navigating to `party-ledger`; App `onClose` clears params; `EffectivePartyLedgerPage` syncs/clears from props with a ref guard; `purchaseReturnsChanged` listener added for refresh after returns.

### 1.2 Purchase return did not move supplier-level payable (SATTAR / PUR-0002 class)

- **`recordPurchaseReturn`** could post the **debit** to resolved **control AP (2000)** instead of the **supplier party payable sub-account** when `debitAccountId` was not wired from `resolvePayablePostingAccountId`.
- **Operational due:** `recalc_purchase_payment_totals` historically used **gross** `purchases.total` vs paid, **ignoring finalized `purchase_returns`**, so `due_amount` / payment status could disagree with economic reality after a return.
- **Effective / operational ledgers:** `loadEffectivePartyLedger` and `getSupplierOperationalLedgerData` **did not include finalized purchase returns** as business rows, so the simple supplier statement could miss the return even when a control-level JE existed.

**Fixes:** `AccountingContext.recordPurchaseReturn` resolves party AP via `resolvePayablePostingAccountId` and uses `source: 'Purchase_Return'` for JE typing; migration **`20260441_recalc_purchase_payment_totals_include_returns.sql`** extends `recalc_purchase_payment_totals` and adds triggers on `purchase_returns`; **`purchaseReturnService`** calls `recalc_purchase_payment_totals` after finalize/void; **`effectivePartyLedgerService`** and **`ledgerDataAdapters`** add **Purchase Return** rows (debit AP / reduce payable in the same sign convention as payments).

### 1.3 Sale return and sale due (same engine class)

- **`recalc_sale_payment_totals`** did not subtract finalized **`sale_returns`** from the bill (analogous to purchases).

**Fixes:** Migration **`20260442_recalc_sale_payment_totals_include_returns.sql`** redefines `recalc_sale_payment_totals` with `v_returns` from `sale_returns` where `status = 'final'` and triggers on `sale_returns`; **`saleReturnService`** calls the RPC after finalize/void and dispatches **`ledgerUpdated`** for the customer so UI read models refresh.

### 1.4 Journal list mis-label (supplier payment edit chain as “Customer receipt”)

- **`payment_adjustment`** rows were presented like **manual receipts** when the **root payment** was actually **`reference_type = purchase`**.

**Fix:** `AccountingDashboard` / `journalRowPresentation` branches `payment_adjustment` on resolved root reference (purchase → **Supplier payment**, sale → **Customer receipt**, else neutral label). **`accountingService.getAllEntries`** enriches root reference for adjustments using `payment_id || reference_id` and normalizes `purchase_return` reference variants.

---

## 2. Tables and services touched (by concern)

| Concern | Tables | Functions / services |
|--------|--------|------------------------|
| Purchase due after return | `purchases`, `purchase_returns`, `payments`, `payment_allocations` | `recalc_purchase_payment_totals`, triggers in `20260441_*`, `purchaseReturnService` |
| Sale due after return | `sales`, `sale_returns`, `payments`, `payment_allocations` | `recalc_sale_payment_totals`, triggers in `20260442_*`, `saleReturnService` |
| Party AP JE | `journal_entries`, `journal_entry_lines`, `accounts` | `AccountingContext.recordPurchaseReturn`, `partySubledgerAccountService.resolvePayablePostingAccountId` |
| Stock | `stock_movements` | `purchaseReturnService` / `saleReturnService` + `productService.createStockMovement` |
| Effective party ledger | `purchase_returns`, `sale_returns`, `purchases`, `sales`, `payments`, `transaction_mutations` | `effectivePartyLedgerService.loadEffectivePartyLedger` |
| Supplier operational statement | `purchase_returns`, `purchases`, `payments` | `ledgerDataAdapters.getSupplierOperationalLedgerData` |
| Party Ledger UI | `contacts` | `contactService.getContacts`, `EffectivePartyLedgerPage`, `NavigationContext`, `Sidebar`, `App` |

---

## 3. Live SATTAR / PUR-0002 / JE-0096 class (what was wrong vs what to expect)

**Observed class of bug**

- JE for purchase return posted with **debit on control AP (2000)** while the supplier statement is on **Payable — PARTY** → **control and party slice diverge**.
- Supplier effective/operational views **omitted the return row** if they only read purchases + payments.

**After code + migration**

- New purchase returns: **debit party payable** when resolution succeeds; credit inventory (or configured expense) per `recordPurchaseReturn`.
- `purchases.due_amount` recomputes from **net bill** = `total − sum(final purchase_returns) − paid`.
- Effective and operational supplier ledgers **show a Purchase Return line** (debit, same direction as payment for running balance).

**One-time data repair (only if a historical JE still has wrong line account)**

If an old JE (e.g. JE-0096) still debits control AP instead of `Payable — SATTAR`:

1. Identify line ids and correct `account_id` on `journal_entry_lines` for the **payable debit** line (must match party AP account for that supplier).
2. Normalize `journal_entries.reference_type` to `purchase_return` if it was stored with a space (`purchase return`).
3. Run `select recalc_purchase_payment_totals('<purchase_uuid>');` after applying **`20260441`**.

Validation snippets (replace IDs):

```sql
-- Purchase net vs returns vs paid
select p.id, p.po_no, p.total, p.paid_amount, p.due_amount, p.payment_status,
  (select coalesce(sum(pr.total),0) from purchase_returns pr
   where pr.original_purchase_id = p.id and lower(trim(pr.status::text)) = 'final') as returns_final
from purchases p where p.po_no = 'PUR-0002';

-- Return header
select id, return_no, status, total, supplier_id, original_purchase_id
from purchase_returns where return_no like 'PRET-%' order by created_at desc limit 5;

-- JE lines for return (debit should be party AP, not only 2000 control if policy is party-first)
select jel.id, a.code, a.name, jel.debit, jel.credit
from journal_entry_lines jel
join accounts a on a.id = jel.account_id
where jel.journal_entry_id = (select id from journal_entries where entry_number = 'JE-0096' limit 1);
```

---

## 4. Standard rules implemented (purchase / sale)

### Purchase return (final)

- **Supplier payable (party):** reduced via **Dr party AP**, **Cr** inventory (or purchase expense path as configured).
- **Due / outstanding:** `due = max(0, (purchase.total − Σ final returns) − paid)`; `payment_status` from net bill vs paid.
- **Stock / valuation:** existing `purchase_return` / `purchase_return_void` movements unchanged; must stay aligned with JE.
- **Simple party ledger:** one **Purchase Return** row per finalized return (no PF-14).
- **Audit:** full GL + mutations remain in journal and `transaction_mutations` as before.

### Sale / POS return (final)

- **Sale due:** `max(0, (sale.total + studio_charges − Σ final sale_returns) − paid)` with same direct + `manual_receipt` allocation logic as before.
- **Customer effective ledger:** **Sale Return** row (credit, reduces receivable in the same convention as existing sale debit rows).
- **Refresh:** `ledgerUpdated` after finalize/void so dependent pages reload.

---

## 5. Rental / Studio (this pass)

- **Rental cancel / refund-style settlement:** not refactored in this change set. If rental posts only to control AR/AP without `resolveReceivablePostingAccountId` / `resolvePayablePostingAccountId`, it can reproduce the **same class** of divergence; treat as a **follow-up audit** using the same checklist as purchases (document → payment → JE lines → party account ids → operational RPC).
- **Studio reversals:** document for a future phase; same pattern: ensure party slice + control + `recalc_*` stay aligned.

---

## 6. Party Ledger — root cause summary

| Issue | Fix |
|-------|-----|
| Missing `getContacts` | `contactService.getContacts` → `getAllContacts` |
| Stale navigation params | `setPartyLedgerParams(null)` on sidebar Party Ledger + onClose |
| Props not applied when opening from Contacts | `useEffect` + `useRef` to apply/clear `initialContactId` |
| Returns missing in simple view | `effectivePartyLedgerService` loads `purchase_returns` / `sale_returns` |

---

## 7. Build and deploy

- **Local build:** `npm run build` — **passed** (2026-04-11).
- **Database:** Apply migrations in order (at minimum **`20260441`**, **`20260442`**) on Supabase / production before relying on new due math and triggers.
- **Deploy:** Use your standard pipeline (e.g. `git pull` + `deploy-erp-domain.sh` on **`ssh dincouture-vps`**) after merge; confirm frontend bundle and migration runner have both shipped.

---

## 8. Mandatory test checklist (post-migrate)

1. Purchase create → final  
2. Purchase payment  
3. Payment account change (PF-14 / adjustment JE)  
4. Payment amount edit  
5. Purchase return finalize → party statement + inventory + `purchases.due_amount`  
6–7. Supplier ledger effective + audit (GL / statements)  
8–9. Inventory statement + stock qty after return  
10–12. Sale, receipt, receipt edit  
13. Sale / POS return finalize  
14–15. Customer effective + audit  
16. Stock after sale return  
17–20. Party Ledger: sidebar, Contacts, manual supplier, manual customer  

---

## 9. Files changed in this closure (reference)

- `migrations/20260441_recalc_purchase_payment_totals_include_returns.sql`
- `migrations/20260442_recalc_sale_payment_totals_include_returns.sql`
- `src/app/services/contactService.ts` — `getContacts`
- `src/app/context/AccountingContext.tsx` — `recordPurchaseReturn`, `Purchase_Return` source
- `src/app/services/accountingService.ts` — enrichment / `purchase_return` / payment_adjustment root
- `src/app/components/accounting/AccountingDashboard.tsx` — journal row presentation
- `src/app/services/purchaseReturnService.ts` — `recalc_purchase_payment_totals` RPC after finalize/void
- `src/app/services/saleReturnService.ts` — RPC + `ledgerUpdated`
- `src/app/services/effectivePartyLedgerService.ts` — return rows
- `src/app/services/ledgerDataAdapters.ts` — supplier operational purchase returns
- `src/app/components/accounting/EffectivePartyLedgerPage.tsx` — props sync, listeners
- `src/app/components/layout/Sidebar.tsx` — clear params when opening Party Ledger
- `src/app/App.tsx` — clear params on close

This document is the **closure report** for the returns engine and Party Ledger workstream; keep it with other `docs/accounting/FINAL_*` runbooks.
