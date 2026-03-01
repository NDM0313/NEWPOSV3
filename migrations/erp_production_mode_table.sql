-- ============================================================================
-- ERP PRODUCTION MODE (Optional guard)
-- When this table has a row with enabled = true, treat environment as
-- production: no destructive migrations (no DROP TABLE, no ALTER TYPE).
-- Runner or process should check this before applying risky migrations.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.erp_production_mode (
  enabled boolean PRIMARY KEY DEFAULT true,
  enabled_at timestamptz DEFAULT now(),
  CONSTRAINT one_row CHECK (enabled = true)
);

DO $$ BEGIN
  EXECUTE 'COMMENT ON TABLE public.erp_production_mode IS ''If row exists: production mode — no DROP TABLE, no ALTER TYPE. Remove row to allow destructive migrations.''';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
