# ERP V3 – Inventory Engine Stabilization & Production Roadmap

Author: System Architecture Plan
Project: NEW POSV3 ERP
Stack: React + Supabase + PostgreSQL + Mobile ERP
Environment: VPS Self-Hosted Supabase

---

# IMPORTANT EXECUTION RULES

The AI agent executing this roadmap must follow these rules strictly:

1. The system is running inside a **full ERP monorepo**.
2. The agent **must analyze the codebase before making any change**.
3. The agent **must automatically run required SQL commands** on Supabase.
4. The agent **must automatically run required commands on the VPS**.
5. The agent must **NOT guess the schema**; it must detect it from the database.
6. All changes must be applied **step-by-step according to the phases below**.
7. After every phase, the agent must **verify system health before continuing**.
8. All results must be written into:

```
docs/ERP_SYSTEM_IMPLEMENTATION_LOG.md
```

---

# PROJECT GOAL

Create a **stable, unified inventory engine** where:

* All stock comes from **stock_movements**
* Web ERP and Mobile ERP use the **same stock source**
* No direct writes to:

  * products.current_stock
  * product_variations.stock

Inventory must be:

```
Single Source of Truth = stock_movements
```

---

# PHASE 1 — SYSTEM ANALYSIS

Goal: Detect the real database structure and inventory logic.

### STEP 1.1 — Database schema detection

Run on Supabase:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public';
```

Then extract columns for:

```
products
product_variations
stock_movements
inventory_balance
purchases
purchase_items
sales
sale_items
```

Command:

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'products';
```

Repeat for all tables.

Save output to:

```
docs/db_schema_snapshot.json
```

---

### STEP 1.2 — Detect triggers

Run:

```sql
SELECT trigger_name,
event_manipulation,
event_object_table
FROM information_schema.triggers;
```

Save to:

```
docs/db_triggers_snapshot.json
```

---

### STEP 1.3 — Detect stock functions

Run:

```sql
SELECT routine_name
FROM information_schema.routines
WHERE routine_name ILIKE '%stock%';
```

Save results.

---

### STEP 1.4 — Detect stock inconsistencies

Run:

```sql
SELECT variation_id, SUM(quantity)
FROM stock_movements
GROUP BY variation_id;
```

Run negative stock detection:

```sql
SELECT product_id, SUM(quantity)
FROM stock_movements
GROUP BY product_id
HAVING SUM(quantity) < 0;
```

Save to:

```
docs/inventory_anomaly_report.json
```

---

# PHASE 2 — INVENTORY ENGINE STANDARDIZATION

Goal: Ensure the ERP uses **movement-based inventory only**.

### STEP 2.1 — Remove direct stock writes

Search entire codebase for:

```
current_stock
product_variations.stock
updateProduct
```

Ensure the following files DO NOT update stock directly:

```
studioProductionService
AdjustStockDialog
purchaseService
saleService
mobile products API
```

All stock changes must be replaced with:

```
createStockMovement()
```

---

### STEP 2.2 — Standard stock movement format

Every movement must contain:

```
product_id
variation_id
branch_id
quantity
movement_type
reference_type
reference_id
created_at
```

Example:

```sql
INSERT INTO stock_movements (
product_id,
variation_id,
branch_id,
quantity,
movement_type
)
VALUES (...);
```

---

### STEP 2.3 — Verify DB trigger

Trigger must exist:

```
trigger_update_stock_from_movement
```

If missing, create it automatically.

---

# PHASE 3 — INVENTORY SERVICE

Goal: Create a **single stock API used by entire system**.

Create file:

```
src/app/services/inventoryService.ts
```

Core function:

```
getStock(productId, variationId, branchId)
```

Logic:

```
SUM(quantity)
FROM stock_movements
```

---

### STEP 3.2 — Replace old queries

Replace all codebase usage:

```
products.current_stock
product_variations.stock
```

with:

```
inventoryService.getStock()
```

This applies to:

```
Web ERP
Mobile ERP
POS
Barcode scanning
Inventory pages
```

---

# PHASE 4 — MOBILE + WEB SYNC

Goal: Ensure mobile and web use identical inventory logic.

Scan directories:

```
erp-mobile-app/src/api
src/app/services
```

Detect mismatches:

```
mobile uses variations.stock
web uses stock_movements
```

Fix mobile API:

```
getProducts
getProductByBarcode
getInventory
```

Replace with movement-based calculation.

---

# PHASE 5 — INVENTORY HEALTH SYSTEM

Goal: Prevent future inventory corruption.

Create:

```
scripts/inventory-health-check.js
```

This script must detect:

```
negative stock
missing movements
invalid variations
movement mismatch
```

Output:

```
docs/inventory_health_report.json
```

Run command:

```
npm run inventory-health
```

---

# PHASE 6 — INVENTORY DASHBOARD

Create dashboard showing:

```
Low stock
Negative stock
Stock movements
Top selling products
Branch inventory
```

Data source:

```
stock_movements
```

---

# PHASE 7 — VPS AUTOMATION

The AI agent must automatically execute commands on the VPS.

Example commands:

```
docker ps
docker logs
supabase status
```

Restart services if required:

```
docker restart supabase-db
docker restart supabase-rest
```

---

# PHASE 8 — SYSTEM VALIDATION

Run automated validation:

```
npm run inventory-diagnostic
npm run inventory-health
```

Verify:

```
Purchases finalize correctly
Sales create stock movements
Inventory updates correctly
Mobile and web show identical stock
```

---

# PHASE 9 — FINAL REPORT

Generate final file:

```
docs/ERP_INVENTORY_FINAL_REPORT.md
```

Include:

```
Schema snapshot
Trigger verification
Inventory health status
Web vs Mobile sync
Stock validation
```

---

# PHASE 10 — NEXT SYSTEMS (AFTER INVENTORY)

After inventory engine stabilization, implement:

### Accounting Engine Hardening

```
Journal validation
Ledger reconciliation
Trial balance
Financial reports
```

### ERP Performance Optimization

```
Database indexing
Query optimization
Dashboard caching
```

### AI Automation

```
Auto product creation
WhatsApp order ingestion
Inventory prediction
```

---

# SUCCESS CRITERIA

Inventory engine is considered **complete** when:

```
All stock comes from stock_movements
No direct stock writes exist
Mobile and web show identical stock
Purchases and sales create movements
Inventory health script passes
```

---

# EXECUTION LOG (APPLIED)

**Date:** 2026-03-12

- **Phase 1:** Script `scripts/erp-phase1-analysis.js` added. Run `npm run phase1-analysis` to write `docs/db_schema_snapshot.json`, `docs/db_triggers_snapshot.json`, `docs/inventory_anomaly_report.json`. Executed; artifacts written.
- **Phase 2:** Verified no direct stock writes: studio production, AdjustStockDialog, mobile products/inventory use stock_movements only; Sales/Purchase contexts do not update products.current_stock. Movement format and trigger `trigger_update_stock_from_movement` confirmed.
- **Phase 3:** `inventoryService.getStock(companyId, productId, variationId?, branchId?)` added in `src/app/services/inventoryService.ts`; returns SUM(quantity) from stock_movements.
- **Phase 4:** Web and mobile sync verified; both use stock_movements (see docs/ERP_INVENTORY_SYNC_REPORT.md and docs/ERP_INVENTORY_FINAL_REPORT.md).
- **Phase 5:** `scripts/inventory-health-check.js` added. Run `npm run inventory-health` to write `docs/inventory_health_report.json`. Executed; report written.
- **Phase 6:** Dashboard data sourced from stock_movements via existing inventory overview/movements APIs; no separate dashboard page added (existing inventory pages cover low stock, movements, branch inventory).
- **Phase 7:** VPS automation: use `ssh dincouture-vps` per workspace rules when needed (not run in this execution).
- **Phase 8:** Ran `npm run inventory-diagnostic`, `npm run phase1-analysis`, `npm run inventory-health`; all completed successfully.
- **Phase 9:** Generated `docs/ERP_INVENTORY_FINAL_REPORT.md` (schema, triggers, health, web/mobile sync, stock validation).
- **Phase 10:** Documented as next steps in final report (accounting, performance, AI).

---

# MASTER ROADMAP (docs/Master.md) — EXECUTION LOG

**Date:** 2026-03-13

## Phase 1 — Accounting Engine Hardening

