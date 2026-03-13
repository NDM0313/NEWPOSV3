# ERP Studio Structure (Safe Cleanup Plan)

**Goal:** Keep only **canonical** studio tables **studio_productions** and **studio_production_stages** as the main path. Document usage of v2/v3 tables and mark as **legacy** in documentation only if unused; otherwise mark as **optional/versioned**.

**No schema changes in this phase** — documentation only.

---

## 1. Canonical studio tables

| Table | Purpose |
|-------|--------|
| **studio_productions** | One per production; links to sale via sale_id; product_id, status, production_date, generated_invoice_item_id (sales_items.id). |
| **studio_production_stages** | Stages per production: stage_type, assigned_worker_id, cost, status, journal_entry_id (link to accounting). |

These are used by the **base** studio flow (no v2/v3 feature flag): StudioDashboardNew, StudioPipelinePage, StudioWorkflowPage, studioProductionService, studioCostsService, studioCustomerInvoiceService (when not using v2/v3), StudioSaleDetailNew, etc.

---

## 2. Versioned tables (v2 / v3)

### 2.1 studio_production_orders_v2, studio_production_stages_v2, studio_stage_assignments_v2, studio_stage_receipts_v2

| Location | Usage |
|----------|--------|
| **studioProductionV2Service.ts** | Full CRUD on studio_production_orders_v2, studio_production_stages_v2, studio_stage_assignments_v2, studio_stage_receipts_v2. |
| **studioCustomerInvoiceService.ts** | Select/update from studio_production_orders_v2 (e.g. for invoice sync). |

**Conclusion:** **In use** when feature flag **studio_production_v2** is enabled. Used by Studio V2 dashboard and pipeline (App.tsx: studioProductionV2 ? StudioProductionV2Dashboard / StudioProductionV2Pipeline).

**Status:** **Optional / versioned** — not legacy. When flag is on, these tables are active. If a deployment never enables v2, they could be considered unused for that deployment; still do **not** drop without a formal deprecation and migration.

### 2.2 studio_production_orders_v3, studio_production_stages_v3, studio_production_cost_breakdown_v3

| Location | Usage |
|----------|--------|
| **studioProductionV3Service.ts** | Full CRUD on studio_production_orders_v3, studio_production_stages_v3. |

**Conclusion:** **In use** when feature flag **studio_production_v3** is enabled. Used by Studio V3 dashboard, pipeline, order detail (StudioProductionV3Dashboard, StudioProductionV3Pipeline, StudioProductionV3OrderDetail).

**Status:** **Optional / versioned** — not legacy. Same as v2: do not drop; mark as legacy only if/when product decides to retire v2/v3 and migrate all data to canonical tables.

---

## 3. Other studio-related tables

| Table | Usage | Status |
|-------|--------|-------|
| **studio_production_logs** | Logs per production | **Active** — used with canonical studio_productions |
| **studio_tasks** | Triggers still reference it (trigger_after_studio_task_sync) | **Legacy** — studio flow moved to stages; table may still exist. Mark as legacy in docs; do not drop without verifying no remaining references. |
| **workers** | Worker master | **Active** |
| **worker_ledger_entries** | Worker payments / due balance | **Active** |
| **worker_payments** | Payment records for workers | **Active** |
| **studio_production_cost_breakdown_v3** | V3 cost breakdown | **Optional** — used with v3 when enabled |

---

## 4. Dropped tables (already removed)

- **studio_orders**, **studio_order_items** — Dropped in drop_studio_orders_legacy.sql. No action.

---

## 5. Documentation labels (recommended)

| Table(s) | Label | Note |
|----------|--------|-----|
| **studio_productions**, **studio_production_stages** | **Canonical** | Main studio flow (no v2/v3 flag). |
| **studio_production_orders_v2**, **studio_production_stages_v2**, **studio_stage_assignments_v2**, **studio_stage_receipts_v2** | **Optional (v2)** | Active when studio_production_v2 = true. |
| **studio_production_orders_v3**, **studio_production_stages_v3**, **studio_production_cost_breakdown_v3** | **Optional (v3)** | Active when studio_production_v3 = true. |
| **studio_tasks** | **Legacy** | Replaced by studio_production_stages; triggers may still reference. |
| **studio_production_logs**, **workers**, **worker_ledger_entries**, **worker_payments** | **Active** | Part of canonical or shared studio model. |

---

## 6. Migration plan (if retiring v2/v3 later)

1. **Do not drop v2/v3 tables now.** They are in use when flags are on.
2. Add **comments** on v2/v3 tables only if product decides they are deprecated, e.g.:  
   `COMMENT ON TABLE studio_production_orders_v2 IS 'OPTIONAL: Used when feature flag studio_production_v2 is enabled. Canonical = studio_productions + studio_production_stages.'`
3. If product retires v2/v3: (a) Migrate data from v2/v3 to studio_productions/studio_production_stages (or archive). (b) Remove feature-flag code paths. (c) Then mark tables as legacy and optionally drop in a later phase.

---

## 7. Summary

- **Canonical:** studio_productions, studio_production_stages (and supporting workers, worker_ledger_entries, worker_payments, studio_production_logs).
- **Optional/versioned:** v2 and v3 tables are **in use** when their feature flags are enabled; **do not** mark as legacy or drop.
- **Legacy (documentation only):** studio_tasks — replaced by stages; keep table until triggers/references are removed.
- No schema changes in this phase.

---

*This document is part of the safe cleanup plan. No schema or data was modified.*
