-- Additive: verified retired→active account remaps + JE line posting guard.
-- Does NOT rewrite history. Does NOT broaden AP/AR control rules.
-- Apply on staging first; do not run production repair in the same change.
--
-- Security model (review hardening):
-- - Public resolve / repair are SECURITY INVOKER wrappers: authorization uses real
--   current_user (SET ROLE / ACL), never custom GUCs and never JWT text alone.
-- - Table work is in private SECURITY DEFINER helpers with EXECUTE revoked from roles.
-- - Inactive restore only via exact-line repair tickets inserted by privileged repair;
--   GUCs do not grant privilege and are not consulted for authorization.
-- - Trigger always resolves via private core; allow_inactive only when a matching
--   repair ticket exists for this line_id + restore account_id.

BEGIN;

CREATE TABLE IF NOT EXISTS public.journal_account_verified_remaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  from_account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  to_account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  expected_contact_id uuid NULL,
  from_code text NULL,
  to_code text NULL,
  source text NOT NULL DEFAULT 'manual',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT journal_account_verified_remaps_from_ne_to CHECK (from_account_id <> to_account_id),
  CONSTRAINT journal_account_verified_remaps_uniq UNIQUE (company_id, from_account_id)
);

CREATE INDEX IF NOT EXISTS idx_journal_account_verified_remaps_company
  ON public.journal_account_verified_remaps (company_id);

CREATE INDEX IF NOT EXISTS idx_journal_account_verified_remaps_to
  ON public.journal_account_verified_remaps (company_id, to_account_id);

COMMENT ON TABLE public.journal_account_verified_remaps IS
  'AUTOMATIC posting remap scope (retired→active). Distinct from historical line repair packages.';

CREATE TABLE IF NOT EXISTS public.journal_account_guard_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  journal_entry_id uuid NULL,
  journal_entry_line_id uuid NULL,
  from_account_id uuid NOT NULL,
  to_account_id uuid NOT NULL,
  event_source text NOT NULL DEFAULT 'trigger',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_journal_account_guard_events_company_created
  ON public.journal_account_guard_events (company_id, created_at DESC);

COMMENT ON TABLE public.journal_account_guard_events IS
  'Trace of automatic remaps and privileged repair restores. INSERT records journal_entry_line_id when available.';

