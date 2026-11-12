-- W1 successor: fail-closed company + branch authorization for Import FX case reads.
-- Additive only. Does not edit 20260812013000.
-- Historical list/get remain readable when Multi Currency OFF; mutations unchanged.
-- Reuses get_user_company_id(), get_user_role(), has_branch_access() (unified ledger / RLS convention).
-- No journals/payments. Does not weaken RLS.

-- ---------------------------------------------------------------------------
-- A) Fail-closed company assert (no WHEN OTHERS, no NULL-company allow)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._import_fx_case_assert_company_access(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_auth_company uuid;
BEGIN
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_COMPANY_REQUIRED';
  END IF;

  -- Errors from get_user_company_id() must propagate (fail closed).
  v_auth_company := public.get_user_company_id();

  IF v_auth_company IS NULL THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_AUTH_COMPANY_REQUIRED';
  END IF;

  IF v_auth_company IS DISTINCT FROM p_company_id THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_COMPANY_MISMATCH';
  END IF;
END;
$$;

COMMENT ON FUNCTION public._import_fx_case_assert_company_access(uuid) IS
  'Fail-closed Import FX company gate. NULL session company and mismatches reject; never swallows resolver errors.';

-- ---------------------------------------------------------------------------
-- B) Company-wide role predicate (same role set as _unified_ledger_assert_caller_access)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._import_fx_case_caller_is_company_wide()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_role text;
BEGIN
  v_role := LOWER(TRIM(COALESCE(public.get_user_role()::text, '')));
  RETURN v_role IN (
    'admin', 'owner', 'super_admin', 'developer', 'accounting_auditor',
    'manager', 'accountant'
  );
END;
$$;

COMMENT ON FUNCTION public._import_fx_case_caller_is_company_wide() IS
  'True when caller role has company-wide branch access (unified ledger convention).';

-- ---------------------------------------------------------------------------
-- C) Branch helpers — has_branch_access + company-wide; NULL row = company-wide record
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._import_fx_case_assert_branch_param(p_branch_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_branch_id IS NULL THEN
    RETURN;
  END IF;

  IF public._import_fx_case_caller_is_company_wide() THEN
    RETURN;
  END IF;

  IF NOT public.has_branch_access(p_branch_id) THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_BRANCH_ACCESS_DENIED';
  END IF;
END;
$$;

COMMENT ON FUNCTION public._import_fx_case_assert_branch_param(uuid) IS
  'Rejects unauthorized explicit p_branch_id for branch-restricted callers.';

CREATE OR REPLACE FUNCTION public._import_fx_case_branch_row_allowed(p_row_branch_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Company-wide roles retain all-branch access (canonical).
  IF public._import_fx_case_caller_is_company_wide() THEN
    RETURN TRUE;
  END IF;

  -- Commission / payments RLS convention: NULL branch = company-wide row, visible;
  -- otherwise require has_branch_access. NULL filter must not expand to foreign branches.
  IF p_row_branch_id IS NULL THEN
    RETURN TRUE;
  END IF;

  RETURN public.has_branch_access(p_row_branch_id);
END;
$$;

COMMENT ON FUNCTION public._import_fx_case_branch_row_allowed(uuid) IS
  'Row visibility: company-wide role OR (NULL branch record) OR has_branch_access(row.branch_id).';

-- ---------------------------------------------------------------------------
-- D) list_import_fx_cases — company + branch authorized; readable when MC OFF
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_import_fx_cases(
  p_company_id uuid,
  p_branch_id uuid DEFAULT NULL,
  p_operational_status text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rows jsonb;
  v_total int;
  v_limit int := GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));
  v_offset int := GREATEST(0, COALESCE(p_offset, 0));
  v_q text := NULLIF(trim(COALESCE(p_search, '')), '');
  v_ops_enabled boolean;
BEGIN
  PERFORM public._import_fx_case_assert_company_access(p_company_id);
  PERFORM public._import_fx_case_assert_branch_param(p_branch_id);
  v_ops_enabled := public._company_import_fx_enabled(p_company_id);

  SELECT count(*)::int INTO v_total
  FROM public.import_fx_cases c
  WHERE c.company_id = p_company_id
    AND public._import_fx_case_branch_row_allowed(c.branch_id)
    AND (p_branch_id IS NULL OR c.branch_id = p_branch_id OR c.branch_id IS NULL)
    AND (p_operational_status IS NULL OR c.operational_status = p_operational_status)
    AND (
      v_q IS NULL
      OR c.case_no ILIKE '%' || v_q || '%'
      OR COALESCE(c.notes, '') ILIKE '%' || v_q || '%'
    );

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.updated_at DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      c.id,
      c.case_no,
      c.arrangement_type,
      c.operational_status,
      c.accounting_status,
      c.agent_contact_id,
      c.third_party_contact_id,
      c.planned_source_currency,
      c.planned_usd_amount,
      c.expected_pkr_per_usd,
      c.expected_cny_per_usd,
      c.expected_cny_amount,
      c.expected_fees_pkr,
      c.expected_completion_date,
      c.notes,
      c.branch_id,
      c.created_at,
      c.updated_at
      -- intentionally omit client_operation_id (idempotency internal)
    FROM public.import_fx_cases c
    WHERE c.company_id = p_company_id
      AND public._import_fx_case_branch_row_allowed(c.branch_id)
      AND (p_branch_id IS NULL OR c.branch_id = p_branch_id OR c.branch_id IS NULL)
      AND (p_operational_status IS NULL OR c.operational_status = p_operational_status)
      AND (
        v_q IS NULL
        OR c.case_no ILIKE '%' || v_q || '%'
        OR COALESCE(c.notes, '') ILIKE '%' || v_q || '%'
      )
    ORDER BY c.updated_at DESC
    LIMIT v_limit OFFSET v_offset
  ) t;

  RETURN jsonb_build_object(
    'ok', true,
    'total', v_total,
    'limit', v_limit,
    'offset', v_offset,
    'rows', v_rows,
    'read_only', NOT v_ops_enabled,
    'multi_currency_enabled', v_ops_enabled,
    'posts_journal', false
  );
