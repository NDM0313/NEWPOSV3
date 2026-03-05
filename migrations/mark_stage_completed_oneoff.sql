-- ============================================================================
-- One-off: Mark studio production stage as completed (OK)
-- Stage ID: 610b687e-cff0-423b-88a9-d614a1842dd1
-- Run in Supabase SQL Editor.
-- ============================================================================

UPDATE studio_production_stages
SET status = 'completed',
    completed_at = COALESCE(completed_at, NOW())
WHERE id = '610b687e-cff0-423b-88a9-d614a1842dd1'::uuid;

-- Verify
SELECT id, production_id, stage_type, status, cost, completed_at
FROM studio_production_stages
WHERE id = '610b687e-cff0-423b-88a9-d614a1842dd1'::uuid;
