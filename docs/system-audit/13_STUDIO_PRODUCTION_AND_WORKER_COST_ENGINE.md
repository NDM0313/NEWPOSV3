# 13 — Studio Production and Worker Cost Engine

**Last updated:** 2026-04-12
**Stack:** Next.js + Supabase (multi-tenant)
**Active version:** V3 (production) — V1 and V2 tables still exist in DB
**Primary services:** `studioProductionV3Service.ts`, `studioCostsService.ts`, `workerPaymentService.ts`

---

## Business Purpose

Fashion photography and garment production order management. A studio order represents a customer commission for a garment (dress, outfit) that is manufactured through a series of production stages (dyeing, stitching, handwork, embroidery, finishing). Workers are assigned to stages and paid per stage completion. The system tracks:
- Production progress (stages and their status)
- Production cost (sum of per-stage worker costs)
- Customer invoicing (sale invoice generated from completed production)
- Worker payment ledger (advances, stage payments, reconciliation against AP)

---

## UI Entry Points

| View / Route | Purpose |
|---|---|
| `studio` | Main studio landing; shows V1/legacy studio orders |
| `studio-dashboard-new` | New dashboard; V3-aware pipeline and cost summary |
| `studio-pipeline` | Kanban/pipeline view of production orders by stage |
| `studio-order-detail-v3` | Detail page for a V3 production order; stage management, cost entry, customer invoice generation |

---

## Frontend Files

```
src/app/services/studioProductionV3Service.ts          — V3 order/stage CRUD, cost recalculation
src/app/services/studioProductionV2Service.ts          — V2 order/stage/assignment/receipt CRUD
src/app/services/studioProductionService.ts            — V1/legacy + shared JE creation functions
src/app/services/studioCostsService.ts                 — Aggregated cost summaries (journal-first, ledger fallback)
src/app/services/studioCustomerInvoiceService.ts       — Customer sale invoice from completed V2 order
src/app/services/studioProductionV3InvoiceService.ts   — Invoice service for V3 orders
src/app/services/studioProductionInvoiceSyncService.ts — Invoice sync utility
src/app/services/workerPaymentService.ts               — Canonical worker payment (PAY-xxxx, JE, ledger)
src/app/services/workerAdvanceService.ts               — Worker advance account resolution (account 1180)
src/app/services/studioService.ts                      — V1 legacy studio_orders table service
```

---

## Backend Services

### `studioProductionV3Service.ts`
V3-only; touches only `studio_production_orders_v3` and `studio_production_stages_v3` and `studio_production_cost_breakdown_v3`. Explicitly does not modify V1 or V2 tables.

Key functions:
- `getOrdersByCompany(companyId, branchId)` — full list
- `getOrdersByCompanyPage(companyId, branchId, opts)` — paginated (default limit 100, max 500)
- `getStagesByOrderIds(orderIds)` — batch fetch, returns `Map<orderId, stages[]>`
- `createOrder(params)` — inserts with `status = 'draft'`, `production_cost = 0`
- `updateOrder(orderId, updates)` — patches allowed fields; includes `status`, `production_cost`, `profit_percent`, `profit_amount`, `final_price`, `generated_invoice_id`
- `createStage(orderId, stageName, sortOrder)` — inserts with `status = 'pending'`, costs 0
- `updateStage(stageId, updates)` — patches `worker_id`, `expected_cost`, `actual_cost`, `status`
- `assignWorker(stageId, workerId, expectedCost)` — sets `status = 'assigned'`
- `completeStage(stageId, actualCost)` — sets `actual_cost`, `status = 'completed'`
- `recalculateProductionCost(orderId)` — sums all stages' `actual_cost`; writes to `production_cost` on order
- `saveCostBreakdown(orderId, rows)` — delete-and-replace on `studio_production_cost_breakdown_v3`
- `getDefaultStageNames()` — returns `['Dyeing', 'Stitching', 'Handwork', 'Embroidery', 'Finishing']`

Top-level utility function:
- `ensureStudioProductionV3OrdersForCompany(companyId, branchId)` — idempotent backfill; finds all `STD-*` sales without a V3 order and creates one with default stages

### `studioCostsService.ts`
Aggregated cost reporting; journal-first with legacy fallback.

