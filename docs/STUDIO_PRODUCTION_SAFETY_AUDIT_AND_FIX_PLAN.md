# Studio Production – Safety, Calculation & Flow Audit + Fix Plan (Option A)

**Goal:** Predictable, safe, manager-driven, accounting-correct workflow. No blind finalize, no silent update. Fix BEFORE moving to main flow.

---

## 1. AUDIT FINDINGS

### 1.1 Studio Sale → Production linkage

| Area | Current state | Issue / risk |
|------|----------------|--------------|
| **DB** | `studio_productions.sale_id` is nullable (ALTER ADD COLUMN, no NOT NULL) | Old rows or bugs can leave sale_id null; no DB-level enforcement. |
| **Backend createProduction** | Throws if `!input.sale_id` | ✅ Enforced in service. |
| **Backend createStage** | Does not check that production has `sale_id` | ❌ Stage can be added to a production that lost or never had sale_id (e.g. if DB allowed null). |
| **Backend changeProductionStatus(completed)** | Throws if `!existing.sale_id` | ✅ Enforced. |
| **Frontend Test Page** | Production is created with sale_id via ensureProductionForSale / createProduction | ✅ sale_id always passed when coming from sale. |
| **Navigation** | List/dashboard open Test Page with selectedStudioSaleId; ensureProductionForSale creates production with sale_id | ✅ Entry is sale-linked. |

**Summary:** Backend createProduction and final completion enforce sale_id. DB does not (nullable). createStage does not verify production.sale_id.

---

### 1.2 Manager assignment flow (strictness)

| Rule | Current state | Gap |
|------|----------------|-----|
| **Step A – One process at a time, next unlocks only after Receive** | User can click "Add next process" anytime from Receive; can add multiple stages without receiving any | ❌ Next stage should unlock only when current stage is completed (Receive). |
| **Step B – Worker mandatory** | Worker dropdown allows "Select worker" (empty); createStage accepts assigned_worker_id null | ❌ Worker should be mandatory for Add this step. |
| **Step B – Estimated cost mandatory** | Validated > 0 only | ✅ (could also require ≥ 0 and explicit "0" confirmation). |
| **Step B – Expected date mandatory** | No expected date field; only Notes (optional) | ❌ Expected date not captured; required by spec. |
| **Step C – Actual cost required** | Required on Receive; validated | ✅ |
| **Step C – Completion date required** | Set automatically to now(); no user-editable completion date | ⚠️ Spec says "Completion date required" – could stay auto or add optional field. |
| **Step C – Cost lock after complete** | updateStage allows updating cost/status anytime; no "locked" flag | ❌ Completed stage cost can be overwritten (silent overwrite risk). |

**Summary:** Missing: (1) lock "Add next process" until current stage is received, (2) worker mandatory at assign, (3) expected date at assign, (4) cost lock once stage is completed.

---

### 1.3 Calculation & billing safety

| Rule | Current state | Gap |
|------|----------------|-----|
| **Worker cost ≠ customer payment** | Worker ledger is separate table; customer bill gets studio_charges on Final Complete only | ✅ Correct. |
| **Studio charges = sum of stage costs** | Final Complete sums stages' cost and sets sale.studio_charges + total | ✅ Correct. |
| **No sale total update on stage complete** | Sale total is updated only in changeProductionStatus(completed) | ✅ No update on Receive. |
| **Final billing only on Final Completion** | Sale total and studio_charges updated only when production status → completed | ✅ Correct. |
| **Worker ledger entries** | Inserted only in changeProductionStatus(completed), one per stage (worker_id + cost) | ✅ No ledger on Receive; single place. |
| **Double ledger on double Final Complete** | No check if worker_ledger_entries already exist for these stages | ⚠️ Risk: two quick clicks could duplicate ledger entries. |

**Summary:** Calculation flow is correct. One improvement: idempotent worker ledger (skip or upsert if entry already exists for stage).

---

### 1.4 Final completion (hard gate)

