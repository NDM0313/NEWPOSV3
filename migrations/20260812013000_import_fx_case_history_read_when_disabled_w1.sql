-- W1 successor: historical Import FX cases remain readable when Multi Currency is OFF.
-- Additive: replaces list/get only. Mutations keep MULTI_CURRENCY_DISABLED gate.
-- No journals/payments. Does not weaken RLS.

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

  BEGIN
    v_auth_company := public.get_user_company_id();
  EXCEPTION
    WHEN undefined_function THEN
      v_auth_company := NULL;
    WHEN OTHERS THEN
      v_auth_company := NULL;
  END;

  IF v_auth_company IS NOT NULL AND v_auth_company IS DISTINCT FROM p_company_id THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_COMPANY_MISMATCH';
  END IF;
END;
$$;

COMMENT ON FUNCTION public._import_fx_case_assert_company_access(uuid) IS
  'Rejects caller company_id spoofing when session company is set. Used by Import FX case read/write RPCs.';

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
  -- Reads allowed when Multi Currency is OFF (historical audit). Mutations stay gated elsewhere.
  PERFORM public._import_fx_case_assert_company_access(p_company_id);
  v_ops_enabled := public._company_import_fx_enabled(p_company_id);

  SELECT count(*)::int INTO v_total
  FROM public.import_fx_cases c
  WHERE c.company_id = p_company_id
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
      c.expected_cny_amount,
      c.expected_completion_date,
      c.notes,
      c.branch_id,
      c.created_at,
      c.updated_at
    FROM public.import_fx_cases c
    WHERE c.company_id = p_company_id
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
  'List Import FX cases. Readable when Multi Currency OFF (historical). Never posts journals.';

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
  v_stages jsonb;
  v_events jsonb;
  v_links jsonb;
  v_attachments jsonb;
  v_ops_enabled boolean;
BEGIN
  PERFORM public._import_fx_case_assert_company_access(p_company_id);
  v_ops_enabled := public._company_import_fx_enabled(p_company_id);

  SELECT to_jsonb(c) INTO v_case
  FROM public.import_fx_cases c
  WHERE c.id = p_case_id AND c.company_id = p_company_id;

  IF v_case IS NULL THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_NOT_FOUND';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.stage_order), '[]'::jsonb)
  INTO v_stages
  FROM public.import_fx_case_stages s
  WHERE s.case_id = p_case_id AND s.company_id = p_company_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(e) ORDER BY e.created_at DESC), '[]'::jsonb)
  INTO v_events
  FROM (
    SELECT * FROM public.import_fx_case_events
    WHERE case_id = p_case_id AND company_id = p_company_id
    ORDER BY created_at DESC
    LIMIT 100
  ) e;

  SELECT COALESCE(jsonb_agg(to_jsonb(l) ORDER BY l.created_at), '[]'::jsonb)
  INTO v_links
  FROM public.import_fx_case_links l
  WHERE l.case_id = p_case_id AND l.company_id = p_company_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.created_at DESC), '[]'::jsonb)
  INTO v_attachments
  FROM public.import_fx_case_attachments a
  WHERE a.case_id = p_case_id AND a.company_id = p_company_id;

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
  'Get Import FX case detail. Readable when Multi Currency OFF (historical). Never posts journals.';

GRANT EXECUTE ON FUNCTION public._import_fx_case_assert_company_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_import_fx_cases(uuid, uuid, text, text, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_import_fx_case(uuid, uuid) TO authenticated;