Key functions:
- `getStudioCostsSummary(companyId, branchId)` — returns `StudioCostsSummary`
- `getWorkerCostSummaries(companyId, branchId)` — returns `WorkerCostSummary[]` (one per worker)
- `getProductionCostSummaries(companyId, branchId)` — returns `ProductionCostSummary[]` per order; reads from `studio_productions` (V1/V2 shared table) and `studio_production_stages`
- `getStudioCostsFromJournal(companyId, branchId)` — primary; reads `journal_entry_lines` for accounts `5000` and `2010`
- `_getStudioCostsSummaryLegacy(companyId, branchId)` — fallback; reads `worker_ledger_entries`
- `_getWorkerCostSummariesLegacy(companyId, branchId)` — fallback worker breakdown from ledger

### `workerPaymentService.ts`
Canonical payment path (Phase-2 standard). Single function:
- `createWorkerPayment(params)` → `CreateWorkerPaymentResult { paymentId, journalEntryId, referenceNumber }`

Steps: document number (`PAY-xxxx`) → `payments` row → journal entry → `worker_ledger_entries` row.

### `studioCustomerInvoiceService.ts`
Generates customer sale invoice from a **completed V2 order**. Key functions:
- `getProductionCostSummary(orderId)` — sums stage receipt `actual_cost` fields
- `generateCustomerInvoiceFromProduction(params)` — creates a `sale` row (source = `studio_production`), posts accounting entry
- `createProductFromProductionOrder(params)` — creates a `product` (type = `production`, SKU = `STD-PROD-xxxx`), adds stock movement, posts finished-goods JE

---

## Studio Version History

### V1 — Legacy (studioService.ts)
**Tables:** `studio_orders`, `studio_order_items`, `job_cards`, `workers`
**Status values:** `pending` | `in_progress` | `completed` | `cancelled`
**Stage types:** `cutting`, `stitching`, `finishing`, `embroidery` (from `job_cards.task_type`)
**Worker types:** `tailor`, `cutter`, `finisher`, `embroidery`
**Payment type:** `per_piece` | `daily` | `monthly`
**Notes:** Table-not-found errors are silently swallowed (`PGRST205`). `job_cards` join is also optional — falls back gracefully if table missing. V1 is effectively abandoned.

### V2 — Mid-generation (studioProductionV2Service.ts)
**Tables:** `studio_production_orders_v2`, `studio_production_stages_v2`, `studio_stage_assignments_v2`, `studio_stage_receipts_v2`
**Status values (order):** `draft` | `in_progress` | `completed` | `cancelled`
**Status values (stage):** `pending` | `assigned` | `in_progress` | `completed`
**Stage types:** `dyer` | `stitching` | `handwork` | `embroidery` | `finishing` | `quality_check`
**Key difference from V1:** Assignments and receipts are separate tables; `actual_cost` lives in `studio_stage_receipts_v2`. Customer invoice is generated via `studioCustomerInvoiceService.ts` (V2-specific).
**Still active for:** `studioCustomerInvoiceService` explicitly calls `studioProductionV2Service`; cost summaries in `studioCostsService.getProductionCostSummaries()` still read from `studio_productions` and `studio_production_stages` (a shared/V2 table naming convention).

### V3 — Current Production (studioProductionV3Service.ts)
**Tables:** `studio_production_orders_v3`, `studio_production_stages_v3`, `studio_production_cost_breakdown_v3`
**Status values (order):** `draft` | `in_progress` | `completed` | `cancelled`
**Status values (stage):** `pending` | `assigned` | `in_progress` | `completed`
**Stage names:** Free-form strings (not a fixed enum); defaults are `['Dyeing', 'Stitching', 'Handwork', 'Embroidery', 'Finishing']`
**Key difference from V2:** Stage has `worker_id` and `expected_cost` / `actual_cost` directly on the stage row (no separate assignment/receipt tables). Cost breakdown is stored in `studio_production_cost_breakdown_v3`. Order has `profit_percent`, `profit_amount`, `final_price` for margin tracking. Orders are linked to `sales` via `sale_id` (same as V2).
**Backfill function:** `ensureStudioProductionV3OrdersForCompany` creates V3 orders for any `STD-*` sale that lacks one.

---

## DB Tables (per version)

### V3 (active)
| Table | Key Columns |
|---|---|
| `studio_production_orders_v3` | `id`, `company_id`, `branch_id`, `production_no`, `sale_id`, `customer_id`, `product_id`, `fabric`, `design_notes`, `deadline`, `status`, `production_cost`, `profit_percent`, `profit_amount`, `final_price`, `generated_invoice_id` |
| `studio_production_stages_v3` | `id`, `order_id`, `stage_name`, `worker_id`, `expected_cost`, `actual_cost`, `status`, `sort_order` |
| `studio_production_cost_breakdown_v3` | `id`, `production_id`, `stage_name`, `worker_name`, `worker_cost`, `type` (`worker_cost` \| `profit`) |

