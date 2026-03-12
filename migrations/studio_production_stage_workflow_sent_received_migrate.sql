-- ============================================================================
-- Run AFTER studio_production_stage_workflow_sent_received.sql (adds sent_date, sent_to_worker).
-- ============================================================================
-- Migrate existing in_progress → sent_to_worker. Safe if sent_date not yet added (no-op).
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'studio_production_stages' AND column_name = 'sent_date'
  ) THEN
    UPDATE studio_production_stages
    SET status = 'sent_to_worker',
        sent_date = COALESCE(sent_date, assigned_at, updated_at)
    WHERE status = 'in_progress';
  END IF;
END $$;
