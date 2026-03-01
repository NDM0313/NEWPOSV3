-- ============================================================================
-- MIGRATION HISTORY & PRODUCTION GUARD (IMMUTABLE MIGRATION MODE)
-- Run once before other migrations. Creates:
-- 1) migration_history — audit trail of applied migrations (no re-run).
-- 2) erp_production_mode — when present, runner blocks DROP TABLE / ALTER TYPE.
-- ============================================================================

-- Audit trail: one row per applied migration. Runner checks this before each run.
CREATE TABLE IF NOT EXISTS public.migration_history (
  id serial PRIMARY KEY,
  filename text UNIQUE NOT NULL,
  applied_at timestamptz DEFAULT now()
);

DO $$ BEGIN EXECUTE 'COMMENT ON TABLE public.migration_history IS ''Immutable migration mode: only run each filename once. Source of truth for applied migrations.'''; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Optional production guard: when this table has a row with enabled = true,
-- the migration runner must not execute destructive statements (DROP TABLE, ALTER TYPE).
CREATE TABLE IF NOT EXISTS public.erp_production_mode (
  enabled boolean PRIMARY KEY DEFAULT true,
  enabled_at timestamptz DEFAULT now(),
  CONSTRAINT one_row CHECK (enabled = true)
);

DO $$ BEGIN EXECUTE 'COMMENT ON TABLE public.erp_production_mode IS ''When present, migration runner blocks DROP TABLE and ALTER TYPE. Remove table or row to allow destructive migrations.'''; EXCEPTION WHEN OTHERS THEN NULL; END $$;