### V2 (partially active)
| Table | Key Columns |
|---|---|
| `studio_production_orders_v2` | `id`, `company_id`, `branch_id`, `sale_id`, `production_no`, `status`, `customer_invoice_generated`, `generated_sale_id`, `product_id` |
| `studio_production_stages_v2` | `id`, `order_id`, `stage_type`, `status`, `sort_order` |
| `studio_stage_assignments_v2` | `id`, `stage_id`, `assigned_worker_id`, `expected_cost` |
| `studio_stage_receipts_v2` | `id`, `stage_id`, `actual_cost`, `received_at`, `received_by`, `notes` |

### V1 / Shared (legacy)
| Table | Key Columns |
|---|---|
| `studio_orders` | `id`, `company_id`, `branch_id`, `order_no`, `customer_id`, `status`, `total_cost`, `advance_paid`, `balance_due`, `measurements` (JSONB) |
| `studio_order_items` | `id`, `studio_order_id`, `item_description`, `quantity`, `unit_price`, `total` |
| `job_cards` | `id`, `studio_order_id`, `task_type`, `assigned_worker_id`, `status`, `payment_amount`, `is_paid` |
| `workers` | `id`, `company_id`, `name`, `phone`, `cnic`, `worker_type`, `payment_type`, `rate`, `current_balance`, `is_active` |
| `studio_productions` | Used by `studioCostsService`; appears to be a V1/V2 shared production table |
| `studio_production_stages` | Used by `studioCostsService` and `studioProductionService`; V1/V2 shared |

### Worker / Shared tables (all versions)
| Table | Key Columns |
|---|---|
| `worker_ledger_entries` | `id`, `company_id`, `worker_id`, `amount`, `status` (`paid`/`unpaid`), `reference_type`, `reference_id`, `document_no`, `paid_at`, `payment_reference`, `created_at` |
| `payments` | Standard ERP payments table; `reference_type = 'worker_payment'`, `reference_id = worker_id` for worker payments |
| `journal_entries` / `journal_entry_lines` | Standard double-entry accounting tables |

---

## Production Order Create Flow (V3)

1. A sale with `invoice_no LIKE 'STD-%'` is created by the sales team.
2. `ensureStudioProductionV3OrdersForCompany()` is called (on dashboard load or manually triggered).
3. For each `STD-*` sale without an existing V3 order, `studioProductionV3Service.createOrder()` is called with `status = 'draft'`, `production_cost = 0`.
4. Five default stages are created in sequence via `createStage()`: `Dyeing` (sort 0), `Stitching` (1), `Handwork` (2), `Embroidery` (3), `Finishing` (4) — all with `status = 'pending'`.
5. The order is now visible in `studio-pipeline` and `studio-order-detail-v3`.

Manual order creation (not tied to a sale) is also supported via `createOrder()` directly from the UI.

---

## Stage Management

| Action | Function | Status transition | Cost effect |
|---|---|---|---|
| Add stage | `createStage(orderId, stageName, sortOrder)` | Starts as `pending` | `expected_cost = 0`, `actual_cost = 0` |
| Assign worker | `assignWorker(stageId, workerId, expectedCost)` | `pending` → `assigned` | Sets `expected_cost` |
| Start stage | `updateStage(stageId, { status: 'in_progress' })` | `assigned` → `in_progress` | No cost change |
| Complete stage | `completeStage(stageId, actualCost)` | `in_progress` → `completed` | Sets `actual_cost` |
| Recalculate cost | `recalculateProductionCost(orderId)` | No status change | Sums all `actual_cost`; writes to `production_cost` on order |

Order status (`draft` → `in_progress` → `completed` → `cancelled`) is updated manually via `updateOrder()`.

---

## Cost Tracking

Service: `studioCostsService.ts`

**Account codes used:**
| Account | Code | Role |
|---|---|---|
| Cost of Production | `5000` | Debited when a stage is billed; net debit = total production cost |
| Worker Payable | `2010` | Credited when stage billed (liability); debited when worker paid |
| Worker Advance | `1180` | Debited as an asset when worker paid before stage bill exists |

