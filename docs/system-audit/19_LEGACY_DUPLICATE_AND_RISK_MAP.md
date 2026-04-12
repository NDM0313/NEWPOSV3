# 19 — Legacy, Duplicate, and Risk Map

_Last updated: 2026-04-12. Stack: Next.js + Supabase (multi-tenant). Scope: all 128 service files, DB schema._

---

## Purpose

This document is the authoritative registry of every deprecated table, duplicate/version-conflicting service, structural architecture risk, and code-smell identified during the full system audit. It is intended as the primary reference for cleanup prioritization. Each entry is tagged with a severity and points to the relevant audit document for full detail.

---

## Section 1: Deprecated / Legacy Tables

### 1.1 `ledger_master`

| Field | Detail |
|---|---|
| **Original purpose** | Flat customer/supplier running balance ledger (pre-JE era) |
| **Current status** | Fully deprecated. Listed in `accountingCanonicalGuard.LEGACY_TABLE_BLOCKLIST`. The guard calls `failLegacyReadInDev` and `warnLegacyRead` on any service that queries it. |
| **Risk if used** | Returns balances that predate the double-entry GL. Any balance read from this table will diverge from `journal_entry_lines` and produce incorrect AR/AP figures. |
| **Migration path** | Do not migrate data. Drop the table after confirming zero active reads via the `accountingCanonicalGuard` log. All balances are now derived from `journal_entry_lines` net on accounts 1100 (AR) and 2000 (AP). |

---

### 1.2 `ledger_entries`

| Field | Detail |
|---|---|
| **Original purpose** | Transaction-level ledger rows paired with `ledger_master` |
| **Current status** | Fully deprecated. In `LEGACY_TABLE_BLOCKLIST`. Also referenced in backup tables `backup_cr`, `backup_pf145` which are themselves in the blocklist. |
| **Risk if used** | Same as `ledger_master` — pre-JE era data, not reconciled with current double-entry system. |
| **Migration path** | Drop after zero-read confirmation. Backup tables (`backup_cr`, `backup_pf145`) should be archived to cold storage and dropped from the live schema. |

---

### 1.3 `contacts.current_balance`

| Field | Detail |
|---|---|
| **Original purpose** | Denormalized running balance cache (AR for customers, AP for suppliers) — populated on payment allocation events |
| **Current status** | Still present in schema. Reads are warned against via `warnIfUsingStoredBalanceAsTruth`. `effectivePartyLedgerService` correctly ignores it and reads `journal_entry_lines` instead. |
| **Risk if used** | HIGH. Diverges from GL whenever: (a) a payment allocation JE fails silently; (b) a manual JE directly debits/credits the subledger without updating the cache; (c) opening balance corrections are posted. Any report built on `current_balance` will show incorrect customer/supplier exposure. |
| **Detection query** | `SELECT c.id, c.current_balance AS cached, SUM(jel.debit) - SUM(jel.credit) AS gl_ar FROM contacts c JOIN accounts a ON a.linked_contact_id = c.id JOIN journal_entry_lines jel ON jel.account_id = a.id JOIN journal_entries je ON je.id = jel.journal_entry_id WHERE je.company_id = c.company_id AND je.is_void = false AND c.contact_type = 'customer' GROUP BY c.id HAVING ABS(c.current_balance - (SUM(jel.debit) - SUM(jel.credit))) > 0.01` |
| **Migration path** | Phase out all reads. Null out the column once all UI components are confirmed to use `effectivePartyLedgerService` or the canonical balance query. Eventually drop the column. |

---

### 1.4 `accounts.balance`

| Field | Detail |
|---|---|
| **Original purpose** | Opening balance seed entered at chart-of-accounts setup |
| **Current status** | Still in schema. Correctly documented as an opening seed — `getAccountBalancesFromJournal` does not use it for live balance computation. `warnIfUsingStoredBalanceAsTruth` fires on misuse. |
| **Risk if used** | HIGH for live balance reporting. `accounts.balance` reflects only the opening entry, not any subsequent journal activity. Cash/bank/equity balances from this column would undercount by the full amount of all post-opening transactions. |
| **Migration path** | Rename the column to `opening_balance_seed` in a migration to eliminate ambiguity. Annotate in COA UI. Do not drop (it is the authoritative opening seed for `openingBalanceJournalService`). |

---

### 1.5 `inventory_balance`

