# RESULT — Accounting Integrity Test Lab

See the full deliverable: **[ACCOUNTING_INTEGRITY_LAB_RESULT.md](./ACCOUNTING_INTEGRITY_LAB_RESULT.md)** (Phase 2 + tooling: payables status filter, **purchase by-id / getPurchase 400**, **`CustomerLedgerInteractiveTest` lazy**, snapshot timestamps/outcome).

## 2026-03-12 — Hard posting-status gate (sales + purchases)

### Root causes

1. **Sales:** Stock, document JE, payment JEs, PF-14 repost, and negative-stock checks keyed off **`type === 'invoice'`** (and/or loose “final” heuristics), so a **draft/quotation/order** could still behave like a posted invoice if `type` was invoice.
2. **Purchases:** **Supplier ledger**, discount ledger, **initial `recordPayment`**, and **accounting `recordSupplierPayment`** ran on **every create**, including **draft/ordered**.
3. **Cancel:** **Sale** and **purchase** cancel paths always attempted **stock reversals** (and sale **accounting reversal**) even when the document had **never** been in a posted state (`final` / `received` for purchases).
4. **Sale `recordPayment`:** Allowed any non-cancelled sale; **not** restricted to **`status === 'final'`** (aligned with purchase).

### Rules (canonical)

- **Shared helpers:** `src/app/lib/postingStatusGate.ts` — `canPostAccountingForSaleStatus`, `canPostStockForSaleStatus`, `canPostAccountingForPurchaseStatus`, `canPostStockForPurchaseStatus`, `wasSalePostedForReversal`, `wasPurchasePostedForReversal`, `normalizePurchaseStatusForPosting` (maps app `completed` → `final`).
- **Sales:** Only **`final`** posts GL/stock/payment postings.
- **Purchases:** **`final`** or **`received`** (and app **`completed`** ≡ final) post GL/stock/payment postings.
- **DB triggers:** Existing `sale_final_stock_movement_trigger` / `purchase_final_stock_movement_trigger` already fire only on **`final`** — **no SQL change** in this slice (app + lab only).

### Files changed

- `src/app/lib/postingStatusGate.ts` — purchase status normalization.
- `src/app/services/saleAccountingService.ts` — document JE guard uses gate.
- `src/app/services/saleService.ts` — cancel / `recordPayment` / stock check on create / status update guards.
- `src/app/services/purchaseService.ts` — cancel stock guard; `recordPayment` uses gate.
- `src/app/context/SalesContext.tsx` — create/update: stock, JE, payments, PF-14, negative stock, order→final.
- `src/app/context/PurchaseContext.tsx` — create: JE/ledger/payments; update: stock deltas + accounting pass; `recordPayment` check.
- `src/app/services/accountingIntegrityLabService.ts` — `runPostingStatusGateLiveCheck`, `runPostingStatusGateFreshCheck` (wired into **Live** + **Fresh** runs).

### Integrity Lab

- **Live:** Sample `draft`/`quotation`/`order` sales and `draft`/`ordered` purchases — must have **no** active `reference_type=sale|purchase` JEs (and **no** `sale_reversal` for those sales), and **no** `stock_movements` for those document refs.
- **Fresh (selected doc):** Same rules scoped to the chosen sale/purchase; **posted** docs: warn/fail on **0** or **>1** active document JE when `total > 0`.

### Git commit hash

`9b8b251` — `fix(posting): hard status gate for sales/purchases GL stock payments`

## 2026-03-12 — Accounting engine hygiene (draft guard, 409, legacy triggers)

- **Code:** `saleAccountingService` requires DB `sales.status === 'final'` before document JE; `SalesContext` removed duplicate JE path + discount RPC (single Phase-4 service); `PurchaseContext` duplicate JE guard; `accountingService.createEntry` idempotent on duplicate sale/fingerprint.
- **SQL:** `migrations/20260312_disable_legacy_auto_post_contact_triggers.sql` (+ prior stock migration for `movement_type`).
- **Doc:** `docs/accounting/LEGACY_TRIGGER_AUDIT.md`.
- **Commit:** `6a7674b` (`fix(accounting): final-only sale/purchase JEs, dedupe inserts, drop legacy auto-post triggers`).

## Latest integrity outcome (unbalanced JE repair)

- Root cause JEs: `dc2fd0f9-dd66-4e52-876c-bad2021bcfe7` (diff 3000) and `4bce1498-bae8-40d8-9eb5-a3aca8d0239f` (diff 10000), both legacy EXP sale vouchers with debit-only lines.
- Live-data repair: `migrations/20260320_void_legacy_unbalanced_exp_sale_je.sql` (targeted void, no delete, traceable reason).
- Post-repair: unbalanced JEs `0`, Trial Balance diff `0.00`.
- Remaining (separate phase): BS diff `283800`, AR diff `203400`, AP diff `-865770`, payment-link gap `1` row.

## Git commit hash

Run after pulling:

```bash
git log -1 --oneline
```
