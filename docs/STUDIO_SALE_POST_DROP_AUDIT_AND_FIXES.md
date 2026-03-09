# Studio Sale Post–Drop Audit and Fixes

**Context:** The legacy `studio_orders` table was dropped to fix duplicate studio sale/order entries. Some logic was partially migrated; Customize Tasks → Apply Configuration was still failing or inconsistent.

**Goal:** Studio Sale task configuration and production stage persistence work using only: `sales`, `studio_sales`, `studio_productions`, `studio_production_stages`, and related pricing/invoice sync. No dependency on `studio_orders`.

---

## 1. Root cause summary

- **Apply Configuration when no stages existed:** When `getStagesByProductionId` returned `[]` (no stages yet), the code took the **else** branch (incremental delete/add) instead of **replaceStages**. That branch looped `createStage` for each selected task. If the `studio_production_stages` table was missing, the first `createStage` returned 404 and the flow failed; even when the table existed, using replaceStages for “no stages yet” is correct so all stages are written in one bulk operation with correct `stage_order`.
- **Detail load fallback:** On “sale not found”, the app called `studioService.getStudioOrder(id)` (legacy `studio_orders`). After the table drop that call fails or returns null; the UI then showed converted “studio order” data or empty state. The flow should not touch `studio_orders` at all.
- **DB functions:** If migrations were not run, `get_sale_studio_summary` or `get_sale_studio_charges_batch` could still reference `studio_orders` (or the `studio_production_stages` table might not exist), causing RPC/page errors.
- **Error handling:** Failures showed a generic “Configuration applied locally” or “Failed to save” instead of actionable messages (e.g. run migration, production not created, table missing).

---

## 2. File-by-file changes

### 2.1 `src/app/components/studio/StudioSaleDetailNew.tsx`

- **Apply Configuration (handleApplyTaskConfiguration):**
  - When **no stages exist yet** (`stagesArr.length === 0`), use **replaceStages** instead of the incremental branch. So: “no stages yet” OR “all existing stages pending/unassigned” → single replaceStages call (delete + bulk insert with `stage_order`). This fixes persistence when the user first applies configuration and ensures all selected stages are written.
  - Added dev-only log: `Apply config: replaceStages` with `productionId`, `stagesToSave`, `noStagesYet`.
- **ensureProductionForSale:**
  - Comment clarified: one sale = one production; no duplicates.
  - Dev log when using existing production or when creating a new one (`saleId`, `productionId`).
- **loadStudioOrder:**
  - Removed fallback to `studioService.getStudioOrder(selectedStudioSaleId)`. When the sale is not found we set `setSaleDetail(null)` and do not call any `studio_orders` API.
  - Removed unused `studioService` import and removed `convertFromSupabaseOrder` from the load callback dependency array.
- **Error handling (Apply Configuration catch):**
  - Specific toasts: table missing → “Production stages table missing. Run migrations/fix_after_drop_studio_orders.sql …”; production creation failure → “Production record could not be created …”; else → “Failed to persist selected stages to studio_production_stages” + short message. Removed “Configuration applied locally” so we don’t pretend backend save succeeded.
  - Dev log of full error object on failure.
- **persistAllStagesToBackend (Header Save):**
  - Dev log at start: `saleId`, `productionId`, `localStepsCount`.
  - Catch block: same style of specific messages (table missing, production not created, generic with message slice) and dev-only console warn.

### 2.2 `src/app/services/studioProductionService.ts`

- **getStagesByProductionId:** On error, dev-only log `productionId`, `code`, `message`. On success with data, dev-only log `productionId`, `count`.
- **replaceStages:** On insert failure, dev log includes `productionId`. On fallback (no `stage_order`) and on success, dev logs with `productionId` and count.
- **createStage:** On insert error, dev warn with `productionId`, `stage_type`, `message`. On success, dev log `productionId`, `stageId`, `stage_type`.

### 2.3 Other files (no code change)

- **studioService.ts:** Still defines `getStudioOrder` / `getAllStudioOrders` (they hit `studio_orders`). When the table is missing they return null/[] and log. No longer called from Studio Sale Detail; list/dashboard may still use for display of legacy data; safe.
- **customerLedgerApi.ts:** Queries that touch `studio_orders` are inside try/catch and ignored on failure. Left as-is so ledger doesn’t assume table exists.
- **saleService.ts:** Calls RPC `get_sale_studio_charges_batch`; that RPC must not reference `studio_orders` (see migration below).

---

