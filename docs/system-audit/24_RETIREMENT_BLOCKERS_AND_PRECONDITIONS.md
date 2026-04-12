# 24 — Retirement Blockers and Preconditions

**Date:** 2026-04-12
**Status:** Evidence-based audit — each item must be resolved before the corresponding table or service is retired

---

## 1. Purpose

This document classifies every legacy table and service by its retirement readiness. Each item is assigned one of three states:

- **CANNOT RETIRE NOW** — active code depends on it; retirement will break production.
- **CONDITIONAL** — can be retired after specific, enumerated preconditions are met.
- **SAFE TO RETIRE** — no active importers or dependents; retirement is low-risk pending confirmation.
- **INVESTIGATE** — usage is unclear; an import-graph audit must be completed before a decision is made.

---

## 2. Item-by-Item Assessment

---

### A. sale_items table

**Status: CANNOT RETIRE NOW**

| Metric | Value |
|--------|-------|
| Files that read sale_items | 14+ |
| Files that write sale_items | 3 active (studioProductionService.ts:710, AccountingIntegrityLabPage.tsx:931/933, studioCustomerInvoiceService.ts:116) |

**Blockers:**
1. studioProductionService.ts:710 writes sale lines to sale_items instead of the canonical sales_items. This must be refactored to write to sales_items.
2. AccountingIntegrityLabPage.tsx:931/933 directly updates sale_items. The integrity lab must be updated to operate on sales_items.
3. All read paths (14+ files) must be audited; any that query sale_items exclusively (instead of UNION with sales_items or sales_items-first) must be migrated.

**Preconditions to retire:**
- [ ] All writes redirected to sales_items.
- [ ] All reads confirmed to use sales_items (or an explicit UNION query that de-duplicates).
- [ ] dashboardService.ts revenue/COGS queries confirmed not to double-count.
- [ ] Data migration: verify no rows exist in sale_items that are absent from sales_items for the same sale.
- [ ] Table can then be renamed to sale_items_archived_YYYYMMDD and dropped after a 30-day observation window.

---

### B. studioProductionService.ts (V1)

**Status: CANNOT RETIRE NOW**

| Metric | Value |
|--------|-------|
| Active importers | 14 |

**Key blockers:**

| Importer | Dependency |
|----------|-----------|
| AccountingContext.tsx | Stage/ledger queries — no V3 equivalent |
| workerPaymentService.ts | markStageLedgerPaid, allocateUnpaidStageJobsAfterWorkerPayment — no V3 equivalent |
| StudioDashboardNew.tsx | Dashboard data reads |
| StudioProductionDetailPage.tsx | Detail page reads and writes |
| AccountingIntegrityLabPage.tsx | Integrity check hooks |

**Preconditions to retire:**
- [ ] V3 service provides equivalent read APIs for all 14 importer use-cases.
- [ ] Worker payment allocation logic (markStageLedgerPaid, allocateUnpaidStageJobsAfterWorkerPayment) ported to V3.
- [ ] AccountingContext.tsx migrated to V3 data sources.
- [ ] studioCostsService rewritten to read V3 tables.
- [ ] studioProductionInvoiceSyncService rewritten for V3.
- [ ] All UI pages (Dashboard, List, Detail, Pipeline) verified on V3 data.

---

### C. studio_productions table (V1)

**Status: CANNOT RETIRE NOW**

**Active dependents:**

| Service | Usage |
|---------|-------|
| studioProductionService.ts | Primary write table |
| studioProductionInvoiceSyncService.ts | Reads via V1 service |
| studioCostsService.ts | Reads directly |
| studioService.ts (V0) | Also writes to this table (cross-version contamination) |

**Preconditions to retire:**
- [ ] studioProductionService.ts retired (see B).
- [ ] studioCostsService rewritten for V3.
- [ ] studioProductionInvoiceSyncService rewritten for V3.
- [ ] studioService.ts (V0) confirmed dormant and its writes removed.
- [ ] Historical data migrated or archived.