| Field | Detail |
|---|---|
| **Original purpose** | Cached running stock quantity per `(company_id, branch_id, product_id, variation_id)` — intended for fast POS availability checks |
| **Current status** | Table exists in schema. NOT read by `getInventoryOverview`, `getStock`, or `getStockForProducts` — all of these recalculate from `stock_movements` at query time. Maintained by a DB trigger whose coverage has not been confirmed in the service layer audit. |
| **Risk if used** | MEDIUM-HIGH. If any consumer reads `inventory_balance` directly (e.g. a custom API route or future POS optimization), it may see stale data for any movement not covered by the trigger. |
| **Detection query** | `SELECT ib.product_id, ib.quantity AS cached_qty, SUM(sm.quantity) AS movement_qty FROM inventory_balance ib JOIN stock_movements sm ON sm.product_id = ib.product_id AND (sm.variation_id = ib.variation_id OR (sm.variation_id IS NULL AND ib.variation_id IS NULL)) AND sm.company_id = ib.company_id GROUP BY ib.product_id, ib.quantity HAVING ABS(ib.quantity - SUM(sm.quantity)) > 0.001` |
| **Migration path** | Verify the DB trigger covers all `stock_movements` INSERT paths. Once confirmed, activate `inventory_balance` as the hot path for POS reads. If trigger coverage cannot be guaranteed, remove the table to avoid false trust. |

---

### 1.6 `products.current_stock`

| Field | Detail |
|---|---|
| **Original purpose** | Synchronously maintained running stock count per product |
| **Current status** | Column exists. `inventoryService` comments explicitly state "Stock = movement-based only (`stock_movements`); no `product.current_stock`." The service layer does not write to this column on normal stock events. |
| **Risk if used** | MEDIUM. The column can diverge when an operation fails mid-transaction after the stock movement is written but before a hypothetical balance update would run. Any UI element reading `current_stock` directly will show incorrect numbers for affected products. |
| **Detection query** | `SELECT p.id, p.current_stock AS cached, SUM(sm.quantity) AS movement_sum FROM products p JOIN stock_movements sm ON sm.product_id = p.id WHERE p.company_id = sm.company_id GROUP BY p.id, p.current_stock HAVING ABS(p.current_stock - SUM(sm.quantity)) > 0.001` |
| **Migration path** | If the column is not actively maintained, drop it and replace all reads with `inventoryService.getStock()`. If it must stay for performance, implement the DB trigger on `stock_movements` that upserts it atomically. |

---

### 1.7 `sales.due_amount` / `purchases.due_amount`

| Field | Detail |
|---|---|
| **Original purpose** | Document-level remaining balance cache — updated by `recalc_sale_payment_totals` / `recalc_purchase_payment_totals` DB functions on payment allocation events |
| **Current status** | Actively used as a UI shortcut and for FIFO invoice selection (`fetchOpenInvoicesForFifo` queries `sales WHERE due_amount > 0.009`). Classified as an accepted operational shortcut in the Source of Truth Matrix. |
| **Risk if used** | MEDIUM. Diverges when: (a) a payment is voided after the document cache was last updated; (b) `recalc_sale_payment_totals` is not triggered (e.g. direct DB payment deletion without the trigger firing). Dashboard KPIs built on `due_amount` sum will mis-state outstanding AR/AP. |
| **Detection query** | `SELECT s.id, s.due_amount AS cached_due, s.total - COALESCE(p.paid, 0) AS computed_due FROM sales s LEFT JOIN (SELECT reference_id, SUM(amount) AS paid FROM payments WHERE reference_type = 'sale' AND voided_at IS NULL GROUP BY reference_id) p ON p.reference_id = s.id WHERE s.company_id = $1 AND s.status = 'final' AND ABS(s.due_amount - (s.total - COALESCE(p.paid, 0))) > 0.01` |
| **Migration path** | Keep as operational shortcut but ensure `recalc_sale_payment_totals` is wired to fire on all payment void and deletion paths. Add a scheduled reconciliation job that detects divergence and recomputes. |

---

### 1.8 `sale_items` vs `sales_items` (naming inconsistency)

| Field | Detail |
|---|---|
| **Original purpose** | `sale_items` is the legacy table for sale line items. `sales_items` is the canonical table. |
| **Current status** | Both tables exist. `saleReturnService` lists both tables in its DB table documentation and notes that `sale_return_items.sale_item_id` foreign key is defined against `sale_items` only. Code in `finalizeSaleReturn` has a `sales_items → sale_items` fallback query. |
| **Risk if used** | MEDIUM. Any service that queries only `sale_items` misses data stored in `sales_items`. Any FK from `sale_return_items.sale_item_id` pointing to `sale_items` will fail for canonical rows, silently falling back to `product_id + variation_id` matching (which is less precise). |
| **Migration path** | (1) Migrate all `sale_items` rows to `sales_items`. (2) Update the FK on `sale_return_items.sale_item_id` to point to `sales_items`. (3) Drop `sale_items`. Update all service queries to use `sales_items` only. |

