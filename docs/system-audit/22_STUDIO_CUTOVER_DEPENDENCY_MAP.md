# 22 — Studio Cutover Dependency Map

**Date:** 2026-04-12
**Status:** Evidence-based audit — DO NOT deploy without resolving P1 items

---

## 1. Purpose

This document maps every Studio service version (V0 through V3) to the tables it touches, the journal-entry (JE) paths it owns (or lacks), and the upstream files that import it. The goal is to identify what must be resolved before the legacy services and tables can be safely retired.

---

## 2. Service Inventory

### 2.1 studioProductionService.ts — V1 (LEGACY, still active)

| Dimension | Detail |
|-----------|--------|
| Status | Legacy — still imported by 14 files |
| Tables READ | studio_productions, studio_production_stages, studio_production_logs, sales, sales_items, sale_items, products, workers, contacts, worker_ledger_entries, payments, stock_movements |
| Tables WRITE | studio_productions, studio_production_stages, studio_production_logs, worker_ledger_entries, workers.current_balance, sales, sales_items (insert), sale_items (insert — legacy fallback), stock_movements |
| JE posting | NONE directly; calls workerAdvanceService.applyWorkerAdvanceAgainstNewBill via dynamic import |

**Importers (14):**

| Importer | Reason for import |
|----------|--------------------|
| AccountingContext.tsx | Stage/ledger queries |
| studioProductionInvoiceSyncService.ts | Price sync back to sales |
| workerPaymentService.ts | markStageLedgerPaid, allocateUnpaidStageJobsAfterWorkerPayment |
| StudioDashboardNew.tsx | Dashboard reads |
| StudioSalesListNew.tsx | Sales list reads |
| StudioPipelinePage.tsx | Pipeline UI |
| StudioProductionListPage.tsx | List reads |
| StudioProductionDetailPage.tsx | Detail reads/writes |
| StudioSaleDetailNew.tsx | Sale detail reads |
| AccountingIntegrityLabPage.tsx | Integrity checks |
| WorkerDetailPage.tsx | Worker ledger reads |
| testAccountingService.ts | Test harness |
| addEntryV2Service.ts | Legacy fallback path |
| (14th — see importer grep) | — |

**Risk:** Cannot retire until all 14 importers are migrated to V3 equivalents.

---

### 2.2 studioProductionV2Service.ts — V2

| Dimension | Detail |
|-----------|--------|
| Status | Partial — only used by studioCustomerInvoiceService (which is dead code) |
| Tables READ | studio_production_orders_v2, studio_production_stages_v2, studio_stage_assignments_v2, studio_stage_receipts_v2, sales, studio_productions (migration only), studio_production_stages (migration only) |
| Tables WRITE | studio_production_orders_v2, studio_production_stages_v2, studio_stage_assignments_v2, studio_stage_receipts_v2 |
| JE posting | NONE |

**Importers (3):**

| Importer | Status |
|----------|--------|
| studioCustomerInvoiceService.ts | Dead code — zero importers of the invoice service itself |
| StudioProductionV2Pipeline.tsx | UI only — no financial writes |
| StudioProductionV2Dashboard.tsx | UI only — no financial writes |

**Risk:** Conditionally retirable once studioCustomerInvoiceService is formally removed and V2 UI pages are sunset.

---

### 2.3 studioProductionV3Service.ts — V3 (CURRENT UI)

| Dimension | Detail |
|-----------|--------|
| Status | Active for new orders |
| Tables READ | studio_production_orders_v3, studio_production_stages_v3, studio_production_cost_breakdown_v3, sales (migration only) |
| Tables WRITE | studio_production_orders_v3, studio_production_stages_v3, studio_production_cost_breakdown_v3 |
| JE posting | NONE confirmed — critical accounting gap |

**Importers (3):** StudioProductionV3Pipeline.tsx, StudioProductionV3OrderDetail.tsx, StudioProductionV3Dashboard.tsx

**Risk:** Stage completion in V3 posts NO journal entries. Cost dashboard (studioCostsService) reads V1 tables only and is therefore blind to all V3 activity. This is a P1 accounting gap.

---

### 2.4 studioCustomerInvoiceService.ts — Invoice Bridge (V2 only)

| Dimension | Detail |
|-----------|--------|
| Status | DEAD CODE — zero importers |
| Tables READ | studio_production_orders_v2 (via V2 service), sales, sales_items, sale_items, products, accounts, journal_entries |
| Tables WRITE | studio_production_orders_v2 (update), sales (insert), sales_items/sale_items (insert), products, stock_movements, journal_entries, journal_entry_lines |
| JE posting | YES — Dr AR(1100)/Cr Sales(4000) + Dr COGS(5100)/Cr Inventory(1200); Dr Inventory(1200)/Cr Production Cost(5000) |

