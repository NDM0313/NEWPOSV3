-- Additive: verified retired→active account remaps + JE line posting guard.
-- Does NOT rewrite history. Does NOT broaden AP/AR control rules.
-- Apply on staging first; do not run production repair in the same change.
--
-- Fixes vs first draft:
-- - Trigger fires on account_id OR journal_entry_id (prevents JE reassignment bypass).
-- - Early-return only when BOTH account_id and journal_entry_id unchanged.
-- - SECURITY DEFINER resolver: REVOKE PUBLIC; company-scoped auth for direct calls;
--   internal GUC for trigger; repair GUC allows inactive restore without silent remap.
-- - Seed validates party identity from backup contact_id; conflicting maps FAIL reviewably.
-- - Remap events recorded narrowly for traceability.
-- - FOR UPDATE on remap/account rows for concurrent retirement vs posting.

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
  'Explicit verified from→to account maps for retired/inactive JE posting. Identity from backup contact_id, not names.';

-- Narrow audit of automatic remaps (not a full JE rewrite log).
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

-- No direct INSERT/UPDATE/DELETE for authenticated on remaps/events (service_role / migration only).
REVOKE ALL ON TABLE public.journal_account_verified_remaps FROM PUBLIC;
REVOKE ALL ON TABLE public.journal_account_guard_events FROM PUBLIC;
GRANT SELECT ON TABLE public.journal_account_verified_remaps TO authenticated;
GRANT SELECT ON TABLE public.journal_account_guard_events TO authenticated;
GRANT ALL ON TABLE public.journal_account_verified_remaps TO service_role;
GRANT ALL ON TABLE public.journal_account_guard_events TO service_role;

-- Seed from Sept16 merge backup when present. Conflicting existing map → FAIL (not DO NOTHING).
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
    RAISE NOTICE 'journal_account_verified_remaps: backup merge_pairs ABSENT — seed skipped (0 rows)';
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

    -- Target must still be linked to the backup party identity (not name matching).
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
    'journal_account_verified_remaps seed: eligible=% inserted=% identical_skip=%',
    v_eligible, v_inserted, v_skipped;
END
$seed$;

CREATE OR REPLACE FUNCTION public.resolve_journal_posting_account_id(
  p_company_id uuid,
  p_account_id uuid
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
  v_role text;
  v_mode text;
  v_internal text;
BEGIN
  IF p_company_id IS NULL OR p_account_id IS NULL THEN
    RAISE EXCEPTION 'JOURNAL_ACCOUNT_REQUIRED: company_id and account_id are required'
      USING ERRCODE = 'check_violation';
  END IF;

  v_internal := NULLIF(current_setting('app.journal_account_guard_internal', true), '');
  v_mode := NULLIF(current_setting('app.journal_account_guard_mode', true), '');
  v_role := coalesce(
    NULLIF(current_setting('request.jwt.claim.role', true), ''),
    NULLIF(current_setting('role', true), '')
  );

  -- Direct caller authorization (trigger sets internal=1).
  IF v_internal IS DISTINCT FROM '1' THEN
    IF v_role = 'service_role' THEN
      NULL;
    ELSIF v_role = 'authenticated' THEN
      IF public.get_user_company_id() IS DISTINCT FROM p_company_id THEN
        RAISE EXCEPTION
          'JOURNAL_ACCOUNT_FORBIDDEN: resolver limited to caller company scope'
          USING ERRCODE = 'insufficient_privilege';
      END IF;
    ELSIF v_role IN ('postgres', 'supabase_admin') OR session_user IN ('postgres', 'supabase_admin') THEN
      NULL; -- migrations / isolated tests
    ELSE
      RAISE EXCEPTION
        'JOURNAL_ACCOUNT_FORBIDDEN: not authorized to resolve journal posting accounts'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
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

  -- Repair/rollback window: allow writing inactive "from" accounts without remapping.
  IF v_mode = 'allow_inactive_restore' THEN
    RETURN p_account_id;
  END IF;

  IF v_acc.is_active THEN
    RETURN p_account_id;
  END IF;

  SELECT r.to_account_id, r.expected_contact_id
    INTO v_to, v_expected
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

  RETURN v_to;
END;
$$;

COMMENT ON FUNCTION public.resolve_journal_posting_account_id(uuid, uuid) IS
  'Active same-company account passes; inactive requires verified remap (backup identity). Repair mode GUC allows inactive restore.';

CREATE OR REPLACE FUNCTION public.trg_guard_journal_entry_line_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_resolved uuid;
  v_line_id uuid;
BEGIN
  -- Preserve historical lines only when the posting target AND parent JE are unchanged
  -- (description/debit/credit/void-adjacent edits that do not retarget).
  -- Reassignment of journal_entry_id must re-validate even if account_id is identical.
  IF TG_OP = 'UPDATE'
     AND NEW.account_id IS NOT DISTINCT FROM OLD.account_id
     AND NEW.journal_entry_id IS NOT DISTINCT FROM OLD.journal_entry_id THEN
    RETURN NEW;
  END IF;

  PERFORM set_config('app.journal_account_guard_internal', '1', true);

  SELECT je.company_id INTO v_company_id
  FROM public.journal_entries je
  WHERE je.id = NEW.journal_entry_id
  FOR SHARE;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'JOURNAL_ENTRY_MISSING: journal_entry_id % not found', NEW.journal_entry_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  v_resolved := public.resolve_journal_posting_account_id(v_company_id, NEW.account_id);

  IF v_resolved IS DISTINCT FROM NEW.account_id THEN
    v_line_id := CASE WHEN TG_OP = 'UPDATE' THEN NEW.id ELSE NULL END;
    INSERT INTO public.journal_account_guard_events (
      company_id, journal_entry_id, journal_entry_line_id, from_account_id, to_account_id, event_source
    ) VALUES (
      v_company_id, NEW.journal_entry_id, v_line_id, NEW.account_id, v_resolved, 'trigger_remap'
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

COMMENT ON TRIGGER trg_guard_journal_entry_line_account ON public.journal_entry_lines IS
  'Validate account/company on insert and on account_id or journal_entry_id change; remap via verified table; repair GUC for rollback.';

-- Narrow: refuse moving an account to another company when open JE lines exist.
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

-- journal_entries.company_id reassignment with lines: refuse (keeps line/company invariant).
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

REVOKE ALL ON FUNCTION public.resolve_journal_posting_account_id(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trg_guard_journal_entry_line_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_journal_posting_account_id(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_journal_posting_account_id(uuid, uuid) TO service_role;

COMMIT;