-- Exact-line inactive-restore tickets. Not a privilege grant surface — only DEFINER repair inserts.
CREATE TABLE IF NOT EXISTS public._journal_account_repair_tickets (
  line_id uuid PRIMARY KEY,
  restore_account_id uuid NOT NULL,
  company_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

COMMENT ON TABLE public._journal_account_repair_tickets IS
  'Ephemeral exact-line restore tickets for privileged repair_restore. Not granted to clients.';

ALTER TABLE public.journal_account_verified_remaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_account_guard_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS journal_account_verified_remaps_select_company ON public.journal_account_verified_remaps;
CREATE POLICY journal_account_verified_remaps_select_company
  ON public.journal_account_verified_remaps
  FOR SELECT
  TO authenticated
  USING (
    company_id IS NOT NULL
    AND public.get_user_company_id() IS NOT NULL
    AND company_id = public.get_user_company_id()
  );

DROP POLICY IF EXISTS journal_account_guard_events_select_company ON public.journal_account_guard_events;
CREATE POLICY journal_account_guard_events_select_company
  ON public.journal_account_guard_events
  FOR SELECT
  TO authenticated
  USING (
    company_id IS NOT NULL
    AND public.get_user_company_id() IS NOT NULL
    AND company_id = public.get_user_company_id()
  );

REVOKE ALL ON TABLE public.journal_account_verified_remaps FROM PUBLIC;
REVOKE ALL ON TABLE public.journal_account_guard_events FROM PUBLIC;
REVOKE ALL ON TABLE public.journal_account_verified_remaps FROM anon;
REVOKE ALL ON TABLE public.journal_account_guard_events FROM anon;
GRANT SELECT ON TABLE public.journal_account_verified_remaps TO authenticated;
GRANT SELECT ON TABLE public.journal_account_guard_events TO authenticated;
GRANT ALL ON TABLE public.journal_account_verified_remaps TO service_role;
GRANT ALL ON TABLE public.journal_account_guard_events TO service_role;

REVOKE ALL ON TABLE public._journal_account_repair_tickets FROM PUBLIC;
REVOKE ALL ON TABLE public._journal_account_repair_tickets FROM anon;
REVOKE ALL ON TABLE public._journal_account_repair_tickets FROM authenticated;
REVOKE ALL ON TABLE public._journal_account_repair_tickets FROM service_role;

-- ---------------------------------------------------------------------------
-- Core resolve (no auth). Called only from SECURITY DEFINER wrappers we own.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._journal_account_guard_resolve_core(
  p_company_id uuid,
  p_account_id uuid,
  p_allow_inactive boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acc RECORD;
  v_to uuid;
  v_to_row RECORD;
  v_expected uuid;
  v_code text;
  v_from_code text;
  v_to_code text;
BEGIN
  IF p_company_id IS NULL OR p_account_id IS NULL THEN
    RAISE EXCEPTION 'JOURNAL_ACCOUNT_REQUIRED: company_id and account_id are required'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT a.id, a.company_id, a.code, COALESCE(a.is_active, true) AS is_active, a.linked_contact_id
    INTO v_acc
  FROM public.accounts a
  WHERE a.id = p_account_id
  FOR UPDATE OF a;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'JOURNAL_ACCOUNT_NOT_FOUND: account % does not exist. Refresh CoA and choose again.', p_account_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF v_acc.company_id IS DISTINCT FROM p_company_id THEN
    RAISE EXCEPTION
      'JOURNAL_ACCOUNT_WRONG_COMPANY: account % (%) belongs to another company.',
      COALESCE(NULLIF(trim(v_acc.code), ''), p_account_id::text),
      p_account_id
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_allow_inactive THEN
    RETURN p_account_id;
  END IF;

  IF v_acc.is_active THEN
    RETURN p_account_id;
  END IF;

  SELECT r.to_account_id, r.expected_contact_id, r.from_code, r.to_code
    INTO v_to, v_expected, v_from_code, v_to_code
  FROM public.journal_account_verified_remaps r
  WHERE r.company_id = p_company_id
    AND r.from_account_id = p_account_id
  FOR UPDATE OF r;

  IF v_to IS NULL THEN
    v_code := COALESCE(NULLIF(trim(v_acc.code), ''), p_account_id::text);
    RAISE EXCEPTION
      'JOURNAL_ACCOUNT_RETIRED: account % is inactive/retired and has no verified remap. Choose the party''s active linked account (AP-/AR-/worker/courier leaf) or ask admin to add a verified remap.',
      v_code
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT a.id, a.company_id, COALESCE(a.is_active, true) AS is_active, a.linked_contact_id, a.code
    INTO v_to_row
  FROM public.accounts a
  WHERE a.id = v_to
  FOR UPDATE OF a;

  IF NOT FOUND
     OR v_to_row.company_id IS DISTINCT FROM p_company_id
     OR NOT v_to_row.is_active THEN
    RAISE EXCEPTION
      'JOURNAL_ACCOUNT_REMAP_INVALID: verified remap for % points to an unusable target. Fix journal_account_verified_remaps.',
      COALESCE(NULLIF(trim(v_acc.code), ''), p_account_id::text)
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_expected IS NOT NULL AND v_to_row.linked_contact_id IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION
      'JOURNAL_ACCOUNT_REMAP_IDENTITY_MISMATCH: remap target % no longer linked to expected contact %. Review mapping.',
      COALESCE(NULLIF(trim(v_to_row.code), ''), v_to::text),
      v_expected
      USING ERRCODE = 'check_violation';
  END IF;

  -- Scope: legacy 2090/210xxx automatic maps must land on AP-* (supplier AP), not worker/courier controls.
  v_from_code := upper(trim(COALESCE(v_from_code, v_acc.code, '')));
  v_to_code := upper(trim(COALESCE(v_to_code, v_to_row.code, '')));
  IF v_from_code ~ '^210[0-9]+$' OR v_from_code = '2090' THEN
    IF v_to_code !~ '^AP-' THEN
      RAISE EXCEPTION
        'JOURNAL_ACCOUNT_REMAP_ROLE: legacy payable % must map to AP-* supplier leaf, not %.',
        v_from_code, v_to_code
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN v_to;
END;
$$;

REVOKE ALL ON FUNCTION public._journal_account_guard_resolve_core(uuid, uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._journal_account_guard_resolve_core(uuid, uuid, boolean) FROM anon;
REVOKE ALL ON FUNCTION public._journal_account_guard_resolve_core(uuid, uuid, boolean) FROM authenticated;
REVOKE ALL ON FUNCTION public._journal_account_guard_resolve_core(uuid, uuid, boolean) FROM service_role;

-- Effective role for SET ROLE / login (usable inside SECURITY DEFINER).
-- Custom GUCs (request.jwt.*, app.*) are NEVER used for privilege.
CREATE OR REPLACE FUNCTION public._journal_account_guard_effective_role()
RETURNS text
LANGUAGE plpgsql
STABLE
PARALLEL SAFE
AS $$
DECLARE
  v_role text;
BEGIN
  v_role := NULLIF(btrim(current_setting('role', true)), '');
  IF v_role IS NULL OR lower(v_role) = 'none' THEN
    RETURN session_user::text;
  END IF;
  RETURN v_role;
END;
$$;

REVOKE ALL ON FUNCTION public._journal_account_guard_effective_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public._journal_account_guard_effective_role() FROM anon;
REVOKE ALL ON FUNCTION public._journal_account_guard_effective_role() FROM authenticated;
REVOKE ALL ON FUNCTION public._journal_account_guard_effective_role() FROM service_role;

CREATE OR REPLACE FUNCTION public._journal_account_guard_assert_resolve_authorized(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  v_role := public._journal_account_guard_effective_role();

  IF v_role = 'authenticated' THEN
    IF public.get_user_company_id() IS DISTINCT FROM p_company_id THEN
      RAISE EXCEPTION
        'JOURNAL_ACCOUNT_FORBIDDEN: resolver limited to caller company scope'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN;
  END IF;

  IF v_role IN ('service_role', 'postgres', 'supabase_admin') THEN
    RETURN;
  END IF;

  RAISE EXCEPTION
    'JOURNAL_ACCOUNT_FORBIDDEN: not authorized to resolve journal posting accounts'
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

REVOKE ALL ON FUNCTION public._journal_account_guard_assert_resolve_authorized(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._journal_account_guard_assert_resolve_authorized(uuid) FROM anon;
REVOKE ALL ON FUNCTION public._journal_account_guard_assert_resolve_authorized(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public._journal_account_guard_assert_resolve_authorized(uuid) FROM service_role;

-- Client-executable DEFINER helper: MUST authorize itself (INVOKER wrapper is not enough).
CREATE OR REPLACE FUNCTION public._journal_account_guard_resolve_public_core(
  p_company_id uuid,
  p_account_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._journal_account_guard_assert_resolve_authorized(p_company_id);
  RETURN public._journal_account_guard_resolve_core(p_company_id, p_account_id, false);
END;
$$;

REVOKE ALL ON FUNCTION public._journal_account_guard_resolve_public_core(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._journal_account_guard_resolve_public_core(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public._journal_account_guard_resolve_public_core(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public._journal_account_guard_resolve_public_core(uuid, uuid) TO service_role;

-- Internal DEFINER resolve used only by the trigger (EXECUTE revoked from client roles).
CREATE OR REPLACE FUNCTION public._journal_account_guard_resolve_internal(
  p_company_id uuid,
  p_account_id uuid,
  p_line_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket_restore uuid;
  v_allow_inactive boolean := false;
BEGIN
  IF p_line_id IS NOT NULL THEN
    DELETE FROM public._journal_account_repair_tickets t
    WHERE t.line_id = p_line_id
      AND t.restore_account_id = p_account_id
      AND t.company_id = p_company_id
    RETURNING t.restore_account_id INTO v_ticket_restore;

    IF v_ticket_restore IS NOT NULL THEN
      v_allow_inactive := true;
    END IF;
  END IF;

  RETURN public._journal_account_guard_resolve_core(p_company_id, p_account_id, v_allow_inactive);
END;
$$;

REVOKE ALL ON FUNCTION public._journal_account_guard_resolve_internal(uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._journal_account_guard_resolve_internal(uuid, uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public._journal_account_guard_resolve_internal(uuid, uuid, uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public._journal_account_guard_resolve_internal(uuid, uuid, uuid) FROM service_role;

-- Public RPC: thin INVOKER wrapper; DEFINER helper self-authorizes (direct helper call cannot bypass).
CREATE OR REPLACE FUNCTION public.resolve_journal_posting_account_id(
  p_company_id uuid,
  p_account_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN public._journal_account_guard_resolve_public_core(p_company_id, p_account_id);
END;
$$;

COMMENT ON FUNCTION public.resolve_journal_posting_account_id(uuid, uuid) IS
  'Authorized public resolve (INVOKER). DEFINER helper enforces company/role itself; GUCs never grant privilege.';

-- Privileged exact-line restore (historical repair rollback). INVOKER gate + DEFINER work.
CREATE OR REPLACE FUNCTION public._repair_restore_journal_entry_line_account_internal(
  p_company_id uuid,
  p_line_id uuid,
  p_expected_current_account_id uuid,
  p_restore_account_id uuid,
  p_expected_debit numeric,
  p_expected_credit numeric,
  p_expected_journal_entry_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_line RECORD;
  v_je_company uuid;
  v_updated int;
BEGIN
  SELECT jel.id, jel.account_id, jel.debit, jel.credit, jel.journal_entry_id
    INTO v_line
  FROM public.journal_entry_lines jel
  WHERE jel.id = p_line_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'JOURNAL_REPAIR_LINE_MISSING: %', p_line_id;
  END IF;

  SELECT je.company_id INTO v_je_company
  FROM public.journal_entries je
  WHERE je.id = v_line.journal_entry_id;

  IF v_je_company IS DISTINCT FROM p_company_id THEN
    RAISE EXCEPTION 'JOURNAL_REPAIR_WRONG_COMPANY';
  END IF;

  IF p_expected_journal_entry_id IS NOT NULL
     AND v_line.journal_entry_id IS DISTINCT FROM p_expected_journal_entry_id THEN
    RAISE EXCEPTION 'JOURNAL_REPAIR_JE_MISMATCH: line moved to different journal';
  END IF;

  IF v_line.account_id IS DISTINCT FROM p_expected_current_account_id THEN
    RAISE EXCEPTION
      'JOURNAL_REPAIR_DRIFT: line % account is % (expected %). Abort — later edit detected.',
      p_line_id, v_line.account_id, p_expected_current_account_id;
  END IF;

  IF round(v_line.debit, 2) IS DISTINCT FROM round(p_expected_debit, 2)
     OR round(v_line.credit, 2) IS DISTINCT FROM round(p_expected_credit, 2) THEN
    RAISE EXCEPTION
      'JOURNAL_REPAIR_AMOUNT_DRIFT: line % debit/credit changed. Abort.',
      p_line_id;
  END IF;

  -- Validate restore target exists in company (inactive allowed for historical leaf).
  PERFORM public._journal_account_guard_resolve_core(p_company_id, p_restore_account_id, true);

  INSERT INTO public._journal_account_repair_tickets (line_id, restore_account_id, company_id)
  VALUES (p_line_id, p_restore_account_id, p_company_id)
  ON CONFLICT (line_id) DO UPDATE
    SET restore_account_id = EXCLUDED.restore_account_id,
        company_id = EXCLUDED.company_id,
        created_at = clock_timestamp();

  UPDATE public.journal_entry_lines
  SET account_id = p_restore_account_id
  WHERE id = p_line_id
    AND account_id = p_expected_current_account_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- Consume leftover ticket if trigger did not (e.g. same-account no-op path).
  DELETE FROM public._journal_account_repair_tickets WHERE line_id = p_line_id;

  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'JOURNAL_REPAIR_UPDATE_FAILED: concurrent change on %', p_line_id;
  END IF;

  INSERT INTO public.journal_account_guard_events (
    company_id, journal_entry_id, journal_entry_line_id, from_account_id, to_account_id, event_source
  ) VALUES (
    p_company_id, v_line.journal_entry_id, p_line_id,
    p_expected_current_account_id, p_restore_account_id, 'repair_restore'
  );

  RETURN p_restore_account_id;
END;
$$;

REVOKE ALL ON FUNCTION public._repair_restore_journal_entry_line_account_internal(uuid, uuid, uuid, uuid, numeric, numeric, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._repair_restore_journal_entry_line_account_internal(uuid, uuid, uuid, uuid, numeric, numeric, uuid) FROM anon;
REVOKE ALL ON FUNCTION public._repair_restore_journal_entry_line_account_internal(uuid, uuid, uuid, uuid, numeric, numeric, uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public._repair_restore_journal_entry_line_account_internal(uuid, uuid, uuid, uuid, numeric, numeric, uuid) FROM service_role;
-- Owner-only internal; public repair entry is SECURITY DEFINER and self-authorizes.

CREATE OR REPLACE FUNCTION public.repair_restore_journal_entry_line_account(
  p_company_id uuid,
  p_line_id uuid,
  p_expected_current_account_id uuid,
  p_restore_account_id uuid,
  p_expected_debit numeric,
  p_expected_credit numeric,
  p_expected_journal_entry_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  -- Self-authorize via SET ROLE / session_user. JWT/GUC text never grants privilege.
  v_role := public._journal_account_guard_effective_role();
  IF v_role NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
    RAISE EXCEPTION
      'JOURNAL_REPAIR_FORBIDDEN: inactive restore requires privileged repair role (service_role/admin), not a session GUC'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN public._repair_restore_journal_entry_line_account_internal(
    p_company_id,
    p_line_id,
    p_expected_current_account_id,
    p_restore_account_id,
    p_expected_debit,
    p_expected_credit,
    p_expected_journal_entry_id
  );
END;
$$;

COMMENT ON FUNCTION public.repair_restore_journal_entry_line_account(uuid, uuid, uuid, uuid, numeric, numeric, uuid) IS
  'Privileged exact-line inactive restore. DEFINER self-authorizes; ticket-scoped; GUCs never grant privilege.';

-- Trigger: private internal resolve only. GUCs ignored for privilege.
CREATE OR REPLACE FUNCTION public.trg_guard_journal_entry_line_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_resolved uuid;
  v_from uuid;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.account_id IS NOT DISTINCT FROM OLD.account_id
     AND NEW.journal_entry_id IS NOT DISTINCT FROM OLD.journal_entry_id THEN
    RETURN NEW;
  END IF;

  -- Ensure line id exists for INSERT so remap events are attributable.
  IF TG_OP = 'INSERT' AND NEW.id IS NULL THEN
    NEW.id := gen_random_uuid();
  END IF;

  SELECT je.company_id INTO v_company_id
  FROM public.journal_entries je
  WHERE je.id = NEW.journal_entry_id
  FOR SHARE;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'JOURNAL_ENTRY_MISSING: journal_entry_id % not found', NEW.journal_entry_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  v_from := NEW.account_id;
  v_resolved := public._journal_account_guard_resolve_internal(
    v_company_id, NEW.account_id, NEW.id
  );

  IF v_resolved IS DISTINCT FROM NEW.account_id THEN
    INSERT INTO public.journal_account_guard_events (
      company_id, journal_entry_id, journal_entry_line_id, from_account_id, to_account_id, event_source
    ) VALUES (
      v_company_id, NEW.journal_entry_id, NEW.id, v_from, v_resolved, 'trigger_remap'
    );
    NEW.account_id := v_resolved;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_journal_entry_line_account ON public.journal_entry_lines;
CREATE TRIGGER trg_guard_journal_entry_line_account
BEFORE INSERT OR UPDATE OF account_id, journal_entry_id ON public.journal_entry_lines
FOR EACH ROW
EXECUTE FUNCTION public.trg_guard_journal_entry_line_account();

-- Company reassignment guards
CREATE OR REPLACE FUNCTION public.trg_accounts_reject_company_reassign_with_lines()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.company_id IS DISTINCT FROM OLD.company_id
     AND EXISTS (
       SELECT 1 FROM public.journal_entry_lines jel WHERE jel.account_id = OLD.id LIMIT 1
     ) THEN
    RAISE EXCEPTION
      'ACCOUNT_COMPANY_REASSIGN_BLOCKED: account % has journal lines; refuse company_id change.',
      COALESCE(NULLIF(trim(OLD.code), ''), OLD.id::text)
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_accounts_reject_company_reassign_with_lines ON public.accounts;
CREATE TRIGGER trg_accounts_reject_company_reassign_with_lines
BEFORE UPDATE OF company_id ON public.accounts
FOR EACH ROW
EXECUTE FUNCTION public.trg_accounts_reject_company_reassign_with_lines();

CREATE OR REPLACE FUNCTION public.trg_journal_entries_reject_company_reassign()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.company_id IS DISTINCT FROM OLD.company_id
     AND EXISTS (
       SELECT 1 FROM public.journal_entry_lines jel WHERE jel.journal_entry_id = OLD.id LIMIT 1
     ) THEN
    RAISE EXCEPTION
      'JOURNAL_COMPANY_REASSIGN_BLOCKED: journal entry % has lines; refuse company_id change.',
      COALESCE(NULLIF(trim(OLD.entry_no), ''), OLD.id::text)
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_journal_entries_reject_company_reassign ON public.journal_entries;
CREATE TRIGGER trg_journal_entries_reject_company_reassign
BEFORE UPDATE OF company_id ON public.journal_entries
FOR EACH ROW
EXECUTE FUNCTION public.trg_journal_entries_reject_company_reassign();

-- Seed from Sept16 merge backup when present. Conflicting existing map → FAIL.
-- AUTOMATIC remap scope only — historical IBRAHIM line repair is a separate package.
DO $seed$
DECLARE
  r RECORD;
  v_existing uuid;
  v_to_link uuid;
  v_inserted int := 0;
  v_skipped int := 0;
  v_eligible int := 0;
BEGIN
  IF to_regclass('backup_coa_merge_20260916.merge_pairs') IS NULL THEN
    RAISE NOTICE 'journal_account_verified_remaps: backup merge_pairs ABSENT — seed skipped (0 rows). AUTOMATIC remap scope empty until backup present or manual verified inserts.';
    RETURN;
  END IF;

  FOR r IN
    SELECT
      mp.company_id,
      mp.legacy_id,
      mp.ap_id,
      mp.contact_id,
      mp.legacy_code,
      mp.ap_code,
      mp.contact_code
    FROM backup_coa_merge_20260916.merge_pairs mp
    INNER JOIN public.accounts leg
      ON leg.id = mp.legacy_id AND leg.company_id = mp.company_id
    INNER JOIN public.accounts ap
      ON ap.id = mp.ap_id AND ap.company_id = mp.company_id
    WHERE COALESCE(leg.is_active, true) = false
      AND COALESCE(ap.is_active, true) = true
  LOOP
    v_eligible := v_eligible + 1;

    IF upper(trim(COALESCE(r.ap_code, ''))) !~ '^AP-' THEN
      RAISE EXCEPTION
        'JOURNAL_REMAP_ROLE: backup pair %→% is not AP-* — refuse auto-seed (worker/courier must not enter supplier AP map).',
        r.legacy_code, r.ap_code;
    END IF;

    SELECT ap.linked_contact_id INTO v_to_link
    FROM public.accounts ap
    WHERE ap.id = r.ap_id
    FOR UPDATE;

    IF r.contact_id IS NOT NULL AND v_to_link IS DISTINCT FROM r.contact_id THEN
      RAISE EXCEPTION
        'JOURNAL_REMAP_IDENTITY_MISMATCH: backup contact % for %→% but AP linked_contact_id is %. Review before seeding.',
        r.contact_id, r.legacy_code, r.ap_code, v_to_link;
    END IF;

    SELECT m.to_account_id INTO v_existing
    FROM public.journal_account_verified_remaps m
    WHERE m.company_id = r.company_id
      AND m.from_account_id = r.legacy_id
    FOR UPDATE;

    IF FOUND THEN
      IF v_existing IS DISTINCT FROM r.ap_id THEN
        RAISE EXCEPTION
          'JOURNAL_REMAP_CONFLICT: existing map for % (%) → % but backup wants %. Manual review required (not overwritten).',
          r.legacy_code, r.legacy_id, v_existing, r.ap_id;
      END IF;
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    INSERT INTO public.journal_account_verified_remaps (
      company_id, from_account_id, to_account_id, expected_contact_id,
      from_code, to_code, source, notes
    ) VALUES (
      r.company_id, r.legacy_id, r.ap_id, r.contact_id,
      r.legacy_code, r.ap_code,
      'backup_coa_merge_20260916.merge_pairs',
      format('Verified Sept16 merge pair %s → %s (%s)', r.legacy_code, r.ap_code, r.contact_code)
    );
    v_inserted := v_inserted + 1;
  END LOOP;

  RAISE NOTICE
    'journal_account_verified_remaps AUTOMATIC_SCOPE seed: eligible=% inserted=% identical_skip=% (HISTORICAL_REPAIR_SCOPE=IBRAHIM 2 lines separate package; ID LACE=NOT_IMPLEMENTED)',
    v_eligible, v_inserted, v_skipped;
END
$seed$;

-- Effective ACLs: revoke PUBLIC and explicit role grants, then grant minimally.
REVOKE ALL ON FUNCTION public.resolve_journal_posting_account_id(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_journal_posting_account_id(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.resolve_journal_posting_account_id(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_journal_posting_account_id(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.repair_restore_journal_entry_line_account(uuid, uuid, uuid, uuid, numeric, numeric, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.repair_restore_journal_entry_line_account(uuid, uuid, uuid, uuid, numeric, numeric, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.repair_restore_journal_entry_line_account(uuid, uuid, uuid, uuid, numeric, numeric, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.repair_restore_journal_entry_line_account(uuid, uuid, uuid, uuid, numeric, numeric, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.trg_guard_journal_entry_line_account() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trg_guard_journal_entry_line_account() FROM anon;
REVOKE ALL ON FUNCTION public.trg_guard_journal_entry_line_account() FROM authenticated;

-- Drop obsolete internal GUC-based helper if a prior draft installed it.
DROP FUNCTION IF EXISTS public._journal_account_caller_is_privileged_repair();

COMMIT;
