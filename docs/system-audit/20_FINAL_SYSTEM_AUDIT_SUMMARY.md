# 20 — Final System Audit Summary

_Audit date: 2026-04-12. Stack: Next.js 14 + Supabase (multi-tenant, PostgreSQL). Auditor: Claude Sonnet 4.6 via Claude Code._

---

## Audit Overview

| Item | Detail |
|---|---|
| **Date** | 2026-04-12 |
| **Scope** | Full ERP — all modules from onboarding to financial reporting |
| **Method** | Static analysis of service files, component files, migration files, and DB schema; cross-reference of business logic against double-entry accounting rules; bug identification with root-cause analysis and fix verification |
| **Service files examined** | 117 (in `/src/app/services/`) |
| **Component directories examined** | 37 |
| **Migrations examined** | 258 |
| **Audit documents produced** | 20 (docs 00 through 20) |
| **Modules covered** | Sales, Sale Returns, Purchases, Purchase Returns, Payments & Receipts, Accounting/GL, Inventory, Products, Contacts, Rentals, Studio Production (V1/V2/V3), Expenses, POS, Settings, Users/Permissions, Dashboard/Reports |

---

## System Architecture Assessment

The NEWPOSV3 ERP is a well-structured multi-tenant Next.js application with a clearly articulated double-entry accounting philosophy: all financial truth resides in `journal_entries` + `journal_entry_lines`; operational tables (`sales`, `purchases`, `contacts`) are document caches only. This separation of concerns is codified in `accountingCanonicalGuard.ts` and consistently enforced in the newer service paths. The payment mutation framework (PF-14) is particularly sophisticated, providing append-only audit trails with composite chain reversals.

The primary architectural weakness is that the transaction paths (sale, purchase, return, expense) post their accounting journal entries asynchronously using fire-and-forget patterns, meaning a GL failure is invisible to the user and leaves the system in a split state where the operational document is final but the GL is silent. A secondary structural risk is the accumulation of three co-existing Studio Production versions whose cost data is not cross-visible, creating invisible blind spots in the cost dashboard. Both issues are localized and fixable without architectural rewrites.

---

## Module Health Scorecard

| Module | Status | One-Line Finding |
|---|---|---|
| Sales | YELLOW | Core logic sound; COGS JE is fire-and-forget and uses static `cost_price` rather than weighted average |
| Sale Returns | GREEN | Discount propagation bug FIXED; qty validation draft-pollution bug FIXED; JEs and stock economics are correct |
| Purchases | YELLOW | Core logic sound; JE posting is fire-and-forget; no weighted average cost update on receipt |
| Purchase Returns | RED | No journal entry posted on finalize; draft-pollution qty validation bug present (same as unfixed sale return bug) |
| Payments & Receipts | YELLOW | PF-14 framework is sophisticated; orphan-payment-without-JE failure mode exists; FIFO epsilon can create micro ghost balances |
| Accounting / GL | GREEN | Double-entry framework correct; fingerprint idempotency effective; `accountingCanonicalGuard` enforces source-of-truth rules |
| Inventory | YELLOW | `stock_movements` append-only ledger is correct; `movement_type='opening'` rows excluded from GL sync; no GL entries for manual adjustments |
| Products | YELLOW | Product master correct; `products.current_stock` is an unverified cache; static `cost_price` not updated on purchase receipts |
| Contacts | YELLOW | Contact master correct; `contacts.current_balance` is a divergence-prone cache — reads should be eliminated |
| Rentals | YELLOW | Core CRUD and status lifecycle correct; GL JE not posted internally — relies on external accounting context layer |
| Studio Production | RED | Three co-existing versions; V3 posts no JEs on stage completion; V3 costs invisible to cost dashboard; V1/V2 tables required by worker payment service |
| Expenses | YELLOW | Core logic sound; JE posting is fire-and-forget; pending-expense detection requires reconciliation service |
| POS | YELLOW | Sale flow and cart logic functional; accounting JE is fire-and-forget; no offline / idempotency guarantee for payment |
| Settings | GREEN | Chart of accounts, branch, and document sequence management are correct; dual sequence table ambiguity is a medium risk |
| Users / Permissions | YELLOW | Three-layer permission system (FeatureFlags, ModuleContext, PermissionEngine) has no unified check function; no atomic deny-all path |
| Dashboard / Reports | GREEN | Trial Balance, P&L, and Balance Sheet read from `journal_entry_lines` directly with no operational shortcuts; dashboard KPIs use documented operational shortcuts with known staleness |