---

## Section 2: Duplicate / Version-Conflicting Services

### 2.1 Studio Production: Three Co-existing Versions

All three versions are present in the production codebase simultaneously.

#### V1 — `studioProductionService.ts` / `studioService.ts`

| Aspect | Detail |
|---|---|
| **Tables read/written** | `studio_orders`, `studio_order_items`, `job_cards`, `workers`, `studio_productions` (shared), `studio_production_stages` (shared) |
| **Active for new orders** | No. New orders are created via V3. However, this service is still imported by `workerPaymentService.ts` for `recordAccountingPaymentToLedger` and `markStageLedgerPaid`. |
| **JE posting** | Posts `Dr Cost of Production (5000) / Cr Worker Payable (2010)` on stage billing. This is the ONLY studio version that posts JEs on stage events. |
| **Stage status values** | `cutting`, `stitching`, `finishing`, `embroidery` (from `job_cards.task_type`) |
| **Error handling** | Table-not-found errors (`PGRST205`) are silently swallowed — indicates V1 tables may not exist in all tenants |
| **Risk** | HIGH. If V1 tables are dropped, `workerPaymentService` will throw on every worker payment because it still calls V1 functions. |

#### V2 — `studioProductionV2Service.ts`

| Aspect | Detail |
|---|---|
| **Tables read/written** | `studio_production_orders_v2`, `studio_production_stages_v2`, `studio_stage_assignments_v2`, `studio_stage_receipts_v2` |
| **Active for new orders** | Partially. `studioCustomerInvoiceService` explicitly calls V2 functions to generate customer invoices from completed orders. |
| **JE posting** | No JE is posted directly by V2 service. Customer invoice JE is posted by `studioCustomerInvoiceService`. |
| **Stage status values** | `pending | assigned | in_progress | completed`; stage types: `dyer | stitching | handwork | embroidery | finishing | quality_check` |
| **Risk** | MEDIUM. V2 orders coexist with V3 orders for the same `sale_id` (the backfill function creates V3 without checking V2). Two parallel cost records exist for the same production job. |

#### V3 — `studioProductionV3Service.ts` (Current)

| Aspect | Detail |
|---|---|
| **Tables read/written** | `studio_production_orders_v3`, `studio_production_stages_v3`, `studio_production_cost_breakdown_v3` |
| **Active for new orders** | Yes. All new production orders are V3. |
| **JE posting** | NONE. `completeStage()` sets `actual_cost` and calls `recalculateProductionCost()` but posts no journal entry. This is the critical gap. |
| **Stage status values** | `pending | assigned | in_progress | completed`; stage names are free-form strings (not an enum) |
| **Risk** | HIGH. Zero GL entries from V3 stage completion. `studioCostsService` cost summary reads V1/V2 tables, not V3, so V3 costs are invisible to the cost dashboard. |

#### Mixed-Version Risk Table

| Risk Scenario | Impact | Severity |
|---|---|---|
| Order has V2 and V3 records for same sale | Duplicate cost rows; `studioCostsService` counts V2 cost, V3 cost is silently ignored | HIGH |
| `studioCostsService` reads V1/V2 tables exclusively | V3 production costs never appear in the cost dashboard | HIGH |
| `workerPaymentService` calls V1 `markStageLedgerPaid` | Worker payments fail if V1 `studio_production_stages` table is absent | HIGH |
| `studioCustomerInvoiceService` is V2-only | Generating customer invoice for a V3-only company will throw "Production order not found" | MEDIUM |
| V3 `ensureStudioProductionV3OrdersForCompany` race | Two browser sessions can create two V3 orders for the same sale (no DB uniqueness constraint on `(sale_id, company_id)`) | MEDIUM |

---

### 2.2 Duplicate Payment Tracking

Three parallel mechanisms track payment state:

| Mechanism | What it tracks | Canonical? |
|---|---|---|
| `payments` table | Operational record of every cash movement; `voided_at` for void state | Yes — existence |
| `journal_entries` + `journal_entry_lines` with `payment_id` | GL effect of every payment; the authoritative financial record | Yes — GL truth |
| `payment_allocations` table | Which invoices a payment is applied against; drives `recalc_sale_payment_totals` | Yes — allocation |
| `contacts.current_balance` | Cached running AR/AP balance | No — cache only |
| `sales.due_amount` / `purchases.due_amount` | Document-level remaining balance cache | No — shortcut |

**Risk:** If a payment row exists without a JE (`payments LEFT JOIN journal_entries ON payment_id WHERE je.id IS NULL AND voided_at IS NULL`), the cash book shows a receipt that never hit the GL. This is a known failure mode (see doc 10, Known Failure Point 1) — the service inserts the `payments` row first, then the JE; if the JE insert throws, the payments row is orphaned. No compensating transaction cleans this up.

