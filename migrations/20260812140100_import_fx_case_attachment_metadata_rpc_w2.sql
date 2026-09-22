-- Wave W2d: Import FX Case attachment metadata RPC (non-posting).
-- Does NOT restore table privileges. Does NOT upload Storage objects.
-- Does NOT return storage_path. Marks rows is_metadata_only=true.
-- Requires: 20260812140000_import_fx_case_arrangement_enrichment_w2.sql

CREATE OR REPLACE FUNCTION public.register_import_fx_case_attachment_metadata(
  p_company_id uuid,
  p_case_id uuid,
  p_file_name text,
  p_mime_type text DEFAULT NULL,
  p_file_size bigint DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL,
  p_client_operation_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_case public.import_fx_cases%ROWTYPE;
  v_id uuid;
  v_event_id uuid;
  v_name text;
  v_path text;
BEGIN
  PERFORM public._import_fx_case_assert_company_access(p_company_id);

  IF NOT public._company_import_fx_enabled(p_company_id) THEN
    RAISE EXCEPTION 'MULTI_CURRENCY_DISABLED: Import FX Case requires Multi Currency Enabled';
  END IF;

  SELECT * INTO v_case
  FROM public.import_fx_cases
  WHERE id = p_case_id AND company_id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_NOT_FOUND';
  END IF;

  IF NOT public._import_fx_case_branch_row_allowed(v_case.branch_id) THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_BRANCH_ACCESS_DENIED';
  END IF;

  IF v_case.operational_status IN ('CANCELLED', 'REVERSED') THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_NOT_EDITABLE: %', v_case.operational_status;
  END IF;

  v_name := NULLIF(trim(COALESCE(p_file_name, '')), '');
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_ATTACHMENT_NAME_REQUIRED';
  END IF;

  IF p_file_size IS NOT NULL AND p_file_size < 0 THEN
    RAISE EXCEPTION 'IMPORT_FX_CASE_NEGATIVE_AMOUNT: file_size';
  END IF;

  IF p_client_operation_id IS NOT NULL THEN
    SELECT e.id, (e.payload->>'attachment_id')::uuid
    INTO v_event_id, v_id
    FROM public.import_fx_case_events e
    WHERE e.company_id = p_company_id
      AND e.case_id = p_case_id
      AND e.event_type = 'ATTACHMENT_METADATA_REGISTERED'
      AND e.client_operation_id = p_client_operation_id
    LIMIT 1;
    IF v_event_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'ok', true,
        'attachment_id', v_id,
        'event_id', v_event_id,
        'is_metadata_only', true,
        'file_uploaded', false,
        'posts_journal', false,
        'idempotent_replay', true
      );
    END IF;
  END IF;

  v_path := 'metadata-only://w2/' || gen_random_uuid()::text;

  INSERT INTO public.import_fx_case_attachments (
    company_id, case_id, storage_path, file_name, mime_type, file_size,
    created_by, is_metadata_only
  )
  VALUES (
    p_company_id, p_case_id, v_path, v_name, NULLIF(trim(COALESCE(p_mime_type, '')), ''),
    p_file_size, p_created_by, true
  )
  RETURNING id INTO v_id;

  INSERT INTO public.import_fx_case_events (
    company_id, case_id, event_type, event_status, posts_journal, payload, notes,
    client_operation_id, created_by
  )
  VALUES (
    p_company_id, p_case_id, 'ATTACHMENT_METADATA_REGISTERED', 'RECORDED', false,
    jsonb_build_object(
      'attachment_id', v_id,
      'file_name', v_name,
      'is_metadata_only', true,
      'file_uploaded', false,
      'wave', 'W2'
    ),
    p_notes,
    p_client_operation_id,
    p_created_by
  )
  RETURNING id INTO v_event_id;

  RETURN jsonb_build_object(
    'ok', true,
    'attachment_id', v_id,
    'event_id', v_event_id,
    'file_name', v_name,
    'is_metadata_only', true,
    'file_uploaded', false,
    'posts_journal', false,
    'idempotent_replay', false
  );
END;
$$;

COMMENT ON FUNCTION public.register_import_fx_case_attachment_metadata(
  uuid, uuid, text, text, bigint, text, uuid, uuid
) IS
  'W2 register attachment METADATA only. No Storage upload. Omits storage_path from response. posts_journal=false.';

REVOKE ALL ON FUNCTION public.register_import_fx_case_attachment_metadata(
  uuid, uuid, text, text, bigint, text, uuid, uuid
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_import_fx_case_attachment_metadata(
  uuid, uuid, text, text, bigint, text, uuid, uuid
) TO authenticated;

REVOKE ALL ON TABLE public.import_fx_case_attachments FROM PUBLIC, anon, authenticated;