**Cost summary logic (journal-driven primary path):**
```
Total Cost    = SUM(debit) − SUM(credit) on account 5000 (net, after reversals)
Outstanding   = SUM(credit) − SUM(debit) on account 2010 (net payable)
Paid          = Total Cost − Outstanding
```

**Journal entry reference types read by `studioCostsService`:**
- `studio_production_stage` — stage billing entry
- `studio_production_stage_reversal` — stage cost reversal
- `payment` — worker payment entry
- `manual` — manual journal

**Stage-type cost breakdown** (for `byStageType` in `StudioCostsSummary`):
- `dyer`, `stitching`, `handwork` — read from `studio_production_stages.stage_type`

**Fallback path (`fromJournal: false`):**
- If no journal data exists, reads `worker_ledger_entries` directly.
- Reads `studio_productions` + `studio_production_stages` (V1/V2 table names).
- `fromJournal` flag is returned in `StudioCostsSummary` so callers know which path was used.

**Worker paid/unpaid reconciliation (Z2 layer):**
After building per-stage cost from journals, `studioCostsService` reads `payments` rows where `reference_type = 'worker_payment'` and applies FIFO allocation across stages to determine which are `paid`, `partial`, or `unpaid`. This overrides the ledger-based paid status when payment rows exist.

**Cost breakdown table (`studio_production_cost_breakdown_v3`):**
- Written by `saveCostBreakdown()` as a delete-and-replace.
- Row types: `worker_cost` (per stage) and `profit` (margin line).
- Used for display/reporting; not the authoritative cost source (stages are).

---

## Worker Advance / Payment Flow

Service: `workerPaymentService.ts` — function `createWorkerPayment(params)`

**Steps (in order):**

1. **Document number** — `documentNumberService.getNextDocumentNumber(companyId, branchId, 'payment')` → `PAY-xxxx`. Falls back to `generatePaymentReference()` if sequence fails.

2. **`payments` row** — inserted with:
   - `payment_type = 'paid'`
   - `reference_type = 'worker_payment'`
   - `reference_id = workerId`
   - `reference_number = PAY-xxxx`
   - This row makes the payment visible in Roznamcha (cash book).

3. **Debit account decision (`shouldDebitWorkerPayableForPayment`):**
   - If a stage bill already exists for this worker+stage: debit **Worker Payable (2010)** — clearing the liability.
   - If no bill yet (pre-payment / advance): debit **Worker Advance (1180)** — recording an asset.

4. **Journal entry:**
   ```
   Dr  Worker Payable (2010) [if billed]  OR  Worker Advance (1180) [if advance]   [amount]
       Cr  Payment Account (cash/bank/card)                                          [amount]
   ```
   Entry `reference_type = 'worker_payment'`, `reference_id = workerId`.

5. **`worker_ledger_entries` row** — inserted with `accounting_payment` type, the `PAY-xxxx` reference, and `journal_entry_id`. Only written when this is **not** a full Pay-Now payment (to avoid double-entry).

6. **Pay-Now full:** If `stageId` is provided and `amount >= stageAmount`, `studioProductionService.markStageLedgerPaid(stageId, null)` is called instead of writing a ledger row. This marks the stage paid without contaminating the stage's job row with a payment reference.

7. `dispatchContactBalancesRefresh(companyId)` is fired to refresh contact balance UI.

**Worker ledger entry types** (from `worker_ledger_entries.entry_type` / `reference_type`):
- `advance` — pre-payment before stage completion
- `accounting_payment` — payment written by canonical payment flow
- `studio_production_stage` — per-stage cost record (the "bill")

---

## Billing / Customer Invoice

Service: `studioCustomerInvoiceService.ts` (operates on **V2** orders)

**Pre-conditions:**
- `studio_production_orders_v2.status = 'completed'`
- `customer_invoice_generated` must be false (no duplicate invoices)

**Flow (`generateCustomerInvoiceFromProduction`):**
1. `getProductionCostSummary(orderId)` — sums `studio_stage_receipts_v2.actual_cost` for all stages.
2. `getSaleInfoForOrder(orderId)` — resolves customer, product from the linked `STD-*` sale.
3. `documentNumberService.getNextDocumentNumber(companyId, branchId, 'sale')` → invoice number.
4. `saleService.createSale(sale, items, { allowNegativeStock: true })` — creates a final-status sale.
5. Updates `studio_production_orders_v2`: sets `customer_invoice_generated = true`, `generated_sale_id`.
6. Posts journal entry:
   ```
   Dr  AR (1100)                    [customerPrice]
       Cr  Sales Revenue (4000)     [customerPrice]

   Dr  COGS (5100)                  [productionCost]   (if productionCost > 0)
       Cr  Inventory (1200)         [productionCost]
   ```

