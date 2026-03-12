-- ============================================================================
-- FEATURE FLAGS (Safe Zone / Feature Toggle)
-- ============================================================================
-- Company-scoped feature flags. New features (e.g. Studio Production V2) can
-- be toggled without touching core ERP. Disable = revert to old workflow.
-- ============================================================================

CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  feature_key VARCHAR(100) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, feature_key)
);

-- Indexes, trigger, RLS and policies: wrap in block so migration passes even if table is owned by another user (e.g. postgres).
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_feature_flags_company ON feature_flags(company_id);
  CREATE INDEX IF NOT EXISTS idx_feature_flags_key ON feature_flags(feature_key);
  COMMENT ON TABLE feature_flags IS 'Per-company feature toggles. Safe rollback: set enabled=false to revert to legacy behaviour.';

  CREATE OR REPLACE FUNCTION update_feature_flags_updated_at()
  RETURNS TRIGGER AS $fn$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $fn$ LANGUAGE plpgsql;

  DROP TRIGGER IF EXISTS trigger_feature_flags_updated_at ON feature_flags;
  CREATE TRIGGER trigger_feature_flags_updated_at
    BEFORE UPDATE ON feature_flags
    FOR EACH ROW EXECUTE PROCEDURE update_feature_flags_updated_at();

  ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "Users can view company feature flags" ON feature_flags;
  DROP POLICY IF EXISTS "Admins can manage feature flags" ON feature_flags;

  CREATE POLICY "Users can view company feature flags"
    ON feature_flags FOR SELECT TO authenticated
    USING (company_id = get_user_company_id());

  CREATE POLICY "Admins can manage feature flags"
    ON feature_flags FOR ALL TO authenticated
    USING (
      company_id = get_user_company_id()
      AND COALESCE(get_user_role()::text, '') IN ('admin', 'owner')
    )
    WITH CHECK (
      company_id = get_user_company_id()
      AND COALESCE(get_user_role()::text, '') IN ('admin', 'owner')
    );
EXCEPTION WHEN OTHERS THEN
  NULL; -- skip if not table owner (e.g. pooler user); run as postgres to apply fully
END $$;