## 3. SQL / migration changes

- **Already present and required:** `migrations/fix_after_drop_studio_orders.sql`:
  - Replaces `get_sale_studio_summary` to use only `studio_productions` + `studio_production_stages` (no `studio_orders`).
  - Replaces `get_sale_studio_charges_batch` to use only `studio_production_stages` (no `studio_orders`).
  - Ensures `studio_production_stages` exists (with `stage_order`, `expected_cost`, etc.) and adds `assigned` to the status enum if needed.
- **Action:** Run `fix_after_drop_studio_orders.sql` in the Supabase SQL Editor (Dashboard → SQL Editor) on the project DB (e.g. supabase.dincouture.pk) if not already run. No new migration file was added; this one is the single source of truth for post-drop behavior.

---

## 4. Exact bug source

- **Primary:** In `handleApplyTaskConfiguration`, when there were **no existing stages** (`stagesArr.length === 0`), `allPendingAndUnassigned` was false, so the code used the **else** branch and called **createStage** in a loop. That both was inefficient and could surface “relation does not exist” or 404 on the first insert if the table was missing. The correct behavior is to use **replaceStages** when there are no stages (or when all existing are pending/unassigned), so one bulk write happens and `stage_order` is set for all rows.
- **Secondary:** Detail load called `getStudioOrder` when the sale was not found, keeping a dependency on the dropped `studio_orders` table and confusing state when the table was missing.

---

## 5. Final fixed behavior

1. **New Studio Sale:** One production record per sale (ensureProductionForSale returns existing or creates one; no duplicate productions).
2. **Customize Tasks → Apply Configuration:**
   - If no production yet, ensureProductionForSale creates one.
   - If no stages exist OR all existing stages are pending/unassigned → **replaceStages(productionId, selected stages with positions)** (single DELETE + INSERT).
   - Otherwise → incremental: delete unselected stages, create missing selected stages with correct position.
   - After persist, stages are re-fetched and local step IDs are synced from server. Success toast: “Configuration saved.”
3. **Header Save:** Unchanged flow; persists all steps to `studio_production_stages` (create stages if none, then update worker/cost/status). Clear error toasts if table missing or production creation fails.
4. **Reload:** Same stages appear; data comes from `studio_productions` and `studio_production_stages` only.
5. **No `studio_orders`:** Detail load never calls `studio_orders`; summary/charges RPCs and migration use only the new tables.

---

## 6. Save flow trace (reference)

- **Header “Save”:** `persistAllStagesToBackend()` → ensureProductionForSale if needed → getStagesByProductionId → if 0 stages and local steps exist, createStage loop; else updateStage per step. Writes: `studio_production_stages` (and production if created). Reads: getStagesByProductionId, reloadProductionSteps.
- **Apply Configuration:** `handleApplyTaskConfiguration(selectedTaskIds)` → update local productionSteps, close modal → ensureProductionForSale if needed → getStagesByProductionId → if noStagesYet or allPendingAndUnassigned → replaceStages(productionId, stagesToSave); else delete unselected + createStage for missing. Then getStagesByProductionId again and sync local step IDs. Writes: `studio_production_stages` only.

---

## 7. Remaining risks and assumptions

- **DB migration:** The fix assumes `fix_after_drop_studio_orders.sql` has been run. If not, “relation studio_production_stages does not exist” or RPC errors will persist until it is run.
- **Lists/dashboard:** `StudioSalesListNew`, `StudioPipelinePage`, `StudioDashboardNew` may still use types or conversion with `source: 'studio_order'` for display; they don’t write to `studio_orders`. `getAllStudioOrders` returns [] when the table is dropped. Safe.
- **Duplicate production:** ensureProductionForSale and load path both use getProductionsBySaleId and create at most one production per sale; no trigger creates a second production after drop. Low risk.
- **customerLedgerApi:** Still has try/catch-wrapped `studio_orders` queries; they no-op when the table is missing. Optional follow-up: remove those queries and any ledger UI that depended on them if you want zero references.

---

## 8. Debugging (dev only)

- **StudioSaleDetailNew:** Logs for ensureProductionForSale (existing vs created production), persistAllStagesToBackend (saleId, productionId, localStepsCount), Apply Configuration (replaceStages call, and full error on failure).
- **studioProductionService:** Logs for getStagesByProductionId (error or count), replaceStages (insert failure, fallback count, success count), createStage (failure or success with ids).

Use browser console (dev) to trace saleId, productionId, selected/existing stages, and DB errors.