| Check | Current state | Gap |
|-------|----------------|-----|
| All assigned stages completed | Frontend and backend both check; backend throws if any stage not completed | ✅ |
| sale_id valid | Backend throws if !sale_id; fetches sale row | ✅ |
| Cost summary verified | No explicit "cost summary" step; we sum stage costs and use that | ⚠️ Could add a quick verification log or confirm step. |
| Final Complete allowed when 0 stages | Allowed (stages.length > 0 && all completed, or 0 stages) | ⚠️ Spec: "saari assigned stages completed" – could require ≥1 stage. |
| Partial/blind update | Sale update, ledger, inventory happen in one flow; no partial commit without production status update | ✅ Status update is after all side effects in same flow (but see order below). |

**Order of operations on Final Complete:** Currently we (1) update sale (studio_charges, total, status), (2) insert worker_ledger_entries, (3) insert stock_movements + product stock, (4) update studio_productions status. If (2) or (3) fails, (1) is already committed – **inconsistent state**. Better: do all in a transaction or do status update last and roll back sale/ledger/inventory on failure (or use DB transaction).

**Summary:** Gates are mostly correct. Improvements: (1) make Final Complete order/transaction safe, (2) optional: require at least one stage, (3) idempotent worker ledger.

---

### 1.5 Silent / unsafe saves and missing guards

| Issue | Where | Fix direction |
|-------|--------|----------------|
| **Stage cost overwrite** | updateStage allows cost/status change for already-completed stage | Backend: reject update if stage.status === 'completed' (or allow only notes). |
| **createStage without sale_id check** | studioProductionService.createStage(productionId, ...) | Backend: load production, throw if !production.sale_id. |
| **Worker ledger duplicate** | changeProductionStatus(completed) inserts without checking existing | Backend: check by reference_type + reference_id (stage id); skip or upsert. |
| **Sale updated then ledger/inventory fail** | changeProductionStatus order | Backend: reorder so production status (and optionally sale) update last, or run in transaction. |
| **Worker optional in UI** | Test Page "Add this step" | Frontend: disable Add until worker selected; backend createStage: optional server-side guard (assigned_worker_id required when policy says so). |
| **Expected date not captured** | Stage has no expected_completion_date | Schema: add expected_completion_date to studio_production_stages; UI: add field; make mandatory if spec requires. |
| **"Add next process" without Receive** | Test Page | Frontend: disable "Add next process" (or hide Process) until all current stages are completed. |

---

### 1.6 Navigation / list → detail mismatch

| Observation | Cause | Fix |
|-------------|--------|-----|
| List shows sale but detail "empty" or wrong | Already addressed: load sale first in StudioSaleDetailNew; Test Page ensures production for sale | Keep current fix; ensure no other path opens detail without selectedStudioSaleId. |
| "Move" suggested | Misdiagnosis of linking/routing | No data move; only linkage and validation (as in this plan). |

---

## 2. DATABASE CHANGES (OPTION A – MINIMAL)

- **studio_productions.sale_id:** Add NOT NULL and optional unique for "one active production per sale" if desired (migration: alter column to NOT NULL after backfilling; optional unique partial index where status != 'cancelled').
- **studio_production_stages:** Add `expected_completion_date DATE` (or TIMESTAMPTZ) if expected date is mandatory; optional `cost_locked_at TIMESTAMPTZ` to enforce cost lock after complete (application can also enforce without new column).
- **worker_ledger_entries:** No schema change; use reference_type + reference_id (stage id) to avoid duplicate inserts (application logic).

---

## 3. STEP-BY-STEP FIX PLAN (BEFORE CODING)

### Phase 1 – Backend safety (no UI change)

1. **createStage – enforce sale_id**
   - In `createStage(productionId, input)`:
     - Load production by productionId.
     - If !production?.sale_id, throw: "Production must be linked to a sale to add a stage."
   - Ensures no stage is added to a production without a sale.

2. **updateStage – cost lock**
   - In `updateStage(stageId, updates)`:
     - Load stage; if current status is 'completed', allow only `notes` (and optionally completed_at) to be updated; reject cost/status change with clear error.
   - Prevents silent overwrite of completed stage cost.

3. **Final Complete – idempotent worker ledger**
   - Before inserting into worker_ledger_entries, for each stage check if an entry already exists (reference_type = 'studio_production_stage', reference_id = stage.id).
   - If exists, skip insert for that stage (or upsert by business key).
   - Prevents duplicate ledger entries on double submit.

