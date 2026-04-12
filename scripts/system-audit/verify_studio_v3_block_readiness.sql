-- =====================================================================
-- VERIFY: Studio V3 Block Readiness
-- Purpose : Confirm that the Studio V3 hard block (P1-5) is effective —
--           no new stage completions, confirm active order/stage state,
--           and assess what work would be needed to unblock V3.
-- Safe    : SELECT only. No modifications.
-- Context : 35_POST_PATCH_VERIFICATION_AND_REPAIR_RUNBOOK section 5,
--           32_P1_STUDIO_V3_ACCOUNTING_HARD_BLOCK,
--           34_STUDIO_VERSION_STRATEGY_FINAL
-- =====================================================================

-- ─── CHECK 1: V3 stage completions after the P1-5 block date ─────────────────
-- SUCCESS: 0 rows — no stages completed after the block was applied
-- FAILURE: Rows exist → block may not have deployed; or completion bypassed via API
SELECT
  sps.id AS stage_id,
  sps.order_id,
  sps.stage_name,
  sps.status,
  sps.updated_at,
  spo.company_id,
  spo.order_no
FROM studio_production_stages_v3 sps
JOIN studio_production_orders_v3 spo ON spo.id = sps.order_id
WHERE sps.status = 'completed'
  AND sps.updated_at > '2026-04-12'
ORDER BY sps.updated_at DESC;

-- ─── CHECK 2: V3 orders currently in-flight (active, not completed) ───────────
-- These orders have workers/stages that cannot be completed due to the block.
-- They need to be migrated to V1 or left open.
SELECT
  spo.id AS order_id,
  spo.order_no,
  spo.company_id,
  spo.status,
  spo.created_at,
  spo.updated_at,
  COUNT(sps.id) AS total_stages,
  COUNT(sps.id) FILTER (WHERE sps.status = 'completed') AS completed_stages,
  COUNT(sps.id) FILTER (WHERE sps.status = 'in_progress') AS in_progress_stages,
  COUNT(sps.id) FILTER (WHERE sps.status = 'pending') AS pending_stages
FROM studio_production_orders_v3 spo
LEFT JOIN studio_production_stages_v3 sps ON sps.order_id = spo.id
WHERE spo.status NOT IN ('completed', 'cancelled', 'void')
GROUP BY spo.id, spo.order_no, spo.company_id, spo.status, spo.created_at, spo.updated_at
ORDER BY spo.company_id, spo.created_at DESC;

-- ─── CHECK 3: V3 orders that have NO journal entries (the core problem) ───────
-- Every completed V3 order should have JEs if accounting was implemented.
-- This shows the full gap: completed orders with no accounting trail.
SELECT
  spo.id AS order_id,
  spo.order_no,
  spo.company_id,
  spo.status,
  spo.created_at,
  COUNT(je.id) AS je_count
FROM studio_production_orders_v3 spo
LEFT JOIN journal_entries je
  ON je.reference_id = spo.id
  AND je.reference_type IN ('studio_production', 'studio_order_v3')
  AND (je.is_void IS NULL OR je.is_void = FALSE)
WHERE spo.status = 'completed'
GROUP BY spo.id, spo.order_no, spo.company_id, spo.status, spo.created_at
HAVING COUNT(je.id) = 0
ORDER BY spo.company_id, spo.created_at;

-- ─── CHECK 4: Summary of V3 orders by status and company ─────────────────────
SELECT
  spo.company_id,
  spo.status,
  COUNT(*) AS order_count,
  MIN(spo.created_at) AS earliest_order,
  MAX(spo.created_at) AS latest_order
FROM studio_production_orders_v3 spo
GROUP BY spo.company_id, spo.status
ORDER BY spo.company_id, spo.status;

-- ─── CHECK 5: V3 worker cost entries (worker_ledger_entries linked to V3) ─────
-- Shows whether worker costs were being tracked even without accounting JEs.
-- These would need GL postings if V3 is ever unblocked and the JE layer added.
SELECT
  wle.company_id,
  COUNT(*) AS ledger_entries_for_v3,
  SUM(wle.amount) AS total_cost_in_ledger,
  MIN(wle.created_at) AS earliest,
  MAX(wle.created_at) AS latest
FROM worker_ledger_entries wle
WHERE wle.reference_type = 'studio_v3_stage'
   OR wle.reference_type = 'studio_production_v3'
GROUP BY wle.company_id
ORDER BY total_cost_in_ledger DESC;

-- ─── CHECK 6: V3 feature flag state (informational) ──────────────────────────
-- The studio_production_v3 feature flag controls V3 route visibility.
-- If the flag is ON for any company, V3 routes are accessible in the UI.
-- This check shows which companies have it enabled.
SELECT
  company_id,
  feature_flags ->> 'studio_production_v3' AS v3_flag_value,
  updated_at
FROM company_settings
WHERE feature_flags ->> 'studio_production_v3' IS NOT NULL
ORDER BY company_id;
-- If studio_production_v3 = 'true' for any company → users can navigate to V3 UI
-- (The UI block from Task 3 prevents completion, but users can still see the UI)