**Risk:** This is the only service in the Studio stack that posts correct double-entry JEs for customer invoicing. Because it has zero importers, no Studio order version (V1, V2, or V3) currently produces AR/Revenue journal entries on invoicing. This is a P1 revenue recognition gap.

---

### 2.5 studioProductionInvoiceSyncService.ts — V1 Price Sync

| Dimension | Detail |
|-----------|--------|
| Status | Active — syncs prices back from stages to sale lines |
| Tables READ | sales, sales_items, studio_productions (via V1 service), studio_production_stages (via V1 service) |
| Tables WRITE | sales_items (update price/total), sales (update total, due_amount) |
| JE posting | NONE |
| Imports | studioProductionService (V1) |

**Risk:** Tightly coupled to V1 tables. Does not sync V3 stage data. When V1 is retired this service breaks.

---

### 2.6 studioCostsService.ts — Cost Analytics

| Dimension | Detail |
|-----------|--------|
| Status | Active for cost dashboard |
| Tables READ | journal_entries (reference_type='studio_production_stage'), studio_production_stages (V1), studio_productions (V1), worker_ledger_entries, workers, payments |
| Tables WRITE | NONE |

**Risk:** Reads V1 tables exclusively. V3 stages generate no JEs with reference_type='studio_production_stage', so the cost dashboard shows zero cost for all V3 orders. P1 operational blindness.

---

### 2.7 workerPaymentService.ts

| Dimension | Detail |
|-----------|--------|
| Status | Active |
| Tables READ | accounts (2010, 1180), worker_ledger_entries, journal_entries |
| Tables WRITE | payments, journal_entries, journal_entry_lines, worker_ledger_entries |
| JE posting | YES — Dr 2010 or 1180 / Cr payment account; reference_type='worker_payment' |
| Imports | studioProductionService (V1) for markStageLedgerPaid, allocateUnpaidStageJobsAfterWorkerPayment |

**Risk:** Worker payment JEs are correct, but allocation logic reads V1 stage/ledger data. When V1 is retired, worker payment allocation breaks.

---

### 2.8 workerAdvanceService.ts

| Dimension | Detail |
|-----------|--------|
| Status | Active |
| Tables WRITE | journal_entries, journal_entry_lines |
| JE posting | YES — Dr 2010 / Cr 1180; reference_type='worker_advance_settlement'; action_fingerprint='worker_advance_apply:{stageId}:{billJEId}' |

**Risk:** action_fingerprint references stageId from V1 stages. If stage IDs differ in V3 the idempotency key will be wrong.

---

### 2.9 studioService.ts — V0 (Legacy Order System)

| Dimension | Detail |
|-----------|--------|
| Status | Unknown — requires import graph investigation |
| Tables | studio_orders, studio_order_items, job_cards, workers, contacts, studio_productions, studio_production_stages, worker_ledger_entries |

**Risk:** Writes directly to studio_productions and studio_production_stages — the same V1 tables still used by V1 service. Cross-version contamination.

---

## 3. Account Code Reference

| Code | Account |
|------|---------|
| 1100 | Accounts Receivable |
| 1180 | Worker Advance (asset) |
| 1200 | Inventory |
| 2010 | Worker Payable |
| 4000 | Sales Revenue |
| 5000 | Cost of Production |
| 5100 | Cost of Goods Sold |

---

## 4. JE Coverage Matrix

| Service | Creates JE? | Accounts | Notes |
|---------|------------|---------|-------|
| studioProductionV3Service | NO | — | P1 gap |
| studioProductionV2Service | NO | — | — |
| studioProductionService (V1) | NO (delegates) | — | Calls workerAdvanceService |
| studioCustomerInvoiceService | YES | 1100/4000, 5100/1200, 1200/5000 | Dead code — never called |
| workerPaymentService | YES | 2010 or 1180 / payment acct | Active |
| workerAdvanceService | YES | 2010/1180 | Active |
| studioProductionInvoiceSyncService | NO | — | Price sync only |

---

## 5. Cutover Prerequisites (Summary)

1. **V3 must post JEs on stage completion and customer invoicing** before V1 can be retired.
2. **studioCostsService must be rewritten** to read V3 tables (studio_production_stages_v3, studio_production_cost_breakdown_v3) and corresponding JE reference_types.
3. **studioProductionInvoiceSyncService** must be rewritten or replaced to operate on V3 data.
4. **workerPaymentService** allocation logic (markStageLedgerPaid, allocateUnpaidStageJobsAfterWorkerPayment) must be ported to work with V3 stage IDs.
5. **workerAdvanceService** action_fingerprint schema must accommodate V3 stage IDs.
6. **studioCustomerInvoiceService** must either be wired into V3 invoicing or replaced by equivalent V3 invoice-posting logic before being formally deleted.
7. **All 14 importers of studioProductionService (V1)** must be audited and migrated.
8. **V0 studioService.ts** must be confirmed dormant (no active UI routes) before studio_productions/stages are retired.
