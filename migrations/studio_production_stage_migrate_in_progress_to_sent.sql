-- ============================================================================
-- Run AFTER studio_production_stage_workflow_sent_received.sql is committed.
-- New enum values must be committed before they can be used in UPDATE.
-- ============================================================================
-- Migrate existing in_progress → sent_to_worker (item already with worker).
-- Web/Mobile studio: no behaviour change; existing rows just show as "In Progress" with new status.
-- ============================================================================

UPDATE studio_production_stages
SET status = 'sent_to_worker',
    sent_date = COALESCE(sent_date, assigned_at, updated_at)
WHERE status = 'in_progress';