**Create Product flow (`createProductFromProductionOrder`):**
- Creates a `products` row with `product_type = 'production'`, `sku = STD-PROD-xxxx`, `cost_price = productionCost`.
- Adds `stock_movements` row: `movement_type = 'production'`, qty = 1.
- Posts finished-goods journal entry:
  ```
  Dr  Finished Goods Inventory (1200)   [productionCost]
      Cr  Production Cost (5000)        [productionCost]
  ```

**V3 invoice path:** `studioProductionV3InvoiceService.ts` exists for V3 orders but was not read in full. The `studio_production_orders_v3.generated_invoice_id` field is the link point.

---

## Stock Effect

| Event | Stock effect |
|---|---|
| V1 order created/completed | No automatic stock movement (V1 service does not call `stock_movements`) |
| V2 stage completed | No stock movement per stage |
| V2 order: Create Product from Production | `stock_movements` insert: `movement_type = 'production'`, qty = 1, `unit_cost = productionCost` |
| V3 stage completed | No stock movement |
| V3 order completed | No automatic stock movement unless explicitly triggered |

Studio production does **not** consume raw material stock automatically. There is no BOM (bill of materials) system. The production flow is cost-tracking only; fabric and material consumption is not recorded as stock movements.

---

## Accounting Effect

### Stage billing (V1/V2 path, via `studioProductionService`)
When a stage is marked complete and billed:
```
Dr  Cost of Production (5000)     [stage cost]
    Cr  Worker Payable (2010)     [stage cost]
```
Reversal (if stage is cancelled/re-billed):
```
Dr  Worker Payable (2010)         [stage cost]
    Cr  Cost of Production (5000) [stage cost]
```

### Worker payment
If worker is already billed (payable exists):
```
Dr  Worker Payable (2010)         [amount]
    Cr  Cash / Bank (payment account)  [amount]
```
If worker is paid in advance (no bill yet):
```
Dr  Worker Advance (1180)         [amount]
    Cr  Cash / Bank (payment account)  [amount]
```

### Customer invoice (V2 completed order)
```
Dr  AR (1100)                     [customerPrice]
    Cr  Sales Revenue (4000)      [customerPrice]

Dr  COGS (5100)                   [productionCost]
    Cr  Inventory (1200)          [productionCost]
```

### Finished goods recognition (Create Product)
```
Dr  Finished Goods Inventory (1200)   [productionCost]
    Cr  Cost of Production (5000)     [productionCost]
```

**Account codes summary:**

| Account | Code | Type |
|---|---|---|
| Accounts Receivable | 1100 | Asset |
| Finished Goods Inventory | 1200 | Asset |
| Worker Advance | 1180 | Asset |
| Worker Payable | 2010 | Liability |
| Sales Revenue | 4000 | Revenue |
| Cost of Production | 5000 | Expense/COGS |
| COGS (studio sale) | 5100 | Expense/COGS |

---

## Known Version Confusion Risks

1. **`studioCostsService.getProductionCostSummaries()` reads V1/V2 tables (`studio_productions`, `studio_production_stages`)** — not V3 tables. A V3-only deployment will show zero production cost summaries in the cost dashboard unless a separate V3 path is added.

2. **`studioCustomerInvoiceService` is V2-only.** It calls `studioProductionV2Service.getOrderById()`. If a company has only V3 orders, `generateCustomerInvoiceFromProduction()` will fail with "Production order not found". The V3 invoice path is in `studioProductionV3InvoiceService.ts` but is a separate service.

3. **`ensureStudioProductionV3OrdersForCompany` creates V3 orders for all STD-* sales** — including those that already have V2 orders. This can result in both a V2 and V3 order existing for the same sale, with different cost data in each. The function checks only V3 for duplicates; it does not check V2.

4. **`studioProductionService` (V1/legacy service) is still imported by `workerPaymentService`.** The `studioProductionService.recordAccountingPaymentToLedger()` and `markStageLedgerPaid()` functions are called from the canonical payment flow. If this table (`studio_production_stages`) is dropped, worker payments will fail.

