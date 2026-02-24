# Studio Production – Accounting Integrity Audit

This document defines data integrity checks and verification queries for the Studio Production workflow and its accounting integration.

## Principles

- **Studio = Production** → **Production = Cost Center** → **Cost Center must reflect in Accounting**
- No completed stage without a journal entry (Dr Production Expense, Cr Worker Payable).
- No journal entry for a stage without a corresponding completed task (or its reversal).
- Worker payments must link to the worker payable ledger; reversals must be balanced.

---

## 1. No completed task without accounting entry

Every `studio_production_stages` row with `status = 'completed'` and `cost > 0` must have a non-null `journal_entry_id` pointing to a valid journal entry.

### Verification query (Supabase SQL)

```sql
-- Completed stages with cost but no journal entry (should return 0 rows)
SELECT s.id, s.production_id, s.stage_type, s.cost, s.status, s.journal_entry_id
FROM studio_production_stages s
WHERE s.status = 'completed'
  AND COALESCE(s.cost, 0) > 0
  AND (s.journal_entry_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM journal_entries je WHERE je.id = s.journal_entry_id
  ));
```

### Fix

If any rows are returned, create the missing journal entry (Dr 5000 Production Expense, Cr 2010 Worker Payable) and set `journal_entry_id` on the stage. Prefer doing this via application logic (e.g. a one-off script that calls `createProductionCostJournalEntry` and updates the stage) so company_id/branch_id and account codes are correct.

---

## 2. No accounting entry without task

Every journal entry with `reference_type = 'studio_production_stage'` should reference a valid `studio_production_stages.id`. Reversals use `reference_type = 'studio_production_stage_reversal'` and also reference the stage id.

### Verification query

```sql
-- Journal entries for studio stages where stage does not exist or is invalid (should return 0)
SELECT je.id, je.entry_no, je.reference_type, je.reference_id
FROM journal_entries je
WHERE je.reference_type IN ('studio_production_stage', 'studio_production_stage_reversal')
  AND je.reference_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM studio_production_stages s WHERE s.id = je.reference_id
  );
```

---

## 3. All worker payments link to payable ledger

Worker ledger entries with `reference_type = 'studio_production_stage'` must reference an existing stage. Completed stages with cost and assigned worker should have a corresponding `worker_ledger_entries` row (unpaid or paid).

### Verification query

```sql
-- Worker ledger entries for studio stages where stage does not exist (should return 0)
SELECT wle.id, wle.worker_id, wle.amount, wle.reference_id
FROM worker_ledger_entries wle
WHERE wle.reference_type = 'studio_production_stage'
  AND NOT EXISTS (
    SELECT 1 FROM studio_production_stages s WHERE s.id = wle.reference_id
  );
```

### Optional: Completed stages with cost and worker but no ledger entry

```sql
SELECT s.id, s.production_id, s.stage_type, s.cost, s.assigned_worker_id
FROM studio_production_stages s
WHERE s.status = 'completed'
  AND COALESCE(s.cost, 0) > 0
  AND s.assigned_worker_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM worker_ledger_entries wle
    WHERE wle.reference_type = 'studio_production_stage' AND wle.reference_id = s.id
  );
```

---

## 4. All reversals balanced

Reversal entries have `reference_type = 'studio_production_stage_reversal'`. Each reversal should have two lines: Dr Worker Payable (2010), Cr Production Expense (5000), with equal amounts so the entry balances.

### Verification query (journal lines sum to zero per entry)

```sql
SELECT je.id, je.entry_no, je.reference_type, je.reference_id,
       SUM(jel.debit - jel.credit) AS imbalance
FROM journal_entries je
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
WHERE je.reference_type IN ('studio_production_stage', 'studio_production_stage_reversal')
GROUP BY je.id, je.entry_no, je.reference_type, je.reference_id
HAVING ABS(SUM(jel.debit - jel.credit)) > 0.01;
```

Should return 0 rows (no imbalance).

---

## 5. Workflow state consistency

- **PHASE 1:** New stages must have `status = 'pending'`, `assigned_worker_id = NULL`, `cost = 0`. No auto-assignment.
- **PHASE 2:** Assigned stages have `assigned_worker_id`, `assigned_at`, `expected_cost`; `status = 'in_progress'`; no journal yet.
- **PHASE 3:** On complete: journal created first, then stage updated with `journal_entry_id`; worker ledger entry created.
- **PHASE 4:** On reopen: reversal entry created, then stage reset to `pending`, `cost = 0`, `journal_entry_id = NULL`, `assigned_worker_id = NULL`; worker ledger entry removed and worker balance adjusted.
- **PHASE 5:** Cost change after complete: reverse old entry, create new entry, update stage and worker ledger; log in `studio_production_logs` with `action_type = 'stage_cost_changed'`.

### Quick check: stages with journal_entry_id but status not completed (should be 0 after reopen clears it)

```sql
SELECT id, production_id, stage_type, status, cost, journal_entry_id
FROM studio_production_stages
WHERE journal_entry_id IS NOT NULL AND status != 'completed';
```

---

## 6. Company and branch scope

All operations must respect `company_id` and `branch_id` from the linked production and sale. Journal entries and worker ledger entries must use the same `company_id`; journal entries should use production/sale `branch_id` when present.

---

## Running the audit

1. Run the verification queries above against your database.
2. Investigate any non-empty result sets and fix data or application logic as needed.
3. Re-run after fixes to confirm zero violations.
4. Optionally run these checks in CI or a nightly job and alert on failures.