---

### 2.3 Dual Document Numbering Engines

| Engine | Table | Used By |
|---|---|---|
| Primary | `document_sequences` or `erp_document_sequences` | `documentNumberService.getNextDocumentNumber` — used by most services |
| Fallback / legacy | `document_sequences_global` | Unclear — audited code shows `purchaseReturnService` uses `document_sequences` (doc type = `'purchase_return'`); some services fall back to timestamp-based numbers when the sequence table returns no rows |

**Risk:** If both sequence tables exist with overlapping doc types, two services can issue the same `reference_number` to different documents. Sequence gaps (from failed transactions that incremented then rolled back) cause non-sequential numbering visible to customers on invoices.

**Detection query:** `SELECT document_type, COUNT(*) AS seq_tables FROM (SELECT 'erp_document_sequences' AS tbl, document_type FROM erp_document_sequences UNION ALL SELECT 'document_sequences_global', document_type FROM document_sequences_global) x GROUP BY document_type HAVING COUNT(*) > 1`

---

### 2.4 Opening Stock `movement_type = 'opening'` vs `'adjustment'`

| Path | `movement_type` | `reference_type` | GL sync fires? |
|---|---|---|---|
| Canonical (`insertOpeningBalanceMovement`) | `'adjustment'` | `'opening_balance'` | Yes — `syncOpeningJournalIfApplicable` checks both conditions |
| Legacy / import path | `'opening'` | `'opening_balance'` | No — `syncOpeningJournalIfApplicable` only checks `movement_type = 'adjustment'` |

**Risk:** Any tenant whose opening stock was imported via the legacy `'opening'` path has stock that was counted into inventory but never posted to the GL inventory account (1200). The balance sheet understates assets; the opening equity entry is missing the inventory component.

**Detection query:** `SELECT id, product_id, quantity, unit_cost FROM stock_movements WHERE movement_type = 'opening' AND reference_type = 'opening_balance' AND company_id = $1`

**Remediation:** Run a migration: `UPDATE stock_movements SET movement_type = 'adjustment' WHERE movement_type = 'opening' AND reference_type = 'opening_balance'`, then call `syncInventoryOpeningFromStockMovementId` for each affected row.

---

### 2.5 Two Customer Ledger UIs for the Same Data

| UI | Route / Component | Data source |
|---|---|---|
| Legacy customer ledger | `customer-ledger-modern-original` | `customerLedgerApi.ts` — unclear if it reads `journal_entry_lines` or a legacy adapter |
| Canonical party ledger | `EffectivePartyLedgerPage` | `effectivePartyLedgerService.loadEffectivePartyLedger` — builds from `journal_entry_lines`, collapses PF-14 chains |

**Risk:** A user opening the legacy ledger UI sees different numbers than the canonical ledger. Support tickets about "wrong balance" may be caused by consulting the wrong ledger page. The legacy UI may also read `contacts.current_balance` indirectly via `ledgerDataAdapters.ts`.

**Remediation:** Retire `customer-ledger-modern-original`. Redirect all navigation entries to `EffectivePartyLedgerPage`. Audit `customerLedgerApi.ts` and `ledgerDataAdapters.ts` for `current_balance` reads.

---

## Section 3: Architecture Risks

### RISK-01: Fire-and-Forget Journal Entry Posting

| Field | Detail |
|---|---|
| **Description** | Sale, purchase, expense, and studio accounting calls use `.catch(err => console.error(...))` or `void promise` patterns rather than `await`. If the JE insert fails, the error is logged to the console but the operation returns success to the UI. |
| **Severity** | HIGH |
| **Affected modules** | Sales (COGS JE), Purchase (inventory JE), Expenses, POS (settlement JE), Studio production (stage JE via V1 path) |
| **Impact** | A sale can be posted as "final" with revenue recognized in the operational table (`sales.total`) but with no corresponding credit to Revenue (4100) in the GL. The Trial Balance will undercount revenue for any such period. |
| **Detection query** | `SELECT s.id, s.total, s.invoice_date FROM sales s WHERE s.status = 'final' AND s.company_id = $1 AND NOT EXISTS (SELECT 1 FROM journal_entries je WHERE je.reference_type = 'sale' AND je.reference_id = s.id AND je.is_void = false)` |
| **Recommended fix** | All JE posting calls must be `await`-ed and any failure must either (a) roll back the parent document to draft status, or (b) set an `accounting_pending = true` flag on the document for async retry. |

---

### RISK-02: Draft Return Pollution of Quantity Validation — Purchase Returns (UNFIXED)

