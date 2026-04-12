-- =====================================================================
-- VERIFY: Worker Balance Cache vs GL-Derived Balance
-- Purpose : Measure drift between workers.current_balance (cache, now
--           stale after P1-3) and the canonical GL balance derived from
--           worker_ledger_entries. Used before and after UI cutover.
-- Safe    : SELECT only. No modifications.
-- Context : 35_POST_PATCH_VERIFICATION_AND_REPAIR_RUNBOOK section 4,
--           37_WORKER_BALANCE_GL_UI_CUTOVER
-- =====================================================================

-- ─── CHECK 1: Workers with significant drift (> 0.01) ────────────────────────
-- These are workers where the cache no longer matches GL truth.
-- After P1-3, this list will grow over time as new ledger entries are added
-- without updating the cache.
-- SUCCESS: 0 rows (no drift) — means cache was accurate at last write, or no activity post-P1-3
-- EXPECTED (post-P1-3): Some rows with drift = normal, GL-derived is the correct value
SELECT
  w.id AS worker_id,
  w.name,
  w.company_id,
  w.current_balance AS cached_balance,
  COALESCE(SUM(wle.amount) FILTER (WHERE wle.status != 'paid'), 0) AS gl_derived_pending,
  ABS(w.current_balance - COALESCE(SUM(wle.amount) FILTER (WHERE wle.status != 'paid'), 0)) AS drift,
  COUNT(wle.id) FILTER (WHERE wle.status != 'paid') AS open_ledger_entry_count
FROM workers w
LEFT JOIN worker_ledger_entries wle ON wle.worker_id = w.id
GROUP BY w.id, w.name, w.company_id, w.current_balance
HAVING ABS(w.current_balance - COALESCE(SUM(wle.amount) FILTER (WHERE wle.status != 'paid'), 0)) > 0.01
ORDER BY drift DESC;

-- ─── CHECK 2: Summary drift per company ──────────────────────────────────────
SELECT
  w.company_id,
  COUNT(DISTINCT w.id) AS workers_with_drift,
  SUM(ABS(w.current_balance - COALESCE(pending.pending_total, 0))) AS total_drift_amount,
  MAX(ABS(w.current_balance - COALESCE(pending.pending_total, 0))) AS max_drift_single_worker
FROM workers w
LEFT JOIN (
  SELECT worker_id, SUM(amount) FILTER (WHERE status != 'paid') AS pending_total
  FROM worker_ledger_entries
  GROUP BY worker_id
) pending ON pending.worker_id = w.id
WHERE ABS(w.current_balance - COALESCE(pending.pending_total, 0)) > 0.01
GROUP BY w.company_id
ORDER BY total_drift_amount DESC;

-- ─── CHECK 3: GL-derived balance for all workers (canonical source) ───────────
-- This is what the UI should display after the cutover from current_balance.
-- getWorkersWithStats() already computes pendingAmount from this same source.
SELECT
  w.id AS worker_id,
  w.name,
  w.company_id,
  w.current_balance AS stale_cache,
  COALESCE(SUM(wle.amount) FILTER (WHERE wle.status != 'paid'), 0) AS canonical_pending_balance,
  COALESCE(SUM(wle.amount) FILTER (WHERE wle.status = 'paid'), 0) AS total_paid,
  COUNT(wle.id) FILTER (WHERE wle.status != 'paid') AS open_entry_count
FROM workers w
LEFT JOIN worker_ledger_entries wle ON wle.worker_id = w.id
GROUP BY w.id, w.name, w.company_id, w.current_balance
ORDER BY w.company_id, canonical_pending_balance DESC
LIMIT 100;

-- ─── CHECK 4: Workers with NO ledger entries but non-zero cache ───────────────
-- These are workers where current_balance was set directly without a ledger entry.
-- Their "balance" has no GL backing — it is a ghost amount.
SELECT
  w.id AS worker_id,
  w.name,
  w.company_id,
  w.current_balance AS cached_balance
FROM workers w
WHERE w.current_balance <> 0
  AND NOT EXISTS (
    SELECT 1 FROM worker_ledger_entries wle WHERE wle.worker_id = w.id
  )
ORDER BY ABS(w.current_balance) DESC;

-- ─── CHECK 5: Ledger entry integrity — amounts sum to expected ─────────────────
-- Confirm no ledger entries have NULL amounts or zero-amount entries
SELECT
  company_id,
  COUNT(*) AS total_entries,
  COUNT(*) FILTER (WHERE amount IS NULL) AS null_amount_entries,
  COUNT(*) FILTER (WHERE amount = 0) AS zero_amount_entries,
  COUNT(*) FILTER (WHERE status IS NULL) AS null_status_entries,
  COUNT(*) FILTER (WHERE status NOT IN ('paid', 'unpaid', 'partial')) AS unknown_status_entries
FROM worker_ledger_entries
GROUP BY company_id
ORDER BY company_id;
-- SUCCESS: null_amount_entries = 0, null_status_entries = 0, unknown_status_entries = 0
