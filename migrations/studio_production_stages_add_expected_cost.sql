-- Add missing columns to studio_production_stages (fix: "Could not find expected_cost in schema cache")
-- Run this in Supabase Dashboard → SQL Editor, or: psql $DATABASE_URL -f migrations/studio_production_stages_add_expected_cost.sql

-- 1. assigned_at
ALTER TABLE studio_production_stages
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;

-- 2. expected_cost
ALTER TABLE studio_production_stages
  ADD COLUMN IF NOT EXISTS expected_cost NUMERIC(15,2) DEFAULT 0;

-- 3. journal_entry_id (requires journal_entries table to exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'journal_entries') THEN
    ALTER TABLE studio_production_stages
      ADD COLUMN IF NOT EXISTS journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_studio_production_stages_journal_entry
      ON studio_production_stages(journal_entry_id) WHERE journal_entry_id IS NOT NULL;
  ELSE
    ALTER TABLE studio_production_stages
      ADD COLUMN IF NOT EXISTS journal_entry_id UUID;
  END IF;
END $$;