| Field | Detail |
|---|---|
| **Description** | `finalizePurchaseReturn` queries `purchase_return_items` without a join to `purchase_returns.status`. Abandoned draft returns permanently consume returnable quantity for a given product/purchase combination. |
| **Severity** | HIGH |
| **Affected modules** | Purchase Returns (`purchaseReturnService.finalizePurchaseReturn`) |
| **Impact** | A draft return of qty=8 against an original purchase of qty=10 blocks any new return attempt for qty > 2, even though the draft has no financial or stock effect. Users receive a "Return qty exceeds purchased qty" error for valid return quantities. Requires manual DB intervention to delete the blocking draft. |
| **Note** | The equivalent bug in `saleReturnService.finalizeSaleReturn` was FIXED in the current audit session by pre-fetching `finalReturnIds` and filtering on `status = 'final'`. |
| **Fix** | Mirror the sale return fix: pre-fetch `purchase_return_ids` where `status = 'final'` for the original purchase, then count `purchase_return_items` only within those IDs. |

---

### RISK-03: Purchase Return Has No Journal Entry on Finalize (Critical Gap)

| Field | Detail |
|---|---|
| **Description** | `finalizePurchaseReturn` writes `stock_movements` (quantity OUT) and fires `recalc_purchase_payment_totals` but does NOT post any journal entry. The expected JE (Dr AP subledger / Cr Inventory 1200) is never created by the service. |
| **Severity** | HIGH (data integrity) |
| **Affected modules** | Purchase Returns (`purchaseReturnService.ts`) |
| **Impact** | Every finalized purchase return creates a stock reduction with no GL counterpart. The AP balance is not relieved in the GL; the inventory asset account (1200) is not credited. The Trial Balance and Balance Sheet overstate both AP (2000) and Inventory (1200) by the return amount. |
| **Contrast** | `finalizeSaleReturn` correctly posts both a settlement JE and a COGS reversal JE. |
| **Fix** | Add a call to `purchaseAccountingService` (or a new `purchaseReturnAccountingService`) inside `finalizePurchaseReturn` immediately after status is claimed: `Dr AP subledger = return.total / Cr Inventory (1200) = return.total`. Use fingerprint `'purchase_return_document:{companyId}:{returnId}'` for idempotency. |

---

### RISK-04: Studio V3 Has No Journal Entry on Stage Completion

| Field | Detail |
|---|---|
| **Description** | `studioProductionV3Service.completeStage(stageId, actualCost)` sets `actual_cost` and calls `recalculateProductionCost()` but posts no JE. The V1 billing JE (`Dr 5000 / Cr 2010`) is only posted by `studioProductionService` (V1 path). |
| **Severity** | HIGH |
| **Affected modules** | Studio Production V3, `studioCostsService` |
| **Impact** | All V3 production costs are invisible to the journal-driven `studioCostsService.getStudioCostsFromJournal()`. The cost dashboard shows zero or stale production costs for V3 companies. Worker Payable (2010) is understated for all V3 worker assignments. |
| **Fix** | Add JE creation inside `studioProductionV3Service.completeStage()`: `Dr Cost of Production (5000) / Cr Worker Payable (2010)` with fingerprint `'studio_v3_stage_complete:{companyId}:{stageId}'`. |

---

### RISK-05: `studioCostsService` Reads V1/V2 Tables — V3 Costs Invisible to Cost Dashboard

| Field | Detail |
|---|---|
| **Description** | `studioCostsService.getProductionCostSummaries()` queries `studio_productions` and `studio_production_stages` (V1/V2 naming). V3 costs in `studio_production_stages_v3.actual_cost` are never included. |
| **Severity** | HIGH |
| **Affected modules** | Studio cost dashboard, any report calling `getProductionCostSummaries` |
| **Fix** | Update `getProductionCostSummaries` to query `studio_production_stages_v3` once RISK-04 is resolved and V3 stage JEs are being posted. |

---

### RISK-06: Manual Opening Stock via `movement_type = 'opening'` Creates No GL Entry

| Field | Detail |
|---|---|
| **Description** | Legacy and import-created stock movements with `movement_type = 'opening'` are excluded from `syncOpeningJournalIfApplicable` because the function checks `movement_type = 'adjustment'`. |
| **Severity** | HIGH |
| **Affected modules** | Inventory opening balance, GL inventory account (1200) |
| **Impact** | Stock quantities are correct but the balance sheet inventory figure is understated by the value of all `movement_type = 'opening'` rows. |
| **Fix** | Data migration + retroactive GL sync (see Section 2.4 above). |

---

### RISK-07: `contacts.current_balance` Stale Divergence