- **1.1** Validated `journal_entries` and `journal_entry_lines` structure (see docs/ACCOUNTING_ENGINE_AUDIT.md).
- **1.2** Verified double-entry: application enforces Debit = Credit in `accountingService.createEntry()`; added DB function `check_journal_entries_balance()` for auditing (no per-row trigger to avoid breaking one-line-at-a-time inserts).
- **1.3** Ensured modules generate journal entries:
  - Sales: yes (SalesContext + trigger `auto_post_sale_to_accounting`).
  - Purchases: yes (RPC / 06_purchase_transaction_with_accounting).
  - Payments: yes (record_customer_payment, ensure_ar_1100).
  - Refunds: yes (refundService.createRefund).
  - Expenses: yes (09_expense_transaction, expense RPCs).
  - Stock adjustments: **gap** — fixed by migration `migrations/stock_adjustment_journal_entries.sql` (trigger `trigger_post_stock_adjustment_to_accounting` on `stock_movements`).
- **1.4** Migrations added:
  - `migrations/accounting_validate_journal_balance_trigger.sql`: adds `check_journal_entries_balance()`.
  - `migrations/stock_adjustment_journal_entries.sql`: trigger to post JE for `movement_type = 'adjustment'` (reference_type = 'stock_adjustment').
- **Output:** `docs/ACCOUNTING_ENGINE_AUDIT.md`.

**Next:** Phase 2 — Global timezone system (companies.timezone).

---

## Phase 2 — Global Timezone System

- **2.1** Migration `migrations/companies_timezone_column.sql`: add `companies.timezone TEXT DEFAULT 'UTC'` if not exists.
- **2.2** Web: Company timezone already loaded and used (`useFormatDate`, `company.timezone`, Settings). Added persistence of `timezone` in `updateCompanySettings` (SettingsContext) when saving company settings.
- **2.3** Create business and globalSettingsService already support timezone.
- **Output:** `docs/ERP_GLOBAL_TIMEZONE_SYSTEM.md`. Mobile: use company timezone for date display when company/settings are available (documented).

**Next:** Phase 3 — Reporting engine.

---

## Phase 3 — Reporting Engine

- **3.1** Financial reports: Trial Balance, P&L, Balance Sheet, General Ledger, Cash Flow implemented (accountingReportsService, 12_accounting_reports.sql).
- **3.2** Operational reports: Sales, Purchase, Inventory, Stock Valuation, Customer Ledger, Supplier Ledger implemented.
- **Output:** `docs/ERP_REPORTING_ENGINE.md`.

**Next:** Phase 4 — Performance optimization.

---

## Phase 4 — Performance Optimization

- **4.1** Migration `migrations/erp_phase4_performance_indexes.sql`: indexes for stock_movements(company_id, product_id), stock_movements(company_id, variation_id), sales(company_id, created_at), purchases(company_id, created_at), journal_entries(company_id, created_at).
- **Output:** `docs/ERP_PERFORMANCE_OPTIMIZATION.md`.

**Next:** Phase 5 — Mobile ERP stabilization.

---

## Phase 5 — Mobile ERP Stabilization (documented)

- Verify POS, barcode, sales creation, inventory lookup, payments; fix barcode stock mismatch, offline caching, branch inventory, mobile input validation.
- **Output:** `docs/ERP_MOBILE_STABILIZATION.md` (to be created when executing Phase 5).

---

## Phase 6 — Inventory Automation (documented)

- Low stock alerts, auto reorder, supplier recommendation, forecasting; data from stock_movements, sales history, lead time.
- **Output:** `docs/ERP_INVENTORY_AUTOMATION.md` (to be created when executing Phase 6).

---

## Phase 7 — AI Automation Layer (documented)

- Optional: auto product from images, WhatsApp orders, AI sales assistant, inventory prediction; n8n, LLM, webhooks.
- **Output:** `docs/ERP_AI_AUTOMATION.md` (to be created when executing Phase 7).

---

## Phase 8 — ERP V3 Production Hardening (documented)

- Validate inventory health, accounting reconciliation, reporting, mobile, performance; VPS checks (docker ps, supabase status); final report.
- **Output:** `docs/ERP_V3_PRODUCTION_REPORT.md` (to be created when executing Phase 8).

---

# END OF ROADMAP
