-- =============================================================================
-- Studio Sales: Deadline + Notes persistence (run this on Supabase SQL Editor)
-- =============================================================================
-- Without these columns, Deadline and Notes from the Sale Form are not saved.
-- Run once per environment (local, VPS, staging).
-- =============================================================================

-- 1. notes TEXT – Sale form notes (Studio: can include "StudioDeadline:YYYY-MM-DD" prefix)
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2. deadline DATE – Delivery/deadline for studio production (Studio Sales list + Pipeline)
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS deadline DATE;

COMMENT ON COLUMN sales.notes IS 'Sale notes. Persisted from Sale Form. Studio: may contain StudioDeadline:YYYY-MM-DD.';
COMMENT ON COLUMN sales.deadline IS 'Delivery/deadline date (Studio Sales). Persisted from Sale Form → Studio list + Pipeline.';