| Field | Detail |
|---|---|
| **Description** | Denormalized AR/AP balance cache that diverges silently on JE failures, manual journals, and opening balance corrections. |
| **Severity** | HIGH |
| **Affected modules** | Any UI reading `contacts.current_balance` for AR/AP display |
| **Detection** | See Section 1.3 detection query |
| **Fix** | Phase out all reads; remove the column after migration (see Section 1.3). |

---

### RISK-08: `inventory_balance` Table May Be Stale

| Field | Detail |
|---|---|
| **Description** | The `inventory_balance` cache table is not read by the primary service layer but exists in the schema. If any consumer reads it (direct query, RLS policy, future optimization), it may see stale stock figures. |
| **Severity** | MEDIUM |
| **Detection** | See Section 1.5 detection query |
| **Fix** | Confirm trigger coverage or drop the table. |

---

### RISK-09: POS Journal Entry Is Fire-and-Forget

| Field | Detail |
|---|---|
| **Description** | The POS sale flow posts the accounting JE (revenue recognition and COGS) asynchronously without blocking the sale completion. If the JE insert fails, the sale is marked final in the operational table but has no GL entry. |
| **Severity** | HIGH |
| **Affected modules** | POS (`posService` or equivalent), `saleAccountingService` |
| **Fix** | Same pattern as RISK-01 — await the JE or implement an `accounting_pending` flag with retry. |

---

### RISK-10: Worker Account Codes Hardcoded — Missing Account Causes Hard Error

| Field | Detail |
|---|---|
| **Description** | `workerPaymentService.createWorkerPayment()` calls `getWorkerAdvanceAccountId()` which throws `'Worker Advance account (1180) not found. Run migrations or ensure default accounts.'` if the account row is absent. Worker Payable lookup uses `OR code.eq.2010,name.ilike.%Worker Payable%` — if account code 2010 is assigned to a different account, the wrong account is debited. |
| **Severity** | HIGH |
| **Affected modules** | Worker payments, studio production billing |
| **Fix** | Add a pre-flight check at company onboarding to ensure accounts 1180 and 2010 exist. Add a fallback that creates these accounts from defaults rather than throwing. |

---

### RISK-11: `erp_document_sequences` vs `document_sequences_global` — Ambiguous Winner

| Field | Detail |
|---|---|
| **Description** | The codebase references at least two sequence tables. `documentNumberService` queries one; legacy paths may fall back to timestamp-based numbers. Which table is authoritative for a given document type is not codified. |
| **Severity** | MEDIUM |
| **Affected modules** | All document numbering (sales, purchases, returns, payments, worker payments) |
| **Risk** | Duplicate reference numbers; sequence gaps; non-sequential invoice numbers visible to customers |
| **Fix** | Audit all sequence table reads in `documentNumberService.ts` and `numberingMaintenanceService.ts`. Consolidate to a single table. Add a DB uniqueness constraint on `(company_id, branch_id, document_type, reference_number)` on relevant tables. |

---

### RISK-12: Rental Has No JE Posted by `rentalService` (Relies on External Layer)

| Field | Detail |
|---|---|
| **Description** | Similar to purchase returns, `rentalService` does not post GL entries internally. JE posting is delegated to the `AccountingContext` layer or manual entry. |
| **Severity** | MEDIUM |
| **Affected modules** | Rentals, rental revenue reporting |
| **Risk** | If the UI accounting context is bypassed (e.g. direct API call, server-side batch), rental revenue and AR are not recorded in the GL. |
| **Fix** | Move JE posting into `rentalService` finalize flow. |

---

### RISK-13: Payment FIFO Allocation Epsilon (0.02) Can Create Ghost Overpayments

| Field | Detail |
|---|---|
| **Description** | `computeFifoAllocationPlan` uses an epsilon of `0.02` — invoices with `due_amount < 0.02` are treated as fully paid and skipped. After rounding (`Math.round(take * 100) / 100`), partial allocations can leave a `remaining` that accumulates across many invoices. |
| **Severity** | MEDIUM |
| **Affected modules** | `paymentAllocationService`, AR reconciliation |
| **Risk** | Ghost "unapplied credit" amounts appear in the ledger for invoices that were paid within the epsilon. Over many allocation cycles, these micro-residuals accumulate in the `unapplied` bucket and misrepresent the AR balance. |
| **Fix** | Reduce epsilon to `0.001`. Add a zero-out step: if `remaining < 0.005` after all allocations, force-allocate the residual to the last invoice. |

---

### RISK-14: Sale COGS JE Uses `product.cost_price` — Inconsistent with Retail Inventory Method