---

### D. studioProductionV2Service.ts (V2)

**Status: CONDITIONAL**

**Active importers:**
- studioCustomerInvoiceService.ts (dead code — zero importers of the invoice service itself)
- StudioProductionV2Pipeline.tsx (UI only — no financial writes)
- StudioProductionV2Dashboard.tsx (UI only — no financial writes)

**Preconditions to retire:**
- [ ] studioCustomerInvoiceService.ts formally deleted (see F).
- [ ] V2 UI pages (Pipeline, Dashboard) removed from routing and deleted.
- [ ] Confirm no direct DB access to studio_production_orders_v2 from any other path.

---

### E. studio_production_orders_v2 + studio_production_stages_v2

**Status: CONDITIONAL**

**Preconditions to retire:**
- [ ] studioProductionV2Service.ts retired (see D).
- [ ] studioCustomerInvoiceService.ts deleted (see F).
- [ ] studio_stage_assignments_v2, studio_stage_receipts_v2 also dropped (dependent tables).
- [ ] Historical orders migrated to V3 schema or archived.

---

### F. studioCustomerInvoiceService.ts

**Status: SAFE TO RETIRE**

**Evidence:** Zero importers found in the codebase. The service has never been called from any active code path.

**Note:** This service contains the only correct AR/Revenue JE logic (Dr 1100 / Cr 4000, Dr 5100 / Cr 1200) in the Studio stack. Before deleting it, extract the JE posting logic and wire it into the V3 invoicing flow.

**Preconditions to retire:**
- [ ] JE posting logic extracted and re-implemented in V3 invoice path.
- [ ] V3 invoice path verified to produce correct GL entries.
- [ ] File deleted.

---

### G. contacts.current_balance

**Status: CANNOT RETIRE NOW**

**Active reads:**

| Location | Context |
|----------|---------|
| ContactsPage.tsx:263-272 | Contact list balance display |
| AddEntryV2.tsx:209/220/229/240 | Entry form balance pre-fill |

**Triggers that write it:**
- trigger update_contact_balance_on_sale
- trigger update_contact_balance_on_purchase

**Manual service writes that diverge from trigger logic:**
- studioProductionService.ts:1411/1663/1758/1798/1904

**Preconditions to retire the cached field:**
- [ ] ContactsPage.tsx migrated to use get_contact_party_gl_balances RPC.
- [ ] AddEntryV2.tsx migrated to use get_contact_party_gl_balances RPC.
- [ ] All manual writes in studioProductionService.ts removed.
- [ ] Both triggers dropped after UI migration is verified.
- [ ] Performance of RPC confirmed acceptable at list scale (ContactsPage may load many contacts).
- [ ] Field can then be dropped from the contacts table.

---

### H. inventory_balance table

**Status: CONDITIONAL**

**Evidence:** Zero application code reads this table. It is maintained purely by the trigger trigger_sync_inventory_balance_from_movement.

**Preconditions to retire:**
- [ ] Confirm no reporting tool, BI connector, or external integration reads inventory_balance directly.
- [ ] Drop the trigger first (to prevent errors on stock_movements inserts).
- [ ] Drop the table.
- [ ] Alternatively: promote to active use — rewrite queries to read inventory_balance for performance, add a staleness-check assertion, and document it as the canonical fast-path.

---

### I. products.current_stock field

**Status: CONDITIONAL**

**Evidence:** Actively suppressed — excluded from SELECTs (productService.ts:59) and stripped before writes (productService.ts:206-209). Used only as a display fallback in POS.tsx:339/372.

**Preconditions to retire:**
- [ ] Confirm no financial guard (e.g., oversell prevention) reads products.current_stock.
- [ ] Remove the display fallback from POS.tsx (ensure movement-based totals always load before render, or use a loading state).
- [ ] Remove similar fallback from Dashboard.tsx if present.
- [ ] Drop the column via migration after a 30-day observation window.

---

### J. document_sequences_global table

