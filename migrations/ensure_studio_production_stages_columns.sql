-- Ensure studio_production_stages has stage_order and expected_cost (fixes replaceStages insert/409).
-- Run in Supabase SQL Editor if you get "replaceStages insert failed (stage_order may not exist)" or 409.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'studio_production_stages') THEN
    ALTER TABLE studio_production_stages ADD COLUMN IF NOT EXISTS stage_order INT;
    ALTER TABLE studio_production_stages ADD COLUMN IF NOT EXISTS expected_cost NUMERIC(15,2) DEFAULT 0;
    ALTER TABLE studio_production_stages ADD COLUMN IF NOT EXISTS expected_completion_date DATE;
    ALTER TABLE studio_production_stages ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;
    ALTER TABLE studio_production_stages ADD COLUMN IF NOT EXISTS journal_entry_id UUID;
  END IF;
END $$;