| Field | Detail |
|---|---|
| **Description** | The sale COGS journal entry uses `products.cost_price` (a static reference field set at product setup time), not `stock_movements.unit_cost` (the actual purchase cost at time of receipt). The system documents that it uses the retail inventory method, where `total_cost` in `stock_movements` for a sale is the negative selling price, not the purchase cost. However, the COGS JE uses a static product cost rather than a movement-derived weighted average. |
| **Severity** | MEDIUM |
| **Affected modules** | Sales accounting, P&L gross margin, Trial Balance (5000 COGS) |
| **Risk** | If `products.cost_price` is not updated after each purchase at a new price, the COGS JE drifts from actual cost. Gross margin in the P&L is misstated. |
| **Fix** | Implement a weighted average cost update on each purchase receipt: `new_avg_cost = (old_qty * old_avg_cost + new_qty * new_unit_cost) / (old_qty + new_qty)`. Use this computed average as the COGS basis at point of sale. |

---

## Section 4: Code Smell / Structural Debt

### 4.1 Service Count and Overlap (128 files)

The `/src/app/services/` directory contains 117+ TypeScript service files (as counted at audit date). Many overlap in responsibility:

| Concern | Overlapping services |
|---|---|
| Accounting integrity / reconciliation | `arApReconciliationCenterService`, `partyTieOutRepairService`, `contactBalanceReconciliationService`, `integrityLabService`, `accountingIntegrityService`, `accountingIntegrityLabService`, `fullAccountingAuditService`, `developerAccountingDiagnosticsService`, `partyBalanceTieOutService`, `partyTieOutBulkCleanupService`, `arApRepairWorkflowService` |
| Party ledger reads | `effectivePartyLedgerService`, `customerLedgerApi`, `ledgerDataAdapters`, `partyFormBalanceService`, `controlAccountBreakdownService` |
| Payment lifecycle | `paymentLifecycleService`, `paymentAdjustmentService`, `paymentChainCompositeReversal`, `paymentChainMutationGuard`, `paymentAllocationService` |
| Studio production | `studioProductionService`, `studioProductionV2Service`, `studioProductionV3Service`, `studioService`, `studioCustomerInvoiceService`, `studioProductionV3InvoiceService`, `studioProductionInvoiceSyncService`, `studioCostsService` |
| Document repair / sync | `liveDataRepairService`, `documentStockSyncService`, `documentPostingEngine`, `postingDuplicateRepairService`, `journalTransactionDateSyncService` |

This density of reconciliation and repair services is itself a signal: the primary transaction paths (sale, purchase, return) have enough failure modes that a parallel infrastructure of repair tools has accumulated.

---

### 4.2 Three Studio Production Versions Co-existing

(See Section 2.1.) The three versions share `worker_ledger_entries` and `payments` tables, creating a cross-version dependency that prevents safe removal of any version without breaking the others.

---

### 4.3 Permission System Has Three Layers

The permission system is implemented at three separate levels with no single source of truth:

| Layer | Service / File | Enforcement point |
|---|---|---|
| Feature Flags | `featureFlagsService.ts` | Per-company feature toggle; overrides module visibility globally |
| Module Context | `ModuleContext` (React context) | Per-page visibility based on company settings |
| Permission Engine | `permissionEngine.ts`, `permissionService.ts` | Per-action RBAC enforcement on specific operations |

A user denied by FeatureFlags will never reach the PermissionEngine check. But a user granted by FeatureFlags and ModuleContext who fails PermissionEngine will see an error mid-flow rather than being blocked at the nav level. No unified "can the current user do X?" function exists that checks all three layers atomically.

---

### 4.4 Two Separate Customer Ledger UIs

(See Section 2.5.) `customer-ledger-modern-original` and `EffectivePartyLedgerPage` serve the same purpose but read from different underlying sources. Users and support staff must know which page to trust.

---

### 4.5 `currentView` String Union — 73+ Entries, No Route Validation

The `NavigationContext` uses a `currentView` string union with 73+ literal values (e.g. `'sales'`, `'studio-pipeline'`, `'studio-order-detail-v3'`, `'customer-ledger-modern-original'`, etc.). There is no route validation: passing an unknown string silently renders nothing or the default view. Adding a new view requires updating the union type in `NavigationContext` and every switch/conditional that reads `currentView`. This is a maintainability hazard for a growing feature set.

---

### 4.6 Reconciliation Service Proliferation

The system has accumulated at least 11 services dedicated to detecting and repairing data that should not need repair:

```
arApReconciliationCenterService.ts
partyTieOutRepairService.ts
contactBalanceReconciliationService.ts
integrityLabService.ts
accountingIntegrityService.ts
accountingIntegrityLabService.ts
fullAccountingAuditService.ts
developerAccountingDiagnosticsService.ts
partyBalanceTieOutService.ts
partyTieOutBulkCleanupService.ts
arApRepairWorkflowService.ts
liveDataRepairService.ts
postingDuplicateRepairService.ts
```

