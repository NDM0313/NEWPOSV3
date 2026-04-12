-- verify_studio_v3_orders_without_cost_visibility.sql
-- Purpose: Identify V3 production orders that have cost breakdown records but
--          NO corresponding journal entries of any kind, confirming that
--          studioCostsService is blind to all V3 activity.
-- Severity: P1 — studioProductionV3Service posts no JEs; studioCostsService
--           reads only journal_entries with reference_type='studio_production_stage'
--           (from V1 stages). V3 orders are therefore invisible to cost reporting.
-- Run: read-only; no writes.
-- Expected output: all active V3 orders until JE posting is wired into V3.

SELECT
    o.id                                AS order_id,
    o.order_number,
    o.status                            AS order_status,
    o.created_at::DATE                  AS order_date,
    -- Cost breakdown summary
    COUNT(DISTINCT cb.id)               AS cost_breakdown_records,
    COALESCE(SUM(cb.amount), 0)         AS total_cost_on_breakdown,
    -- Stage summary
    COUNT(DISTINCT st.id)               AS stage_count,
    COUNT(DISTINCT st.id)
        FILTER (WHERE st.status = 'completed') AS completed_stages,
    -- Journal entry coverage — expected to be 0 for all V3 orders currently
    COUNT(DISTINCT je.id)               AS journal_entry_count
FROM studio_production_orders_v3 o
LEFT JOIN studio_production_cost_breakdown_v3 cb
    ON cb.production_id = o.id
LEFT JOIN studio_production_stages_v3 st
    ON st.order_id = o.id
LEFT JOIN journal_entries je
    ON je.reference_id = o.id::TEXT
    AND (je.is_void IS NULL OR je.is_void = FALSE)
WHERE
    o.status NOT IN ('cancelled', 'void')
GROUP BY o.id, o.order_number, o.status, o.created_at
HAVING
    -- Orders with cost data but no GL coverage
    COUNT(DISTINCT cb.id) > 0
    AND COUNT(DISTINCT je.id) = 0
ORDER BY o.created_at DESC;