END;
$$;

COMMENT ON FUNCTION public.list_import_fx_cases(uuid, uuid, text, text, int, int) IS
  'List Import FX cases after company+branch auth. Readable when Multi Currency OFF (historical). Never posts journals.';

-- ---------------------------------------------------------------------------
-- E) get_import_fx_case — company + case branch authorized; projected fields
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_import_fx_case(
  p_company_id uuid,
  p_case_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_case jsonb;
  v_case_branch uuid;
  v_stages jsonb;
  v_events jsonb;
  v_links jsonb;
  v_attachments jsonb;
  v_ops_enabled boolean;
BEGIN
  PERFORM public._import_fx_case_assert_company_access(p_company_id);
  v_ops_enabled := public._company_import_fx_enabled(p_company_id);

  SELECT
    c.branch_id,
    jsonb_build_object(
      'id', c.id,
      'company_id', c.company_id,
      'branch_id', c.branch_id,
      'case_no', c.case_no,
      'arrangement_type', c.arrangement_type,
      'operational_status', c.operational_status,
      'accounting_status', c.accounting_status,
      'agent_contact_id', c.agent_contact_id,
      'third_party_contact_id', c.third_party_contact_id,
      'planned_source_currency', c.planned_source_currency,
      'planned_usd_amount', c.planned_usd_amount,
      'expected_pkr_per_usd', c.expected_pkr_per_usd,
      'expected_cny_per_usd', c.expected_cny_per_usd,
      'expected_cny_amount', c.expected_cny_amount,
      'expected_fees_pkr', c.expected_fees_pkr,
      'expected_completion_date', c.expected_completion_date,
      'notes', c.notes,
      'created_by', c.created_by,
      'updated_by', c.updated_by,
      'created_at', c.created_at,
      'updated_at', c.updated_at
      -- omit client_operation_id
    )
  INTO v_case_branch, v_case
  FROM public.import_fx_cases c
  WHERE c.id = p_case_id AND c.company_id = p_company_id;

  IF v_case IS NULL THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_NOT_FOUND';
  END IF;

  IF NOT public._import_fx_case_branch_row_allowed(v_case_branch) THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_BRANCH_ACCESS_DENIED';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.stage_order), '[]'::jsonb)
  INTO v_stages
  FROM (
    SELECT
      s.id,
      s.case_id,
      s.stage_code,
      s.stage_order,
      s.stage_status,
      s.expected_at,
      s.completed_at,
      s.notes,
      s.created_at,
      s.updated_at
    FROM public.import_fx_case_stages s
    WHERE s.case_id = p_case_id AND s.company_id = p_company_id
  ) s;

  SELECT COALESCE(jsonb_agg(to_jsonb(e) ORDER BY e.created_at DESC), '[]'::jsonb)
  INTO v_events
  FROM (
    SELECT
      e.id,
      e.case_id,
      e.stage_id,
      e.event_type,
      e.event_status,
      e.posts_journal,
      e.payload,
      e.notes,
      e.reversal_of_event_id,
      e.created_by,
      e.created_at
      -- omit client_operation_id
    FROM public.import_fx_case_events e
    WHERE e.case_id = p_case_id AND e.company_id = p_company_id
    ORDER BY e.created_at DESC
    LIMIT 100
  ) e;

  SELECT COALESCE(jsonb_agg(to_jsonb(l) ORDER BY l.created_at), '[]'::jsonb)
  INTO v_links
  FROM (
    SELECT
      l.id,
      l.case_id,
      l.link_type,
      l.link_id,
      l.notes,
      l.created_at
    FROM public.import_fx_case_links l
    WHERE l.case_id = p_case_id AND l.company_id = p_company_id
  ) l;

  SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.created_at DESC), '[]'::jsonb)
  INTO v_attachments
  FROM (
    SELECT
      a.id,
      a.case_id,
      a.event_id,
      a.stage_id,
      a.file_name,
      a.mime_type,
      a.file_size,
      a.created_by,
      a.created_at
      -- omit storage_path (private storage metadata)
    FROM public.import_fx_case_attachments a
    WHERE a.case_id = p_case_id AND a.company_id = p_company_id
  ) a;

  RETURN jsonb_build_object(
    'ok', true,
    'case', v_case,
    'stages', v_stages,
    'events', v_events,
    'links', v_links,
    'attachments', v_attachments,
    'read_only', NOT v_ops_enabled,
    'multi_currency_enabled', v_ops_enabled,
    'posts_journal', false
  );
END;
$$;

COMMENT ON FUNCTION public.get_import_fx_case(uuid, uuid) IS
  'Get Import FX case after company+branch auth. Readable when Multi Currency OFF. Omits idempotency/storage internals. Never posts journals.';

-- ---------------------------------------------------------------------------
-- F) Privileges — helpers not client-executable; revoke PUBLIC/anon on RPCs
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public._import_fx_case_assert_company_access(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._import_fx_case_caller_is_company_wide()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._import_fx_case_assert_branch_param(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._import_fx_case_branch_row_allowed(uuid)
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.list_import_fx_cases(uuid, uuid, text, text, int, int)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_import_fx_case(uuid, uuid)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.list_import_fx_cases(uuid, uuid, text, text, int, int)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_import_fx_case(uuid, uuid)
  TO authenticated;
