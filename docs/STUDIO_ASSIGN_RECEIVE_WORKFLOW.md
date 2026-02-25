# Studio Assign → Receive → Finalize Workflow

Manager-driven production workflow for Studio Sales. Web and Mobile use the same backend RPCs.

## Overview

| Step | Status | Action | DB Changes |
|------|--------|--------|------------|
| 0 | `pending` | Sale created | All stages: `assigned_worker_id=NULL`, `status=pending`, `cost=0`, `expected_cost=NULL` |
| 1 | `assigned` | Manager Assigns | `assigned_worker_id`, `expected_cost`, `assigned_at`, `status=assigned` |
| 2 | `completed` | Manager Receives | `cost` (final), `completed_at`, `status=completed`, journal entry + worker_ledger |
| 3 | — | Reopen (admin) | Reverse journal, reset to `assigned` |

**No auto-assignment ever.** Manager must explicitly Assign and Receive.

---

## Backend RPCs (Supabase)

Run `migrations/studio_assign_receive_workflow.sql` on your database.

### `rpc_assign_worker_to_stage`

- **Params:** `p_stage_id`, `p_worker_id`, `p_expected_cost`, `p_expected_completion_date`, `p_notes`
- **Effect:** Sets `assigned_worker_id`, `expected_cost`, `assigned_at`, `status='assigned'`
- **Validation:** Stage must not be `completed`

### `rpc_receive_stage_and_finalize`

- **Params:** `p_stage_id`, `p_final_cost`, `p_notes`
- **Effect:** Creates journal (Dr 5000, Cr 2010), worker_ledger, sets `cost`, `completed_at`, `status='completed'`
- **Validation:** Stage must be `assigned`, worker must exist, `p_final_cost > 0`

### `rpc_reopen_stage`

- **Params:** `p_stage_id`
- **Effect:** Reverses journal, deletes worker_ledger, resets stage to `assigned` (keeps worker + expected_cost)
- **Validation:** Stage must be `completed`

---

## Shared API (Web + Mobile)

Both platforms call the same RPCs via Supabase. Fallback to direct table updates when RPCs are not deployed.

| Function | Web | Mobile |
|----------|-----|--------|
| `assignWorkerToStage` / `assignWorkerToStep` | `studioProductionService` | `studioApi.assignWorkerToStep` |
| `receiveStage` / `receiveStepAndFinalizeCost` | `studioProductionService` | `studioApi.receiveStepAndFinalizeCost` |
| `reopenStage` / `reopenStep` | `studioProductionService` | `studioApi.reopenStep` |

---

## UI Requirements

### Per-step display

- **Status badge:** Pending | Assigned | Received (Completed)
- **Assigned worker name** (if assigned)
- **Estimated rate** (if assigned)
- **Final cost** (if received)

### Buttons

| Status | Button |
|--------|--------|
| Pending | Assign |
| Assigned | Receive |
| Received | Reopen (admin/manager only) |

---

## Accounting Integrity

- **On Receive:** Dr Production Expense (5000), Cr Worker Payable (2010)
- **On Reopen:** Reverse entry (Dr 2010, Cr 5000)
- Journal linked to `studio_sale_id` / `production_id` and `production_step_id` / `stage_id`
- Never rely on frontend for accounting; all entries created in DB RPCs

---

## Validation Rules

1. No received step without `final_cost > 0`
2. No received step without accounting entry
3. No auto-assigned steps (all stages start `pending`, `assigned_worker_id=NULL`)
4. Sequential: next step available only after current step is finalized (enforced in UI)

---

## No Auto-Assign Guard

**Migration:** `migrations/studio_production_stages_no_auto_assign_guard.sql`

- **BEFORE INSERT trigger:** Forces `assigned_worker_id=NULL`, `status=pending`, `assigned_at=NULL`, `cost=0` for ALL new stage rows. Prevents regression.
- **CHECK constraints:** `pending`→worker null; `assigned`/`in_progress`→worker not null; `completed`→cost not null.
- **UI mapping:** If `status=assigned/in_progress` but `assigned_worker_id` is null → force display **Pending** + "Not assigned" (with console warning).

---

## Verification Checklist

1. **Create new Studio Sale** (Web or Mobile).
2. **Check DB:** `SELECT id, stage_type, assigned_worker_id, status, cost FROM studio_production_stages WHERE production_id = '<prod_id>';`
   - All rows: `assigned_worker_id IS NULL`, `status = 'pending'`, `cost = 0`.
3. **Check UI:** Each step shows "Pending" badge and "Not assigned". Assign button visible.
4. **Assign worker** → DB: `assigned_worker_id` set, `status = 'assigned'`.
5. **Receive** → DB: `cost` set, `status = 'completed'`, journal entry created.
6. **Reopen** → DB: stage reset to `assigned`, journal reversed.

---

## Migration Order

```bash
psql $DATABASE_URL -f migrations/studio_assign_receive_workflow.sql
psql $DATABASE_URL -f migrations/studio_production_stages_no_auto_assign_guard.sql
```

Or run in Supabase Dashboard → SQL Editor.