**Status: CONDITIONAL**

**Evidence:** Still actively used for SL, PUR, PAY, STD document number generation (getNextDocumentNumberGlobal()). documentNumberService.ts:4 notes that PAY refs must use erp_document_sequences only — suggesting the PAY type has already been migrated.

**Preconditions to retire:**
- [ ] Migrate SL, PUR, and STD document types to getNextDocumentNumber() / erp_document_sequences.
- [ ] Verify no sequence gap or duplication occurs during migration (freeze global counter, seed erp counter from its last value + 1).
- [ ] Remove all calls to getNextDocumentNumberGlobal().
- [ ] Drop the table.

---

### K. worker_ledger_entries

**Status: CANNOT RETIRE NOW**

**Active dependents:**

| Service | Usage |
|---------|-------|
| studioProductionService.ts (V1) | Writes stage job ledger entries |
| workerPaymentService.ts | Reads for payment allocation |
| studioCostsService.ts | Reads as fallback when JEs are absent |

**Preconditions to retire:**
- [ ] V3 service provides equivalent worker ledger functionality (or the pattern is replaced by JE-based worker tracking).
- [ ] workerPaymentService allocation logic migrated to V3 or JE-based pattern.
- [ ] studioCostsService no longer falls back to this table.

---

### L. studio_orders + studio_order_items (V0)

**Status: INVESTIGATE**

**Evidence:** studioService.ts (V0) reads and writes studio_orders, studio_order_items, job_cards, and also writes to studio_productions and studio_production_stages (contaminating V1 tables).

**Required investigation:**
- [ ] Confirm whether any active UI route resolves to a component that calls studioService.ts.
- [ ] Run `grep -r "studioService" --include="*.tsx" --include="*.ts"` to identify all importers.
- [ ] If dormant: remove all studioService.ts imports, then drop studio_orders and studio_order_items.
- [ ] If active: document the use-case and migrate to V3 before V0 retirement.

---

## 3. Retirement Dependency Graph

The following order must be respected to avoid breaking production during retirement:

```
1. Fix P1 gaps FIRST (no order-dependency among these):
   - Add JE posting to V3 stage completion and V3 invoicing
   - Add JE posting to finalizePurchaseReturn
   - Migrate contacts.current_balance UI reads to GL RPC
   - Eliminate sale_items legacy writes

2. Once V3 is accounting-complete:
   - Retire studioCustomerInvoiceService.ts (F) — after extracting JE logic to V3
   - Migrate studioCostsService to V3 tables

3. Once all 14 V1 importers are migrated:
   - Retire studioProductionService.ts (B)
   - Retire studioProductionInvoiceSyncService.ts

4. Once B is retired:
   - Retire studio_productions table (C)
   - Retire studio_production_stages table
   - Retire worker_ledger_entries (K) — if V3 uses JE-based worker tracking

5. Once D preconditions met:
   - Retire studioProductionV2Service.ts (D)
   - Retire studio_production_orders_v2 schema (E)

6. Final cleanup (order-independent after above):
   - Drop contacts.current_balance field (G)
   - Drop inventory_balance table or promote (H)
   - Drop products.current_stock column (I)
   - Migrate document_sequences_global (J)
   - Eliminate sale_items table (A)
   - Resolve V0 studio_orders investigation (L)
```

---

## 4. P1 Blocking Items — At a Glance

| # | Item | Blocker Description |
|---|------|-------------------|
| A | sale_items legacy writes | Double-count risk in dashboard; incorrect data in legacy table |
| B | studioProductionService V1 | 14 importers; no V3 equivalent for all use-cases |
| C | studio_productions V1 table | Written by V1, V0, read by cost service |
| G | contacts.current_balance | UI reads stale cache; 5 manual writes bypass GL |
| purchase_return JE | finalizePurchaseReturn | No GL entry ever posted; AP/Inventory misstated |
| V3 JE gap | studioProductionV3Service | Stage completion and invoicing produce no accounting entries |