---

## Critical Findings (P1 — Data Integrity Risks)

### P1-01: Purchase Return Posts No Journal Entry on Finalize

**Finding:** `purchaseReturnService.finalizePurchaseReturn()` writes stock movements (qty OUT) and fires `recalc_purchase_payment_totals` but never posts a journal entry. The AP subledger and Inventory account (1200) are not updated in the GL.

**Impact:** Every finalized purchase return overstates both Accounts Payable (2000) and Inventory (1200) on the Balance Sheet by the return amount. The discrepancy grows with every return. AP subledger reconciliation will show a structural gap equal to the sum of all purchase return totals.

**Location:** `src/app/services/purchaseReturnService.ts` — `finalizePurchaseReturn()`

**Recommended fix:** Add `Dr AP subledger / Cr Inventory (1200)` JE inside `finalizePurchaseReturn`, posted with fingerprint `'purchase_return_document:{companyId}:{returnId}'` for idempotency, immediately after status is claimed and before stock movements are written.

---

### P1-02: Fire-and-Forget Journal Entry Posting (Sales, Purchases, Expenses, POS)

**Finding:** All primary transaction paths post their GL journal entries using `.catch(err => console.error(...))` or `void promise` patterns. A JE failure is invisible to the calling user; the operational document is marked final while the GL has no entry.

**Impact:** The Trial Balance can undercount revenue, undercount COGS, or understate expenses for any period in which a JE insertion failed. The divergence is detectable only through reconciliation queries comparing document totals to JE sums by reference type.

**Location:** `src/app/services/saleAccountingService.ts`, `purchaseAccountingService.ts`, `expenseService.ts`, POS settlement path

**Recommended fix:** Await all JE posting calls. On failure, either rollback the document to draft status, or set `accounting_pending = true` on the document row and process via an async retry queue.

---

### P1-03: Studio V3 Posts No Journal Entry on Stage Completion

**Finding:** `studioProductionV3Service.completeStage()` updates `actual_cost` and recalculates `production_cost` but posts no JE. The V1 billing JE (`Dr Cost of Production 5000 / Cr Worker Payable 2010`) is only posted by the legacy `studioProductionService`.

**Impact:** Worker Payable (2010) is understated for all V3 assignments. `studioCostsService.getStudioCostsFromJournal()` returns zero cost for V3 companies. The P&L understates production costs. Workers appear unpaid in the ledger regardless of actual payment.

**Location:** `src/app/services/studioProductionV3Service.ts` — `completeStage()`; `src/app/services/studioCostsService.ts` — `getProductionCostSummaries()`

**Recommended fix:** Post `Dr 5000 / Cr 2010` JE inside `completeStage()` with fingerprint `'studio_v3_stage_complete:{companyId}:{stageId}'`. Then update `getProductionCostSummaries()` to read V3 stage tables.

---

### P1-04: Opening Stock via `movement_type = 'opening'` Has No GL Entry

**Finding:** Legacy and import-created stock movements with `movement_type = 'opening'` are excluded from `syncOpeningJournalIfApplicable` which only triggers for `movement_type = 'adjustment'`. These rows create stock quantity without a corresponding Inventory (1200) debit.

**Impact:** The Balance Sheet Inventory balance understates assets by the value of all such rows. Opening Balance Equity (3000) is also understated by the same amount. The discrepancy is permanent unless a retroactive GL sync is run.

**Location:** `src/app/services/inventoryService.ts` — `syncOpeningJournalIfApplicable()`; `stock_movements` table

**Recommended fix:** Data migration — update all `movement_type = 'opening'` rows to `movement_type = 'adjustment'` where `reference_type = 'opening_balance'`. Then call `syncInventoryOpeningFromStockMovementId` for each affected row.

---

### P1-05: Worker Account Codes Hardcoded — Missing Account is a Hard Error

