-- Secure share links for statements, deals, attachments (Stitch share_secure_link_configuration)
-- Prerequisite: fx_users_profiles (from fx_foundation). fx_same_branch is created below if missing.
-- branch_id FK to fx_branches is added below only when that table already exists.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS fx_secure_share_links (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       UUID NOT NULL,
  entity_type     TEXT NOT NULL CHECK (entity_type IN (
    'party_ledger', 'deal', 'transaction', 'attachment', 'report'
  )),
  entity_id       UUID NOT NULL,
  token           TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  expires_at      TIMESTAMPTZ NOT NULL,
  allow_download  BOOLEAN NOT NULL DEFAULT true,
  password_hash   TEXT,
  created_by      UUID REFERENCES auth.users (id),
  revoked_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fx_secure_share_links_branch
  ON fx_secure_share_links (branch_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fx_secure_share_links_token
  ON fx_secure_share_links (token) WHERE revoked_at IS NULL;

DO $$
BEGIN
  IF to_regclass('public.fx_branches') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'fx_secure_share_links_branch_id_fkey'
     ) THEN
    ALTER TABLE fx_secure_share_links
      ADD CONSTRAINT fx_secure_share_links_branch_id_fkey
      FOREIGN KEY (branch_id) REFERENCES fx_branches (id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS fx_secure_share_access_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id     UUID NOT NULL REFERENCES fx_secure_share_links (id) ON DELETE CASCADE,
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_agent  TEXT
);

-- RLS helper (idempotent — same as 202606100004_fx_rls_policies.sql)
CREATE OR REPLACE FUNCTION fx_same_branch(p_branch_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM fx_users_profiles p
    WHERE p.id = auth.uid() AND p.branch_id = p_branch_id
  );
$$;

ALTER TABLE fx_secure_share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE fx_secure_share_access_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fx_secure_share_links_select ON fx_secure_share_links;
CREATE POLICY fx_secure_share_links_select ON fx_secure_share_links
  FOR SELECT USING (fx_same_branch(branch_id));

DROP POLICY IF EXISTS fx_secure_share_links_insert ON fx_secure_share_links;
CREATE POLICY fx_secure_share_links_insert ON fx_secure_share_links
  FOR INSERT WITH CHECK (fx_same_branch(branch_id));

DROP POLICY IF EXISTS fx_secure_share_links_update ON fx_secure_share_links;
CREATE POLICY fx_secure_share_links_update ON fx_secure_share_links
  FOR UPDATE USING (fx_same_branch(branch_id));

DROP POLICY IF EXISTS fx_secure_share_access_log_select ON fx_secure_share_access_log;
CREATE POLICY fx_secure_share_access_log_select ON fx_secure_share_access_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM fx_secure_share_links l
      WHERE l.id = link_id AND fx_same_branch(l.branch_id)
    )
  );

CREATE OR REPLACE FUNCTION fx_create_secure_share_link(
  p_entity_type TEXT,
  p_entity_id UUID,
  p_expires_at TIMESTAMPTZ,
  p_allow_download BOOLEAN DEFAULT true,
  p_password TEXT DEFAULT NULL
)
RETURNS TABLE (
  link_id UUID,
  token TEXT,
  share_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_branch_id UUID;
  v_token TEXT;
  v_link_id UUID;
  v_hash TEXT;
BEGIN
  SELECT branch_id INTO v_branch_id
  FROM fx_users_profiles
  WHERE id = auth.uid()
  LIMIT 1;

  IF v_branch_id IS NULL THEN
    RAISE EXCEPTION 'No branch context for user';
  END IF;

  v_token := encode(gen_random_bytes(24), 'hex');
  v_hash := CASE
    WHEN p_password IS NOT NULL AND length(trim(p_password)) > 0
    THEN crypt(p_password, gen_salt('bf'))
    ELSE NULL
  END;

  INSERT INTO fx_secure_share_links (
    branch_id, entity_type, entity_id, token,
    expires_at, allow_download, password_hash, created_by
  )
  VALUES (
    v_branch_id, p_entity_type, p_entity_id, v_token,
    p_expires_at, p_allow_download, v_hash, auth.uid()
  )
  RETURNING id, fx_secure_share_links.token INTO v_link_id, v_token;

  RETURN QUERY SELECT v_link_id, v_token, '/share/' || v_token;
END;
$$;

CREATE OR REPLACE FUNCTION fx_revoke_secure_share_link(p_link_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE fx_secure_share_links
  SET revoked_at = now()
  WHERE id = p_link_id
    AND branch_id IN (
      SELECT branch_id FROM fx_users_profiles WHERE id = auth.uid()
    );
END;
$$;

CREATE OR REPLACE FUNCTION fx_validate_share_token(
  p_token TEXT,
  p_password TEXT DEFAULT NULL
)
RETURNS TABLE (
  entity_type TEXT,
  entity_id UUID,
  allow_download BOOLEAN,
  branch_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row fx_secure_share_links%ROWTYPE;
BEGIN
  SELECT * INTO v_row
  FROM fx_secure_share_links
  WHERE token = p_token
    AND revoked_at IS NULL
    AND expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired link';
  END IF;

  IF v_row.password_hash IS NOT NULL THEN
    IF p_password IS NULL OR crypt(p_password, v_row.password_hash) != v_row.password_hash THEN
      RAISE EXCEPTION 'Password required or incorrect';
    END IF;
  END IF;

  INSERT INTO fx_secure_share_access_log (link_id) VALUES (v_row.id);

  RETURN QUERY SELECT
    v_row.entity_type,
    v_row.entity_id,
    v_row.allow_download,
    v_row.branch_id;
END;
$$;

GRANT EXECUTE ON FUNCTION fx_create_secure_share_link(
  TEXT, UUID, TIMESTAMPTZ, BOOLEAN, TEXT
) TO authenticated;
GRANT EXECUTE ON FUNCTION fx_revoke_secure_share_link(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION fx_validate_share_token(TEXT, TEXT) TO anon, authenticated;
