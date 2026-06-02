-- Assign official CUS/SUP/WRK reference to contacts missing code (e.g. mobile-created before parity fix).

CREATE OR REPLACE FUNCTION public.assign_contact_reference_number(p_contact_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
  v_code TEXT;
  v_code_type TEXT;
BEGIN
  IF p_contact_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contact id is required');
  END IF;

  SELECT id, company_id, type, code, is_system_generated, system_type
  INTO v_row
  FROM contacts
  WHERE id = p_contact_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contact not found');
  END IF;

  IF coalesce(v_row.is_system_generated, false) = true
     OR coalesce(v_row.system_type, '') = 'walking_customer' THEN
    RETURN jsonb_build_object('success', false, 'error', 'System walk-in contact cannot be reassigned');
  END IF;

  IF v_row.code IS NOT NULL AND trim(v_row.code) != '' THEN
    RETURN jsonb_build_object(
      'success', true,
      'contact_id', v_row.id,
      'code', trim(v_row.code),
      'already_assigned', true
    );
  END IF;

  v_code_type := CASE v_row.type::text
    WHEN 'supplier' THEN 'SUP'
    WHEN 'worker' THEN 'WRK'
    ELSE 'CUS'
  END;

  BEGIN
    v_code := public.get_next_document_number_global(v_row.company_id, v_code_type);
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'Could not generate contact reference number');
  END;

  IF v_code IS NULL OR trim(v_code) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Could not generate contact reference number');
  END IF;

  UPDATE contacts
  SET code = v_code,
      updated_at = NOW()
  WHERE id = p_contact_id;

  RETURN jsonb_build_object('success', true, 'contact_id', p_contact_id, 'code', v_code);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reference number conflict. Please try again.');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'Could not assign reference number.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_contact_reference_number(UUID) TO authenticated;

COMMENT ON FUNCTION public.assign_contact_reference_number(UUID) IS
  'Assign CUS/SUP/WRK code from global sequence when contacts.code is empty (mobile backfill / manual fix).';