Each service exists because the primary transaction paths (sale posting, payment creation, return finalization) have silent failure modes that leave data in inconsistent states. The correct long-term fix is to eliminate the failure modes in the primary paths (RISK-01, RISK-03, RISK-09), not to grow the repair infrastructure further.

---

## Section 5: Recommended Cleanup Priority

### P1 — Data Integrity (Fix Immediately)

| # | Issue | Location | Action |
|---|---|---|---|
| P1-01 | Purchase return has NO journal entry on finalize | `purchaseReturnService.ts` | Add `Dr AP / Cr Inventory` JE inside `finalizePurchaseReturn` |
| P1-02 | Fire-and-forget JE posting (sales, purchases, expenses, POS) | `saleAccountingService`, `purchaseAccountingService`, `expenseService`, POS | Await all JE calls; add `accounting_pending` flag fallback |
| P1-03 | Studio V3 posts no JE on stage completion | `studioProductionV3Service.completeStage` | Add `Dr 5000 / Cr 2010` JE inside `completeStage` |
| P1-04 | `movement_type = 'opening'` rows never receive GL entries | `stock_movements` table | Data migration + retroactive GL sync |
| P1-05 | Worker account codes (1180, 2010) cause hard error if missing | `workerPaymentService` | Add pre-flight account check at onboarding; create defaults if absent |
| P1-06 | Draft pollution in purchase return quantity validation | `purchaseReturnService.finalizePurchaseReturn` | Mirror the sale return fix — filter on `status = 'final'` only |

### P2 — Accuracy (Fix Soon)

| # | Issue | Location | Action |
|---|---|---|---|
| P2-01 | `studioCostsService` reads V1/V2 tables — V3 costs invisible | `studioCostsService.getProductionCostSummaries` | Update to read V3 tables once P1-03 is resolved |
| P2-02 | Sale COGS JE uses static `product.cost_price`, not weighted average | `saleAccountingService` COGS computation | Implement weighted average cost on purchase receipt; use at sale time |
| P2-03 | FIFO allocation epsilon (0.02) creates micro ghost overpayments | `paymentAllocationService.computeFifoAllocationPlan` | Reduce epsilon to 0.001; add residual zero-out step |
| P2-04 | `contacts.current_balance` divergence | All AR/AP display paths | Phase out all reads; remove column |
| P2-05 | Two customer ledger UIs showing different numbers | `customer-ledger-modern-original` | Retire legacy ledger; redirect to `EffectivePartyLedgerPage` |
| P2-06 | Dual document sequencing tables — ambiguous winner | `documentNumberService`, `numberingMaintenanceService` | Consolidate to one sequence table; add uniqueness constraints |
| P2-07 | Rental service posts no JE internally | `rentalService` | Move JE posting inside finalize flow |
| P2-08 | V2 and V3 orders coexist for same sale (backfill race) | `studioProductionV3Service.ensureStudioProductionV3OrdersForCompany` | Add DB uniqueness constraint on `(sale_id, company_id)` on v3 table |

### P3 — Maintainability (Schedule for Refactor Sprint)

| # | Issue | Location | Action |
|---|---|---|---|
| P3-01 | Three studio production versions co-existing | All studio services | Migrate V1/V2 to V3; decouple `workerPaymentService` from V1 |
| P3-02 | `sale_items` / `sales_items` naming inconsistency | `sale_return_items.sale_item_id` FK | Migrate, update FK, drop `sale_items` |
| P3-03 | `movement_type = 'opening'` vs `'adjustment'` inconsistency | `stock_movements` | Normalize all rows to `'adjustment'` (combined with P1-04) |
| P3-04 | `inventory_balance` and `products.current_stock` unverified caches | Schema | Confirm trigger coverage or drop; document definitive status |
| P3-05 | Permission system three-layer split with no unified check | `featureFlagsService`, `ModuleContext`, `permissionEngine` | Create `canUserDo(userId, action)` composing all three layers |
| P3-06 | `currentView` string union 73+ entries, no route validation | `NavigationContext` | Introduce typed route registry; generate union from registry |
| P3-07 | Reconciliation service proliferation (13+ repair services) | `/src/app/services/` | Fix primary transaction paths; retire repair services as gaps close |
| P3-08 | `accounts.balance` column name ambiguous | `accounts` table | Rename to `opening_balance_seed` |
| P3-09 | Legacy ledger tables (`ledger_master`, `ledger_entries`) still in schema | DB schema | Drop after zero-read confirmation |
| P3-10 | `inventory_balance` table bypassed but not dropped | DB schema | Drop or activate with confirmed trigger coverage |