**Finding:** `workerPaymentService.createWorkerPayment()` throws `'Worker Advance account (1180) not found'` if account code 1180 is absent. The Worker Payable lookup uses an OR on code 2010 and name pattern — if code 2010 is assigned to a different account, the wrong GL account is debited.

**Impact:** Worker payments fail entirely for any company that has not run the accounts migration. If code 2010 maps to a different account, worker payment JEs debit the wrong liability account — producing a misclassified P&L and corrupted worker payable balance.

**Location:** `src/app/services/workerPaymentService.ts`, `src/app/services/workerAdvanceService.ts`

**Recommended fix:** Add pre-flight check during company onboarding that ensures accounts 1180 and 2010 exist. Add a fallback that creates them from `defaultAccountsService` rather than throwing.

---

### P1-06: Purchase Return Draft Pollution — Quantity Validation Bug (Unfixed)

**Finding:** `finalizePurchaseReturn` queries `purchase_return_items` without filtering on `purchase_returns.status = 'final'`. Abandoned draft returns permanently consume returnable quantity for that product.

**Impact:** Users receive "Return qty exceeds purchased qty" errors for valid quantities when a draft return exists. The only fix is manual DB deletion of the blocking draft. The UI form shows more available quantity than the backend allows (form uses `status='final'` filter but backend does not).

**Location:** `src/app/services/purchaseReturnService.ts` — `finalizePurchaseReturn()` quantity validation block

**Recommended fix:** Pre-fetch `purchase_return_ids WHERE status = 'final'` for the original purchase, then count `purchase_return_items` only within those IDs. Mirror the fix already applied to `saleReturnService`.

---

## High Priority Findings (P2 — Accuracy Risks)

### P2-01: Sale COGS Uses Static `product.cost_price`, Not Weighted Average

**Finding:** The COGS journal entry at point of sale uses `products.cost_price` — a static field set at product creation, not updated on purchase receipts. Stock movement `unit_cost` captures actual purchase cost but is not used in the COGS JE.

**Impact:** If a product's purchase price changes over time, the P&L gross margin is misstated. COGS reflects the original setup cost, not the actual cost of goods sold. The error compounds in volatile-cost product categories.

**Location:** `src/app/services/saleAccountingService.ts` COGS computation; `src/app/services/productService.ts` purchase receipt path

**Recommended fix:** Implement weighted average cost update on each purchase receipt. Use the computed weighted average as the COGS basis at point of sale.

---

### P2-02: `contacts.current_balance` Cache Diverges Silently

**Finding:** `contacts.current_balance` is a denormalized AR/AP balance cache that diverges from the GL whenever payment allocation JEs fail silently, manual journals touch subledger accounts directly, or opening balance corrections are posted.

**Impact:** Any UI component reading `current_balance` shows incorrect customer/supplier exposure. Credit limit checks and dunning decisions based on this field are unreliable.

**Location:** `contacts` table; all UI paths that read `contacts.current_balance`

**Recommended fix:** Audit all reads via `accountingCanonicalGuard`; replace with `effectivePartyLedgerService` balance query; remove the column.

---

### P2-03: FIFO Payment Allocation Epsilon Creates Ghost Micro-Balances

**Finding:** `computeFifoAllocationPlan` skips invoices with `due_amount < 0.02` (epsilon). Rounding in allocation computation (`Math.round(take * 100) / 100`) leaves sub-cent residuals that accumulate in the `unapplied` bucket across many allocation cycles.

**Impact:** Ghost "unapplied credit" amounts pollute the AR subledger. Reconciliation reports show non-zero unapplied balances for customers who have fully paid all invoices.

**Location:** `src/app/services/paymentAllocationService.ts` — `computeFifoAllocationPlan()`

**Recommended fix:** Reduce epsilon to `0.001`. After all FIFO allocations, if `remaining < 0.005`, force-allocate the residual to the last invoice.

---

### P2-04: Two Studio Versions Produce Duplicate Records for Same Sale

**Finding:** `ensureStudioProductionV3OrdersForCompany` creates V3 orders for all `STD-*` sales without checking for existing V2 orders. Companies with V2 orders end up with both a V2 and a V3 order for the same sale, each with different cost data.