5. **Stage tables are named differently per version:** `studio_production_stages_v3` (V3), `studio_production_stages_v2` (V2), `studio_production_stages` (V1/shared). Code that does not use the right suffix will silently operate on the wrong generation's data.

6. **`workers` vs `contacts` for worker names:** V1 uses a `workers` table. `studioCostsService` falls back from `workers` to `contacts` when a `worker_id` is not found in the workers table. New workers may be in either table.

---

## Known Failure Points

1. **No V3 accounting JE on stage completion.** `studioProductionV3Service.completeStage()` only updates the stage record. It does not post a journal entry (`Dr 5000 / Cr 2010`). The stage billing JE is only created by the legacy `studioProductionService`. V3 cost data therefore does not flow into the journal-driven cost summary unless the V1/V2 billing flow is also run.

2. **`studioCostsService` summary reads V1/V2 stages, not V3 stages.** `getProductionCostSummaries()` queries `studio_productions` and `studio_production_stages` — V1/V2 naming. V3 actual costs stored in `studio_production_stages_v3.actual_cost` are not included unless the caller explicitly uses `studioProductionV3Service.getStagesByOrderId()`.

3. **Paid status on `worker_ledger_entries` defaults to `unpaid`.** In `studioCostsService.getStudioCostsFromJournal()`, each stage ledger entry is constructed with `status: 'unpaid'` and then optionally refined by querying `worker_ledger_entries`. If no ledger row exists for a stage, the stage appears unpaid even if payment has occurred via the canonical `workerPaymentService` path.

4. **Worker Advance account (1180) must exist or payment throws.** `createWorkerPayment()` calls `getWorkerAdvanceAccountId()` and throws `'Worker Advance account (1180) not found. Run migrations or ensure default accounts.'` if the account row is missing. This is a hard failure with no fallback.

5. **Worker Payable (2010) lookup uses `OR` on code and name:** The query is `.or('code.eq.2010,name.ilike.%Worker Payable%')`. If the account exists with a different name and no code, or with code `2010` but a typo in name, this still works. But if account code `2010` is assigned to a different account (e.g., during chart-of-accounts setup), the wrong account will be debited.

6. **`saveCostBreakdown()` is destructive (delete-and-replace).** Calling it with an empty `rows` array deletes all existing breakdown data without inserting anything. There is no soft-delete or versioning.

7. **`generateCustomerInvoiceFromProduction` uses `allowNegativeStock: true`.** The finished goods product may show negative stock if `createProductFromProductionOrder` is not called first (or if the stock movement is otherwise missing).

8. **Duplicate V3 orders from backfill function.** `ensureStudioProductionV3OrdersForCompany` only checks `studio_production_orders_v3` for duplicates per `sale_id`. If called concurrently (two browser sessions), a race condition can create two V3 orders for the same sale.

---

## Recommended Standard

1. **Make V3 the only active version.** Migrate all in-progress V2 orders to V3, then disable V2 creation paths. Update `studioCustomerInvoiceService` to operate on V3 tables. Update `studioCostsService.getProductionCostSummaries()` to read V3 tables.

2. **Post JEs on V3 stage completion.** Add journal entry creation inside `studioProductionV3Service.completeStage()`:
   ```
   Dr  Cost of Production (5000)   [actualCost]
       Cr  Worker Payable (2010)   [actualCost]
   ```
   This brings V3 into the journal-driven cost reporting path.

3. **Single stage table reference in `studioCostsService`.** Replace the V1/V2 table names (`studio_productions`, `studio_production_stages`) with V3 table names once migration is complete.

4. **Decouple `workerPaymentService` from `studioProductionService`.** Extract `recordAccountingPaymentToLedger` and `markStageLedgerPaid` into a standalone worker ledger service that does not depend on a specific production version's table structure.

5. **Add a `is_advance` flag to `worker_ledger_entries`** instead of relying on the debit account to distinguish advance vs. bill payment. This makes reporting cleaner and avoids account-code dependency in business logic.

6. **Guard `saveCostBreakdown()` against empty array.** Require at least one row or add an explicit `clearCostBreakdown()` function to prevent accidental data deletion.

7. **Add a `production_version` column to `worker_ledger_entries`** (values `v1`, `v2`, `v3`) so cost summaries can be filtered to the correct version without joining multiple stage tables.

8. **Add a uniqueness constraint** on `studio_production_orders_v3(sale_id, company_id)` at the DB level to prevent duplicate V3 orders from the backfill race condition.
