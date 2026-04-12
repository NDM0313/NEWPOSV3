-- verify_studio_v3_stage_completion_without_journal.sql
-- Purpose: Find every completed V3 production stage that has no journal entry
--          with reference_id matching the stage or its parent order.
-- Severity: P1 — studioProductionV3Service posts no JE on stage completion.
--           Worker cost accruals, COGS, and production cost entries are
--           therefore absent from the GL for all V3 work completed to date.
-- Run: read-only; no writes.
-- Expected output: every completed V3 stage until JE posting is implemented.

SELECT
    st.id                               AS stage_id,
    st.stage_name,
    st.status                           AS stage_status,
    st.completed_at::DATE               AS completed_date,
    o.id                                AS order_id,
    o.order_number,
    o.status                            AS order_status,
    -- Cost data recorded on cost_breakdown (accounting source of truth when JEs exist)
    cb.id                               AS cost_breakdown_id,
    cb.amount                           AS breakdown_amount,
    cb.cost_type,
    -- JE lookup: check both stage-level and order-level references
    je_stage.id                         AS stage_level_je_id,
    je_order.id                         AS order_level_je_id
FROM studio_production_stages_v3 st
JOIN studio_production_orders_v3 o
    ON o.id = st.order_id
LEFT JOIN studio_production_cost_breakdown_v3 cb
    ON cb.production_id = o.id
-- Check for a stage-level JE
LEFT JOIN journal_entries je_stage
    ON je_stage.reference_id   = st.id::TEXT
    AND (je_stage.is_void IS NULL OR je_stage.is_void = FALSE)
-- Check for an order-level JE covering this stage
LEFT JOIN journal_entries je_order
    ON je_order.reference_id   = o.id::TEXT
    AND je_order.reference_type = 'studio_production_stage'
    AND (je_order.is_void IS NULL OR je_order.is_void = FALSE)
WHERE
    st.status = 'completed'
    AND je_stage.id  IS NULL
    AND je_order.id  IS NULL
ORDER BY st.completed_at DESC NULLS LAST;
