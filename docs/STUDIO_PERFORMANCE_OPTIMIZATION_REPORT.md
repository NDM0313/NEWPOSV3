# Studio Module Performance Optimization Report

**Project:** DIN COUTURE ERP (NEWPOSV3)  
**Date:** 2026-03-08  
**Scope:** Studio module only (Dashboard, Studio Sales, Production Pipeline, Workers). General ERP optimizations were already applied (see `FINAL_PERFORMANCE_OPTIMIZATION_REPORT.md`).

---

## Executive Summary

Studio pages were reported at **20–45 seconds** load time due to heavy joins, full-table loads, and N+1 stage queries. This report documents Studio-specific optimizations: indexes, server pagination, batch stage loading, limited pipeline data, and worker-detail scoping.

**Expected result:** Studio pages load **&lt; 2 seconds**; Production pipeline and Workers page **&lt; 1 second** where applicable.

---

## Phase 1 — Analysis (Studio Queries)

**Findings:**

| Area | Issue | Cause |
|------|--------|--------|
| Studio Sales | Very slow list load | `getStudioSales` (all) then per-sale `getStagesByProductionId(prod.id)` → N+1 |
| Studio Dashboard | Slow first load | Per-sale `getProductionsBySaleId` + `getStagesByProductionId` → 2N per load |
| Legacy Pipeline | Same as Sales | All sales + N stage queries |
| V3 Pipeline | N+1 | `getOrdersByCompany` (all) then `getStagesByOrderId(o.id)` per order |
| Workers | Slow detail open | `getWorkerDetail` called `getWorkersWithStats(companyId)` → all workers + all productions + all stages company-wide |

**Heavy patterns:**

- Full table scans on `studio_productions` / `studio_production_stages` without pagination or limits.
- Missing indexes on `company_id`, `sale_id`, `production_id`, `assigned_worker_id`, `order_id`, `worker_id` (V3).
- No batch stage API: each production/order triggered a separate stages query.

---

## Phase 2 — Indexes Added

**Migration:** `migrations/studio_performance_indexes.sql`

**Legacy tables:**

- `studio_productions`: `company_id`, `sale_id`, `(company_id, branch_id)`, `created_at DESC`
- `studio_production_stages`: `production_id`, `assigned_worker_id` (partial, WHERE NOT NULL), `status`

**V3 tables (if present):**

- `studio_production_orders_v3`: `company_id`, `sale_id`, `created_at DESC`
- `studio_production_stages_v3`: `order_id`, `worker_id` (partial, WHERE NOT NULL)

All use `CREATE INDEX IF NOT EXISTS` (or `DO $$ ... IF EXISTS` for V3). **Action required:** Run this migration on the target Supabase database (e.g. VPS or hosted) if not already applied.

---

## Phase 3 — Studio Sales Pagination & Batch Stages

**Changes:**

- **saleService.getStudioSales:** Optional `opts?: { limit?, offset? }`. When provided: uses `.range(offset, offset+limit-1)` and `count: 'exact'`; returns `{ data, total }`. Without opts, returns full array (backward compatible).
- **studioProductionService:**
  - `getStagesByProductionIds(productionIds: string[])` → single query + worker resolution; returns `Map<productionId, StudioProductionStage[]>`.
  - `getProductionsBySaleIds(saleIds: string[])` → one query for productions for given sale IDs.
- **StudioSalesListNew:** Server pagination with 50 rows per page; loads current page sales → `getProductionsBySaleIds` → `getStagesByProductionIds` (no N+1). Pagination UI uses `totalCount` and fixed page size 50.

**Files modified:**

- `src/app/services/saleService.ts`
- `src/app/services/studioProductionService.ts`
- `src/app/components/studio/StudioSalesListNew.tsx`

---

## Phase 4 — Production Pipeline (Limit + Batch)

**Legacy (StudioPipelinePage):**

- Uses `getStudioSales(companyId, branchId, { limit: 100, offset: 0 })` then `getProductionsBySaleIds(saleIds)` and `getStagesByProductionIds(productionIds)`; builds stages map in memory. No per-sale stage calls.

**V3 (StudioProductionV3Pipeline):**

- **Before:** `getOrdersByCompany` (all) then `Promise.all(list.map(o => getStagesByOrderId(o.id)))` → N+1.
- **After:** `getOrdersByCompanyPage(companyId, branchId, { limit: 100, offset: 0 })` then `getStagesByOrderIds(orderIds)`; attaches stages from map. Single batch of orders + one batch stages query.

**Services:**

