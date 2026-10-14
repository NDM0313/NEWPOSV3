-- Wave 0 residual: claim client_operation_id BEFORE createSupplierPayment
-- so parallel tabs cannot create two PAY rows for the same intent.
-- Additive; Path 21 JE meaning unchanged.

CREATE OR REPLACE FUNCTION public.claim_import_fx_client_operation(
  p_company_id uuid,
  p_event_type text,
  p_client_operation_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.import_fx_client_operations%ROWTYPE;
BEGIN
  IF p_company_id IS NULL OR p_client_operation_id IS NULL OR p_event_type IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'company, event_type, and client_operation_id required');
  END IF;
  IF p_event_type NOT IN ('fx_credit', 'agent_settle', 'china_settle') THEN
    RETURN json_build_object('success', false, 'error', 'invalid event_type');
  END IF;

  SELECT * INTO v_row
  FROM public.import_fx_client_operations
  WHERE company_id = p_company_id
    AND event_type = p_event_type
    AND client_operation_id = p_client_operation_id
  LIMIT 1;

  IF FOUND THEN
    IF COALESCE(v_row.result_json->>'pending', '') = 'true' THEN
      RETURN json_build_object(
        'success', false,
        'code', 'IMPORT_FX_OPERATION_IN_PROGRESS',
        'error', 'IMPORT_FX_OPERATION_IN_PROGRESS: this operation is already in progress'
      );
    END IF;
    RETURN json_build_object(
      'success', true,
      'idempotent_replay', true,
      'claimed', false,
      'payment_id', v_row.payment_id,
      'journal_entry_id', v_row.journal_entry_id,
      'purchase_id', v_row.purchase_id,
      'fx_currency_purchase_id', v_row.fx_currency_purchase_id,
      'result', v_row.result_json
    );
  END IF;

  BEGIN
    INSERT INTO public.import_fx_client_operations (
      company_id, event_type, client_operation_id, result_json
    )
    VALUES (
      p_company_id, p_event_type, p_client_operation_id,
      jsonb_build_object('pending', true)
    );
  EXCEPTION WHEN unique_violation THEN
    SELECT * INTO v_row
    FROM public.import_fx_client_operations
    WHERE company_id = p_company_id
      AND event_type = p_event_type
      AND client_operation_id = p_client_operation_id
    LIMIT 1;
    IF COALESCE(v_row.result_json->>'pending', '') = 'true' THEN
      RETURN json_build_object(
        'success', false,
        'code', 'IMPORT_FX_OPERATION_IN_PROGRESS',
        'error', 'IMPORT_FX_OPERATION_IN_PROGRESS: this operation is already in progress'
      );
    END IF;
    RETURN json_build_object(
      'success', true,
      'idempotent_replay', true,
      'claimed', false,
      'payment_id', v_row.payment_id,
      'journal_entry_id', v_row.journal_entry_id,
      'result', v_row.result_json
    );
  END;

  RETURN json_build_object('success', true, 'claimed', true, 'idempotent_replay', false);
END;
$$;

COMMENT ON FUNCTION public.claim_import_fx_client_operation(uuid, text, uuid) IS
  'Wave 0: reserve client_operation_id before money write; replay returns prior result.';

GRANT EXECUTE ON FUNCTION public.claim_import_fx_client_operation(uuid, text, uuid)
  TO authenticated, service_role;

-- Finalize pending claim (or insert if claim was skipped)
CREATE OR REPLACE FUNCTION public.finalize_import_fx_client_operation(
  p_company_id uuid,
  p_event_type text,
  p_client_operation_id uuid,
  p_result_json jsonb,
  p_fx_currency_purchase_id uuid DEFAULT NULL,
  p_payment_id uuid DEFAULT NULL,
  p_journal_entry_id uuid DEFAULT NULL,
  p_purchase_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_existing jsonb;
  v_updated integer;
BEGIN
  IF p_company_id IS NULL OR p_client_operation_id IS NULL OR p_event_type IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'company, event_type, and client_operation_id required');
  END IF;

  UPDATE public.import_fx_client_operations
  SET
    result_json = COALESCE(p_result_json, '{}'::jsonb),
    fx_currency_purchase_id = COALESCE(p_fx_currency_purchase_id, fx_currency_purchase_id),
    payment_id = COALESCE(p_payment_id, payment_id),
    journal_entry_id = COALESCE(p_journal_entry_id, journal_entry_id),
    purchase_id = COALESCE(p_purchase_id, purchase_id)
  WHERE company_id = p_company_id
    AND event_type = p_event_type
    AND client_operation_id = p_client_operation_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    INSERT INTO public.import_fx_client_operations (
      company_id, event_type, client_operation_id,
      fx_currency_purchase_id, payment_id, journal_entry_id, purchase_id, result_json
    )
    VALUES (
      p_company_id, p_event_type, p_client_operation_id,
      p_fx_currency_purchase_id, p_payment_id, p_journal_entry_id, p_purchase_id,
      COALESCE(p_result_json, '{}'::jsonb)
    )
    ON CONFLICT (company_id, event_type, client_operation_id) DO UPDATE
    SET
      result_json = EXCLUDED.result_json,
      fx_currency_purchase_id = COALESCE(EXCLUDED.fx_currency_purchase_id, import_fx_client_operations.fx_currency_purchase_id),
      payment_id = COALESCE(EXCLUDED.payment_id, import_fx_client_operations.payment_id),
      journal_entry_id = COALESCE(EXCLUDED.journal_entry_id, import_fx_client_operations.journal_entry_id),
      purchase_id = COALESCE(EXCLUDED.purchase_id, import_fx_client_operations.purchase_id);
  END IF;

  SELECT result_json INTO v_existing
  FROM public.import_fx_client_operations
  WHERE company_id = p_company_id
    AND event_type = p_event_type
    AND client_operation_id = p_client_operation_id
  LIMIT 1;

  RETURN json_build_object('success', true, 'result', v_existing);
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalize_import_fx_client_operation(
  uuid, text, uuid, jsonb, uuid, uuid, uuid, uuid
) TO authenticated, service_role;

-- Drop stuck pending claim so the same client_operation_id can retry after a failed money write.
CREATE OR REPLACE FUNCTION public.release_import_fx_client_operation(
  p_company_id uuid,
  p_event_type text,
  p_client_operation_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_deleted integer;
BEGIN
  IF p_company_id IS NULL OR p_client_operation_id IS NULL OR p_event_type IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'company, event_type, and client_operation_id required');
  END IF;

  DELETE FROM public.import_fx_client_operations
  WHERE company_id = p_company_id
    AND event_type = p_event_type
    AND client_operation_id = p_client_operation_id
    AND COALESCE(result_json->>'pending', '') = 'true'
    AND payment_id IS NULL
    AND journal_entry_id IS NULL;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN json_build_object('success', true, 'released', v_deleted > 0);
END;
$$;

COMMENT ON FUNCTION public.release_import_fx_client_operation(uuid, text, uuid) IS
  'Wave 0: clear pending claim after failed settle so retry can re-claim.';

GRANT EXECUTE ON FUNCTION public.release_import_fx_client_operation(uuid, text, uuid)
  TO authenticated, service_role;
