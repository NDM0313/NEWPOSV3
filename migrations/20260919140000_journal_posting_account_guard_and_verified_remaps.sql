-- Additive: verified retired→active account remaps + JE line posting guard.
-- Does NOT rewrite history. Does NOT broaden AP/AR control rules.
-- Apply on staging first; do not run production repair in the same change.

CREATE TABLE IF NOT EXISTS public.journal_account_verified_remaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  from_account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  to_account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  source text NOT NULL DEFAULT 'manual',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT journal_account_verified_remaps_from_ne_to CHECK (from_account_id <> to_account_id),
  CONSTRAINT journal_account_verified_remaps_uniq UNIQUE (company_id, from_account_id)
);

CREATE INDEX IF NOT EXISTS idx_journal_account_verified_remaps_company
  ON public.journal_account_verified_remaps (company_id);

COMMENT ON TABLE public.journal_account_verified_remaps IS
  'Explicit verified from→to account maps for retired/inactive JE posting. No name inference; no arbitrary first AP/AR.';

ALTER TABLE public.journal_account_verified_remaps ENABLE ROW LEVEL SECURITY;

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

-- Seed from Sept16 merge backup when present (inactive legacy → AP). Idempotent.
DO $seed$
BEGIN
  IF to_regclass('backup_coa_merge_20260916.merge_pairs') IS NULL THEN
    RAISE NOTICE 'journal_account_verified_remaps: backup merge_pairs absent — skip seed';
    RETURN;
  END IF;

  INSERT INTO public.journal_account_verified_remaps (
    company_id, from_account_id, to_account_id, source, notes
  )
  SELECT
    mp.company_id,
    mp.legacy_id,
    mp.ap_id,
    'backup_coa_merge_20260916.merge_pairs',
    format('Verified Sept16 merge pair %s → %s (%s)', mp.legacy_code, mp.ap_code, mp.contact_code)
  FROM backup_coa_merge_20260916.merge_pairs mp
  INNER JOIN public.accounts leg
    ON leg.id = mp.legacy_id AND leg.company_id = mp.company_id
  INNER JOIN public.accounts ap
    ON ap.id = mp.ap_id AND ap.company_id = mp.company_id
  WHERE COALESCE(leg.is_active, true) = false
    AND COALESCE(ap.is_active, true) = true
  ON CONFLICT (company_id, from_account_id) DO NOTHING;
END
$seed$;

CREATE OR REPLACE FUNCTION public.resolve_journal_posting_account_id(
  p_company_id uuid,
  p_account_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acc RECORD;
  v_to uuid;
  v_to_active boolean;
  v_to_company uuid;
  v_code text;
BEGIN
  IF p_company_id IS NULL OR p_account_id IS NULL THEN
    RAISE EXCEPTION 'JOURNAL_ACCOUNT_REQUIRED: company_id and account_id are required'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT a.id, a.company_id, a.code, COALESCE(a.is_active, true) AS is_active
    INTO v_acc
  FROM public.accounts a
  WHERE a.id = p_account_id;

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

  IF v_acc.is_active THEN
    RETURN p_account_id;
  END IF;

  SELECT r.to_account_id INTO v_to
  FROM public.journal_account_verified_remaps r
  WHERE r.company_id = p_company_id
    AND r.from_account_id = p_account_id
  LIMIT 1;

  IF v_to IS NULL THEN
    v_code := COALESCE(NULLIF(trim(v_acc.code), ''), p_account_id::text);
    RAISE EXCEPTION
      'JOURNAL_ACCOUNT_RETIRED: account % is inactive/retired and has no verified remap. Choose the party''s active linked account (AP-/AR-/worker/courier leaf) or ask admin to add a verified remap.',
      v_code
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT a.company_id, COALESCE(a.is_active, true)
    INTO v_to_company, v_to_active
  FROM public.accounts a
  WHERE a.id = v_to;

  IF NOT FOUND OR v_to_company IS DISTINCT FROM p_company_id OR NOT v_to_active THEN
    RAISE EXCEPTION
      'JOURNAL_ACCOUNT_REMAP_INVALID: verified remap for % points to an unusable target. Fix journal_account_verified_remaps.',
      COALESCE(NULLIF(trim(v_acc.code), ''), p_account_id::text)
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN v_to;
END;
$$;

COMMENT ON FUNCTION public.resolve_journal_posting_account_id(uuid, uuid) IS
  'Active same-company account passes; inactive requires journal_account_verified_remaps (not linked_contact_id / not name).';

GRANT EXECUTE ON FUNCTION public.resolve_journal_posting_account_id(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_journal_posting_account_id(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.trg_guard_journal_entry_line_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_resolved uuid;
BEGIN
  -- Preserve historical lines when account_id is unchanged (edits/voids that do not retarget).
  IF TG_OP = 'UPDATE' AND NEW.account_id IS NOT DISTINCT FROM OLD.account_id THEN
    RETURN NEW;
  END IF;

  SELECT je.company_id INTO v_company_id
  FROM public.journal_entries je
  WHERE je.id = NEW.journal_entry_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'JOURNAL_ENTRY_MISSING: journal_entry_id % not found', NEW.journal_entry_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  v_resolved := public.resolve_journal_posting_account_id(v_company_id, NEW.account_id);
  NEW.account_id := v_resolved;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_journal_entry_line_account ON public.journal_entry_lines;
CREATE TRIGGER trg_guard_journal_entry_line_account
BEFORE INSERT OR UPDATE OF account_id ON public.journal_entry_lines
FOR EACH ROW
EXECUTE FUNCTION public.trg_guard_journal_entry_line_account();

COMMENT ON TRIGGER trg_guard_journal_entry_line_account ON public.journal_entry_lines IS
  'Reject missing/wrong-company/retired accounts or rewrite via verified remap; leave unchanged account_id alone for historical edits.';
