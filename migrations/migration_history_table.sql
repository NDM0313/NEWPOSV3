-- ============================================================================
-- MIGRATION HISTORY (Immutable Migration Mode)
-- Run this once before any other migrations. Tracks applied migrations by
-- filename so the same migration is never applied twice.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.migration_history (
  id serial PRIMARY KEY,
  filename text UNIQUE NOT NULL,
  applied_at timestamptz DEFAULT now()
);

DO $$ BEGIN EXECUTE 'COMMENT ON TABLE public.migration_history IS ''Audit trail of applied migrations. Do not edit manually. Used by immutable migration runner to skip already-applied files.'''; EXCEPTION WHEN OTHERS THEN NULL; END $$;