**Impact:** `studioCostsService` counts V2 costs; V3 costs are silently ignored. The cost dashboard understates production costs by the V3 amount.

**Location:** `src/app/services/studioProductionV3Service.ts` — `ensureStudioProductionV3OrdersForCompany()`

**Recommended fix:** Add DB uniqueness constraint on `studio_production_orders_v3(sale_id, company_id)`. Add a pre-check for V2 order existence before creating V3 counterpart.

---

### P2-05: Rental Service Relies on External Layer for GL Posting

**Finding:** `rentalService` does not post GL entries internally. JE creation is delegated to `AccountingContext`. If a rental is finalized via any path other than the UI context, no GL entry is created.

**Impact:** Rental revenue is missing from the Trial Balance for any rental that bypassed the UI accounting context (e.g. batch import, direct API call, test environment).

**Location:** `src/app/services/rentalService.ts`

**Recommended fix:** Move JE posting inside `rentalService.finalizeRental()` with fingerprint idempotency.

---

### P2-06: Orphan Payment Without JE — No Compensating Transaction

**Finding:** If `accountingService.createJournalEntry` throws after the `payments` row is inserted, the system has a payment with no GL entry. No rollback runs; no `accounting_pending` flag is set.

**Impact:** The payments table (Roznamcha) shows a receipt that never hit the GL. Cash book and Trial Balance diverge. Detection requires the query: `SELECT p.id FROM payments p WHERE voided_at IS NULL AND NOT EXISTS (SELECT 1 FROM journal_entries je WHERE je.payment_id = p.id AND je.is_void = false)`.

**Location:** `src/app/services/addEntryV2Service.ts`, `src/app/services/supplierPaymentService.ts`, payment creation paths

**Recommended fix:** Wrap `payments` insert + JE insert in a Supabase database function (RPC) that runs in a single transaction. Until that is possible, add a cleanup job that detects orphan payments and either re-posts the JE or marks the payment void.

---

## Medium Priority Findings (P3 — Maintainability)

### P3-01: Three Studio Production Versions Co-existing

All three studio versions (V1, V2, V3) are active simultaneously. `workerPaymentService` imports V1 functions. `studioCustomerInvoiceService` is V2-only. V3 is the active creation path but lacks accounting integration. Removing any version risks breaking the others.

**Location:** `studioProductionService.ts`, `studioProductionV2Service.ts`, `studioProductionV3Service.ts`, `workerPaymentService.ts`

**Recommended fix:** Migrate all in-progress V2 orders to V3. Decouple `workerPaymentService` from V1 tables. Update `studioCustomerInvoiceService` for V3. Retire V1 and V2 services.

---

### P3-02: `sale_items` / `sales_items` Naming Inconsistency

Two tables serve the same purpose. The `sale_return_items.sale_item_id` FK is defined against the legacy `sale_items` table, causing FK violations for items stored in the canonical `sales_items` table.

**Location:** `sale_items` and `sales_items` tables; `sale_return_items.sale_item_id` FK

**Recommended fix:** Migrate `sale_items` data to `sales_items`, update the FK, drop `sale_items`.

---

### P3-03: `currentView` String Union Has 73+ Entries with No Route Validation

The `NavigationContext` accepts any string as `currentView` with no validation. Invalid values silently render nothing.

**Location:** `src/app/context/NavigationContext` (or equivalent)

**Recommended fix:** Create a typed route registry; derive the string union from it; add a dev-mode runtime guard that warns on unknown values.

---

### P3-04: Permission System Has Three Separate Layers

FeatureFlags, ModuleContext, and PermissionEngine each enforce access independently with no unified `canUserDo(action)` function.

**Location:** `featureFlagsService.ts`, `ModuleContext`, `permissionEngine.ts`

**Recommended fix:** Create a composed `canUserDo(userId, companyId, action)` function that checks all three layers in sequence and returns a single boolean.

---

### P3-05: Reconciliation Service Proliferation (13+ Services)

Thirteen or more services exist solely to detect and repair data inconsistencies produced by fire-and-forget failures in primary transaction paths.

**Location:** `/src/app/services/` — all `*Reconciliation*`, `*Repair*`, `*TieOut*`, `*Integrity*` services