- **studioProductionService:** `getProductionsPage(companyId, opts)` for legacy pipeline pagination if needed.
- **studioProductionV3Service:** `getOrdersByCompanyPage(companyId, branchId?, opts?)`, `getStagesByOrderIds(orderIds)` returning `Map<orderId, StudioProductionStageV3[]>`.

**Files modified:**

- `src/app/services/studioProductionService.ts`
- `src/app/services/studioProductionV3Service.ts`
- `src/app/components/studio/StudioPipelinePage.tsx`
- `src/app/components/studio/StudioProductionV3Pipeline.tsx`

---

## Phase 5 — Workers Performance

**Problem:** `getWorkerDetail(companyId, workerId)` called `getWorkersWithStats(companyId)`, loading all workers, all production IDs, and all stages for the company.

**Fix:** `getWorkerDetail` no longer calls `getWorkersWithStats`. It now:

1. Fetches the single worker by id (`workers` or `contacts`).
2. Fetches only stages for that worker: `studio_production_stages` where `assigned_worker_id = workerId`.
3. Fetches productions only for those stages: `studio_productions` where `id IN (production_ids from stages)` (with sale/customer for display).
4. Fetches ledger only for that worker: `worker_ledger_entries` where `worker_id = workerId`.

Stats (activeJobs, pendingJobs, completedJobs, pendingAmount, totalEarnings) are computed from this scoped data.

**Files modified:**

- `src/app/services/studioService.ts` — `getWorkerDetail` rewritten to use worker-scoped queries only.

**Note:** The Workers **list** still uses `getWorkersWithStats(companyId)` (two queries: all production IDs + all stages with `assigned_worker_id`, `status`). Future improvement: replace with an aggregated RPC (e.g. stage counts per worker) to reduce data transfer and JS work.

---

## Phase 6 — Studio Dashboard

**Before:** For each sale, async `convertSaleToDisplay` did `getProductionsBySaleId` + `getStagesByProductionId` → 2N queries.

**After:**

- `getStudioSales(companyId, branchId, { limit: 100, offset: 0 })` → up to 100 sales.
- `getProductionsBySaleIds(saleIds)` → one query for productions for those sales.
- `getStagesByProductionIds(productionIds)` → one batch stages query.
- Build `stagesBySaleId` in memory; sync `convertSaleToDisplayWithStages(sale, stagesBySaleId)` for each sale.

Department counts (Ready for Production, Dyeing, Handwork, Stitching, Completed) are derived client-side from this limited set (last 100 orders). No separate summary-only API was added; dashboard is “last 100 sales + batch productions/stages” to avoid N+1 and full history load.

**Files modified:**

- `src/app/components/studio/StudioDashboardNew.tsx`

---

## Phase 7 — Summary

| Item | Description |
|------|-------------|
| **Queries optimized** | Studio Sales (pagination + batch stages), Studio Dashboard (100 sales + batch), Legacy Pipeline (100 + batch), V3 Pipeline (100 orders + batch stages), Worker Detail (single-worker scoped queries). |
| **Indexes added** | `migrations/studio_performance_indexes.sql` — legacy and V3 studio tables (see Phase 2). |
| **Files modified** | saleService.ts, studioProductionService.ts, studioProductionV3Service.ts, studioService.ts, StudioSalesListNew.tsx, StudioDashboardNew.tsx, StudioPipelinePage.tsx, StudioProductionV3Pipeline.tsx. |
| **Estimated improvement** | 30–45 s → target **1–2 s** for Studio pages; pipeline and worker detail **&lt; 1 s** with indexes applied. |

---

## Action Required

1. **Run migration on DB:** Execute `migrations/studio_performance_indexes.sql` on the target Supabase database (e.g. via Supabase SQL Editor or VPS deployment script).
2. **Verify:** After deploy, test Studio Dashboard, Studio Sales (with pagination), Production Pipeline (legacy and V3), and Workers list/detail; confirm load times and no regressions.
3. **Optional:** If slowness persists, audit Supabase RLS policy recursion on studio tables and consider an aggregated RPC for the Workers list (`getWorkersWithStats` replacement).

---

**References**

- `docs/FINAL_PERFORMANCE_OPTIMIZATION_REPORT.md` — General ERP optimizations (permission cache, batch stock, pagination, dashboard lazy load).
- `docs/PERFORMANCE_ANALYSIS_AND_FIX_REPORT.md`
- `docs/VPS_DATABASE_AUDIT_REPORT.md`
- `docs/STUDIO_SALE_POST_DROP_AUDIT_AND_FIXES.md`