4. **Final Complete – order / consistency**
   - Option A (recommended): Do all side effects first (worker_ledger_entries, stock_movements, product update, sale update), then update studio_productions.status last. On any failure, throw and do not update production status (sale/ledger/inventory may need manual review or retry).
   - Option B: Use Supabase/Postgres transaction (RPC or explicit begin/commit) so sale + ledger + inventory + production status commit atomically.
   - Document: "Final completion is all-or-nothing; on failure, fix data and retry."

### Phase 2 – Frontend flow (Test Page)

5. **Worker mandatory**
   - In Worker step: disable "Add this step" when assigned_worker_id is empty; show validation message.
   - Optional: backend createStage throw if assigned_worker_id is null (policy: manager must assign worker).

6. **Expected date**
   - If product owner confirms: add expected_completion_date to stage (DB + service + UI), required at "Add this step".
   - Otherwise keep notes-only for now and add expected date in a follow-up.

7. **Next stage only after Receive**
   - In Test Page Receive step: show "Add next process" only when every current stage has status === 'completed'.
   - When there is at least one non-completed stage, hide or disable "Add next process" and show: "Complete all current steps (Receive) before adding another process."

8. **Step navigation lock (optional)**
   - Optionally restrict free step navigation: e.g. cannot jump to "Worker" without selecting process; cannot jump to "Final" until all stages completed. Currently steps are clickable; can keep for flexibility or lock to enforce strict order.

### Phase 3 – DB constraints (migrations)

9. **sale_id NOT NULL**
   - Migration: backfill any studio_productions with null sale_id (e.g. set to a placeholder or leave unmigrated and fix manually); then ALTER TABLE studio_productions ALTER COLUMN sale_id SET NOT NULL.
   - Ensures every production has a sale at DB level.

10. **Optional: one active production per sale**
    - If business rule is "one non-cancelled production per sale", add unique partial index: UNIQUE(production_id) WHERE status != 'cancelled' is wrong; correct is UNIQUE(sale_id) WHERE status IN ('draft','in_progress') (one draft/in_progress per sale). Implement only if required.

### Phase 4 – Validation and UX

11. **Final Complete – cost summary**
    - On Final step, show a short summary: "Stages: N. Total worker cost (studio charges): Rs X. This will be added to sale total." and require explicit "Confirm" if desired.
    - Keeps calculation visible and reduces blind finalize.

12. **Errors everywhere**
    - Ensure every critical path (createProduction, createStage, updateStage, changeStatus) throws clear errors (no silent catch that only logs); Test Page shows toast/error from API.
    - Already largely in place; verify no silent swallows.

---

## 4. IMPLEMENTATION ORDER (RECOMMENDED)

1. Phase 1 (backend): 1 → 2 → 3 → 4  
2. Phase 2 (frontend): 5 → 7 → 6 if expected date confirmed  
3. Phase 3 (DB): 9 (and 10 if needed)  
4. Phase 4: 11, 12  

After Phase 1–2, the flow is strict (sale linked, worker required, next stage after receive, cost locked, no duplicate ledger). Phase 3 hardens DB; Phase 4 improves clarity and confirmation.

---

## 5. WHAT WE ARE NOT DOING (OPTION A)

- **No "move" of Studio Sale data** – only linkage and validation.
- **No sale total update on stage complete** – only on Final Completion.
- **No worker ledger on Receive** – only on Final Completion (single place).
- **No partial finalize** – all steps validated; order/transaction considered in Phase 1.4.

---

## 6. CHECKLIST BEFORE MOVING TO MAIN FLOW

- [ ] createStage validates production.sale_id.
- [ ] updateStage blocks cost/status change when stage is completed.
- [ ] Final Complete: idempotent worker ledger; safe order or transaction.
- [ ] UI: Worker mandatory; "Add next process" only when all stages received.
- [ ] DB: sale_id NOT NULL on studio_productions (after backfill).
- [x] Step B done: expected_completion_date required on assign; worker + expected date mandatory in UI and backend (assignWorkerToStage, updateStage when status=assigned); cost summary + confirm on Final optional.

Once this is done, Studio Production is safe and predictable; then it can be promoted from Test Page to main flow.