**Recommended fix:** Fix the primary failure modes (P1-01, P1-02, P1-09) so repair services are no longer needed; retire them as gaps close.

---

## Completed Fixes (Already Done in Prior Sessions)

### Task 3: Sale Return Discount Propagation Bug (FIXED)

**Component:** `SaleReturnForm.tsx`

**Symptom:** Return total was computed on gross item price regardless of original sale discount. Customers received more credit than they were entitled to on discounted invoices.

**Root cause:** `discountAmount` state was initialized to `0` with no `useEffect` to propagate from the original sale.

**Fix applied:** Added a `useEffect` watching `returnSubtotal` that sets `discountAmount = originalSale.discount_amount * (returnSubtotal / originalSale.subtotal)`.

**DB repair:** Applied retroactive correction for company `595c08c2` to recalculate affected return totals.

---

### Task 4: Sale Return Quantity Validation Draft Pollution Bug (FIXED)

**Component:** `saleReturnService.ts` — `finalizeSaleReturn()`

**Symptom:** "Return quantity exceeds original quantity" error thrown when an abandoned draft return existed for the same items, blocking valid return attempts.

**Root cause:** `alreadyReturned` count was computed from all `sale_return_items` without filtering on `sale_returns.status = 'final'`, so draft returns inflated the count.

**Fix applied:** Two-step fix — (1) pre-fetch `finalReturnIds` filtering `status = 'final'`; (2) count `sale_return_items` only within `finalReturnIds`. Sentinel UUID `'00000000-0000-0000-0000-000000000000'` used when list is empty to avoid PostgREST `.in([])` parse error.

---

## Recommended Next Steps

### Immediate (Block production revenue close until resolved)

1. **Wire JE into `finalizePurchaseReturn`** (P1-01). Every day this is not fixed adds unrecorded AP credits and inventory write-downs to the Balance Sheet.
2. **Await all fire-and-forget JE calls** (P1-02). Start with the sale posting path — highest volume and highest revenue materiality.
3. **Add account pre-flight check to onboarding** for worker accounts 1180 and 2010 (P1-05). Any company onboarding without these accounts will have broken worker payments.

### Short-term Sprint (Within next release cycle)

4. **Fix purchase return draft pollution** (P1-06) — mirror the already-completed sale return fix.
5. **Post JE inside `studioProductionV3Service.completeStage()`** (P1-03) and update `studioCostsService` to read V3 tables.
6. **Run data migration** for `movement_type = 'opening'` → `'adjustment'` with retroactive GL sync (P1-04).
7. **Implement weighted average cost update on purchase receipt** and use it for COGS JE at point of sale (P2-01).

### Medium-term Refactor

8. **Consolidate studio production to V3 only.** Migrate V2 orders, decouple worker payment service from V1 tables, retire V1 and V2 services.
9. **Audit and eliminate all `contacts.current_balance` reads.** Remove column.
10. **Consolidate document sequence tables** to a single source. Add uniqueness constraints on `reference_number`.
11. **Move rental GL posting inside `rentalService`** (P2-05).
12. **Create unified `canUserDo()` permission check** composing all three permission layers.

### Long-term Maintenance

13. **Retire `customer-ledger-modern-original`** and redirect to `EffectivePartyLedgerPage`.
14. **Convert `currentView` to a typed route registry** with dev-mode validation.
15. **Drop legacy tables** (`ledger_master`, `ledger_entries`, `backup_cr`, `backup_pf145`) after confirming zero active reads.
16. **Retire reconciliation and repair services** as primary path failures are eliminated.

---

## Source of Truth Summary

The canonical source of truth for all financial figures in this system is `journal_entries` joined to `journal_entry_lines` joined to `accounts`. Every GL balance — AR, AP, Cash, Bank, Inventory, Revenue, COGS, Equity — must be derived by summing debit and credit lines on the appropriate account code filtered to `is_void = false`. Operational tables (`sales.total`, `purchases.total`, `expenses.amount`, `contacts.current_balance`, `accounts.balance`, `inventory_balance`) are document-level caches and opening-balance seeds only; they are never authoritative for financial reporting. The `accountingCanonicalGuard` service codifies this rule and enforces it in code via `assertGlTruthQueryTable`, `warnLegacyRead`, and `LEGACY_TABLE_BLOCKLIST`. Stock quantity is similarly grounded in `stock_movements` — not `products.current_stock` or `inventory_balance` — with `SUM(quantity)` per product/variation/branch being the only reliable figure. The primary threat to source-of-truth integrity is the fire-and-forget JE posting pattern in transaction services, which can leave operational documents in a final state with no corresponding GL entry; closing this gap is the highest-priority remediation in this audit.

