# RESULT — Accounting Integrity Test Lab

See the full deliverable: **[ACCOUNTING_INTEGRITY_LAB_RESULT.md](./ACCOUNTING_INTEGRITY_LAB_RESULT.md)** (Phase 2 + tooling: payables status filter, **purchase by-id / getPurchase 400**, **`CustomerLedgerInteractiveTest` lazy**, snapshot timestamps/outcome).

## 2026-03-12 — Live `converted` columns + PostgREST 400 fix (production)

### Root cause

- **`sales.converted` / `purchases.converted` were missing on live Postgres** (`supabase-db` on VPS). Migration `20260320_sales_purchases_conversion_workflow.sql` had not been fully applied; PostgREST returned **HTTP 400** for `converted=eq.false`.
- **`handle_sale_final_stock_movement`** is owned by **`supabase_admin`** on self-hosted Supabase; `CREATE OR REPLACE` as `postgres` failed with *must be owner*. Function/trigger body updated separately via `20260321_handle_sale_final_stock_movement_supabase_admin.sql`.

### Migrations applied (live)

| File | Role |
|------|------|
| `migrations/20260320_sales_purchases_conversion_workflow.sql` | `postgres` (columns, indexes, FKs; function step failed — see above) |
| `migrations/20260321_handle_sale_final_stock_movement_supabase_admin.sql` | `supabase_admin` |
| `migrations/20260322_app_document_conversion_schema_rpc.sql` | `postgres` — RPC `app_document_conversion_schema()` for client capability flags |

**Audit note:** [LIVE_SCHEMA_AUDIT_20260312_CONVERSION.md](./LIVE_SCHEMA_AUDIT_20260312_CONVERSION.md)

### App changes (no weakening of posting gate)

- **`src/app/lib/documentStatusConstants.ts`** — canonical `SALE_BUSINESS_ONLY_STATUSES`, `PURCHASE_BUSINESS_ONLY_STATUSES`, posted sets (used by lab + services + `postingStatusGate`).
- **`src/app/lib/documentConversionSchema.ts`** — cached `getDocumentConversionSchemaFlags()` via RPC (avoids repeated failing `converted` filters when schema lags).
- **`saleService` / `purchaseService` / `accountingIntegrityLabService`** — apply `.eq('converted', false)` only when flags say the column exists; narrow retry if still error.
- **`postingStatusGate.ts`** — uses constants for posted status checks (**unchanged rules**: sale **final** only; purchase **final** \| **received**).

### Status enums (live)

- **Matched** canonical design; no `status=in.(…)` change required beyond centralizing constants.

### Verification

- Re-run **Accounting Integrity Lab** → **Live** posting gate: expect **no 400 spam**; sample non-posted docs still checked (with `converted` filter when present).
- `git log -1 --oneline` after push for current commit hash.

---

## 2026-03-12 — Canonical conversion workflow (sales + purchases)

### Business rule

- **Draft / quotation / order** (sales) and **draft / ordered** (purchases) stay **business-only** until the user **converts** to a **new** final document.
- **Convert** = **new row** with **new final number** (`SL-…` via `get_next_document_number_global`, `PUR-…` via `generate_document_number`), **copy** of latest header/lines/charges from the form, **posting only on the new row**. Source row: `converted = true`, `converted_to_document_id = new id`, **not deleted**.
- **Default lists** exclude `converted = true` (archived sources hidden). Direct open by id still works for audit.
- **Cancel** unchanged from posting gate: non-posted sources never get reversal JE/stock (already enforced).

### Numbering

| Document kind | Sequence / RPC |
|----------------|------------------|
| Draft | `DRAFT` (global) |
| Quotation | `QT` |
| Order | `SO` |
| Final sale | `SL` |
| Final purchase | `PUR` (`generate_document_number` / `purchase` type) |

### Exact conversion flow

**Sales**

1. User uses **Convert to Final** (`SaleForm` + `SalesContext.createSale(saleData, { conversionSourceId })`).
2. `documentNumberService.getNextDocumentNumberGlobal(companyId, 'SL')` assigns the new invoice number.
3. `saleService.createSale` inserts **new** `sales` row (`status=final`, `type=invoice`) + line items; then updates source: `converted=true`, `converted_to_document_id=newId`.
4. `replaceSaleCharges`, payments, document JE, and stock: same post-create path as a normal new final sale; **stock**: DB trigger on **INSERT** final + app loop **skipped** if movements already exist (no double post).

**Purchases**

1. User edits a **draft/ordered** PO, sets status **Final**, saves.
2. `PurchaseForm` calls `createPurchase(purchaseData, undefined, { conversionSourceId })`.
3. `purchaseService.createPurchase` inserts new **final** PO + items + charges; marks source converted.
4. Same **PurchaseContext** post-create path as a normal create (JE, supplier ledger, optional `recordPayment`).

### Files changed (this slice)

- `migrations/20260320_sales_purchases_conversion_workflow.sql` — `converted`, `converted_to_document_id` on `sales`/`purchases`; sale stock trigger **INSERT OR UPDATE** for `final`.
- `src/app/services/saleService.ts` — `conversionSourceId` on `createSale`; `getAllSales` / `getStudioSales` hide converted (with column fallback).
- `src/app/services/purchaseService.ts` — `CreatePurchaseOptions`, conversion mark; `getAllPurchases` hide converted.
- `src/app/context/SalesContext.tsx` — `createSale(..., convOpts)`; conversion numbering; local list drops source; stock skip if trigger ran; `convertQuotationToInvoice` uses same path.
- `src/app/context/PurchaseContext.tsx` — `createPurchase` third arg; toasts/state for conversion.
- `src/app/components/sales/SaleForm.tsx` — convert uses **create** path + `conversionSourceId`.
- `src/app/components/purchases/PurchaseForm.tsx` — draft/ordered → final uses **createPurchase** with conversion.
- `src/app/services/accountingIntegrityLabService.ts` — posting-gate live sample excludes `converted` sources.

### Git commit hash

`2bcb1c1` — `feat(conversion): new final doc + archive source for sales/purchases`

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

`a73c0e0` — `fix(posting): hard status gate for sales/purchases GL stock payments`

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
