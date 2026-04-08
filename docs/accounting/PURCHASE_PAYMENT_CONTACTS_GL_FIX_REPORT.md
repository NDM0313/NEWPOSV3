# Purchase / supplier payment / contacts / journal display — fix report

**Date:** 2026-03-29  
**Stack:** Web app + live Postgres (`supabase-db` on VPS, `supabase_admin` for RPC replace)

## 1. Root causes

### A) Journal Entries “By document” amount = 0 (JE-0039, JE-0032, JE-0033)

`groupedDocumentDisplayAmount` in `AccountingDashboard.tsx` summed only `reference_type` in `{ purchase, purchase_adjustment }` when `primary.module === 'Purchases'`.  
`convertFromJournalEntry` mapped `manual_payment` → source `Purchase` → module `Purchases`, so Add Entry supplier payments were filtered **out** of the sum → **0**.

### B) Misleading type / module labels

Same mapping showed manual supplier payments as **Purchase** and grouped them under the Purchases module. Purchase-flow payments (`reference_type = purchase` + `payment_id`) were also labeled like purchase **principal**.

### C) KHURAM SILK −15,000 operational vs GL (560,060 vs 575,060)

Two issues:

1. **Double count in `get_contact_balances_summary`:** FIFO `applyManualSupplierPaymentAllocations` updates `purchases.paid_amount` / `due_amount` via `payment_allocations.purchase_id`, but the RPC still subtracted the **full** `manual_payment` row from contact payables → operational **15k below** party GL.

2. **Add Entry V2 posted Dr AP to generic account 2000** instead of `resolvePayablePostingAccountId` (party sub-account). Party GL (`get_contact_party_gl_balances`) reads the AP **subtree** with `linked_contact_id`; generic AP lines rely on resolver heuristics and **did not** move the 15k/20k into the same party slice as purchases until lines were corrected.

### D) DIN COUTURE drift (operational vs GL)

Same generic-AP posting for manual payments plus the **allocation double-subtract** until RPC fix. After re-pointing JE lines to party AP sub-accounts and deploying the new RPC, **DIN COUTURE** operational payables matched GL (440,000).

### E) Supplier operational statement opening row sign

`buildTransactionsWithOpeningBalance` treated **positive** opening as **debit** (customer AR convention). Supplier payables are liabilities: positive opening “we owe” belongs in the **credit** column for readability.

## 2. Bad layers

| Issue | Layer |
|--------|--------|
| Zero grouped amount | UI: `groupedDocumentDisplayAmount` + `convertFromJournalEntry` source/module |
| Wrong labels | UI: `journalRowPresentation` + context `sourceMap` |
| KHURAM variance | DB: `get_contact_balances_summary` subtract leg; posting: `addEntryV2Service` AP account id |
| Party GL vs purchases | Data: journal lines on generic AP (live SQL repair) |
| Opening sign | UI: `buildTransactionsWithOpeningBalance` + `GenericLedgerView` |

## 3. Files changed (repository)

| File | Change |
|------|--------|
| `migrations/20260431_get_contact_balances_allocated_manual_parity.sql` | RPC: exclude `manual_payment` / `manual_receipt` from subtract legs when a `payment_allocations` row exists (`purchase_id` / `sale_id`). |
| `src/app/services/addEntryV2Service.ts` | `resolvePayablePostingAccountId` for supplier payment JE; `dispatchContactBalancesRefresh(companyId)`. |
| `src/app/context/AccountingContext.tsx` | `manual_payment` → `Payment`; module `Payments` for payment source. |
| `src/app/components/accounting/AccountingDashboard.tsx` | `groupedDocumentDisplayAmount` for `Payments`; `journalRowPresentation` for supplier/customer payment vs purchase vs worker. |
| `src/app/services/customerLedgerTypes.ts` | `openingPerspective: 'payable' \| 'receivable'` on opening row builder. |
| `src/app/components/accounting/GenericLedgerView.tsx` | Supplier operational opening uses `payable` perspective; listen to `CONTACT_BALANCES_REFRESH_EVENT` (deduped). |

## 4. SQL run on live database

1. **`migrations/20260431_get_contact_balances_allocated_manual_parity.sql`** — `CREATE OR REPLACE` as `supabase_admin`.

2. **Journal line repair (party AP sub-accounts)** — re-point Dr AP on manual supplier payment JEs:

```sql
UPDATE journal_entry_lines SET account_id = 'ad2581ea-2ddb-409a-a28b-1d336975bb52'
WHERE id = 'e78e8cec-c34a-4fd5-960f-6c543728b879';

UPDATE journal_entry_lines SET account_id = '12f4a7ac-20e1-403d-b683-a0c7b725c2a7'
WHERE id IN ('b52b5bfb-019d-40d3-bf6a-5562eaad24fe','369cf26a-ebaf-4a37-8b21-27b15fff96b7');
```

(IDs: KHURAM 15k ADD ENTRY, DIN 20k + 30k manual payments — company `595c08c2-1e47-4581-89c9-1f78de51c613`.)

## 5. Before / after — KHURAM SILK & DIN COUTURE (live)

| Party | Metric | Before | After |
|--------|--------|--------|--------|
| KHURAM SILK | Operational payables (RPC) | 560,060 | **575,060** |
| KHURAM SILK | Party GL AP | 575,060 | 575,060 |
| DIN COUTURE | Operational payables | 420,000 | **440,000** |
| DIN COUTURE | Party GL AP | 440,000 | 440,000 |

## 6. Before / after — Journal list amounts (logic)

| Entry | Before (grouped amount) | After |
|--------|-------------------------|--------|
| JE-0039 (20k manual_payment) | 0 | **20,000** |
| JE-0032 (30k) | 0 | **30,000** |
| JE-0033 (15k) | 0 | **15,000** |

Type column: **Supplier payment** (sky badge) for `manual_payment` / `Payments` module; **Supplier payment** for `purchase` + `payment_id`; **Worker payment** for `worker_payment`.

## 7. Sign convention (supplier operational statement)

- **Payable opening:** positive = amount owed to supplier → shown in **Credit** column on the synthetic opening row; running balance unchanged (`runningBalance` still from `getSupplierOperationalLedgerData`).
- **Receivable / customer:** unchanged (positive opening → **Debit**).

## 8. Refresh / invalidation

- `createSupplierPaymentEntry` now calls `dispatchContactBalancesRefresh(companyId)` in addition to `accountingEntriesChanged` / `ledgerUpdated`.
- `GenericLedgerView` bumps GL/operational refresh on `CONTACT_BALANCES_REFRESH_EVENT`.

## 9. Remaining risk

- **Partial allocations:** If a single `manual_payment` is split between allocated (to a purchase) and truly unapplied portions, excluding the **entire** payment from the subtract leg when **any** `purchase_id` allocation exists could slightly overstate payables until allocation coverage is refined.
- **Receivables symmetric rule:** `manual_receipt` with `payment_allocations.sale_id` is excluded from the receipt subtract leg; confirm unallocated customer credit behavior matches finance policy.
- **Env:** RPC replace must run as function owner (`supabase_admin` on this host).

## 10. Terminal summary

```text
LIVE: 20260431 RPC — exclude allocated manual_payment/manual_receipt from contact subtract (fixes KHURAM/DIN op vs GL).
LIVE: Repointed 3 JE AP lines to party sub-accounts (KHURAM 15k, DIN 20k+30k).
REPO: Add Entry V2 uses resolvePayablePostingAccountId + dispatchContactBalancesRefresh.
REPO: Journal grouped amount + Payment module + labels; supplier opening row credit-side positive payable.
BUILD: npm run build — OK.
```