---

## Glossary of Key Concepts

**action_fingerprint**
A unique string stored on a `journal_entries` row that prevents duplicate JE insertion. Protected by a DB partial index `idx_journal_entries_fingerprint_active` on `(action_fingerprint) WHERE action_fingerprint IS NOT NULL AND is_void IS NOT TRUE`. Format is typically `'{event_type}:{companyId}:{documentId}'`. If the same fingerprint is inserted twice, the second insert returns the existing row rather than creating a duplicate. Any JE without a fingerprint can be duplicated by retry or network error.

**source-owned JE**
A journal entry that is created inside the service method that owns the business event — e.g., `finalizeSaleReturn` posting the COGS reversal JE inside its own transaction. This is the preferred pattern because the JE lifecycle is coupled to the document lifecycle. Contrast with "fire-and-forget JE" (a `.catch()` pattern) or "externally-posted JE" (the calling UI layer creates the JE after the service returns).

**retail inventory method**
The stock valuation approach used in this system for sale movements. When a sale is posted, `stock_movements.unit_cost` is set to the selling price (not the purchase cost), and `total_cost` is the negative selling price total. This means `SUM(stock_movements.total_cost)` across all movement types gives net retail value flow, not COGS. The actual purchase cost is stored in `products.cost_price` (static) and `stock_movements.unit_cost` on purchase-type movements (actual). Cost-based COGS reporting requires joining movement quantities to `products.cost_price` or a computed weighted average from purchase receipts.

**party subledger account**
A child `accounts` row created per contact (customer or supplier) under the AR control account (1100) or AP control account (2000). The row carries `accounts.linked_contact_id = contact.id`. All JEs for that party (sales, receipts, returns, opening balances) post to this child account. The party's running balance is `SUM(debit) - SUM(credit)` on all JE lines where `account_id` matches the child account. `effectivePartyLedgerService` resolves this balance and collapses PF-14 mutation chains for display.

**PF-14 (Payment Mutation Chain)**
The framework governing payment edits and reversals. A "chain" consists of: (1) the original payment JE with `payment_id` set; (2) zero or more `payment_adjustment` JEs representing amount or account changes, also carrying the same `payment_id`; (3) an optional `correction_reversal` JE that offsets the full effective amount. Only the tail (most recent non-void, non-reversal JE in the chain) can be edited or reversed — the `paymentChainMutationGuard` enforces this. The `paymentChainCompositeReversal` service builds a single reversal JE based on `payments.amount` (the current effective amount) rather than just mirroring the tail JE lines.

**movement_type**
The classification of a stock movement row. Key values: `'sale'` (stock OUT at sale), `'sale_return'` (stock IN on return), `'sale_return_void'` (stock OUT when a return is voided), `'purchase'` (stock IN on receipt), `'purchase_return'` (stock OUT to supplier), `'purchase_return_void'` (stock IN when purchase return is voided), `'adjustment'` (manual adjustment or opening balance — distinguished by `reference_type`), `'opening'` (legacy import path — does NOT trigger GL sync), `'transfer'` (branch-to-branch, two rows). The canonical opening-balance path uses `movement_type = 'adjustment'` with `reference_type = 'opening_balance'`.

**reference_type**
A string on `journal_entries` and `stock_movements` that identifies the source business event. Key values for JEs: `'sale'`, `'purchase'`, `'sale_return'`, `'purchase_return'`, `'payment'`, `'expense'`, `'rental'`, `'studio_production_stage'`, `'opening_balance'`, `'opening_balance_contact_ar'`, `'opening_balance_contact_ap'`, `'payment_adjustment'`, `'correction_reversal'`. The `voidSaleReturn` function, for example, discovers both the settlement and COGS JEs by querying `reference_type = 'sale_return'` — this is why both JEs must use the same reference type.
