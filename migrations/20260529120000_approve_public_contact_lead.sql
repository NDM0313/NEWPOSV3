-- Approve public-form leads: assign official contact code (CUS/SUP/WRK) and mark Approved.

CREATE OR REPLACE FUNCTION public.approve_public_contact_lead(p_contact_id UUID)
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

  SELECT id, company_id, type, code, created_from, lead_status
  INTO v_row
  FROM contacts
  WHERE id = p_contact_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contact not found');
  END IF;

  IF coalesce(v_row.created_from, '') != 'public_form' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This contact was not created from the public registration form');
  END IF;

  IF coalesce(v_row.lead_status, '') = 'Approved' AND v_row.code IS NOT NULL AND trim(v_row.code) != '' THEN
    RETURN jsonb_build_object('success', true, 'contact_id', v_row.id, 'code', trim(v_row.code), 'already_approved', true);
  END IF;

  IF v_row.code IS NOT NULL AND trim(v_row.code) != '' THEN
    UPDATE contacts
    SET lead_status = 'Approved', updated_at = NOW()
    WHERE id = p_contact_id;
    RETURN jsonb_build_object('success', true, 'contact_id', v_row.id, 'code', trim(v_row.code));
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
      lead_status = 'Approved',
      updated_at = NOW()
  WHERE id = p_contact_id;

  RETURN jsonb_build_object('success', true, 'contact_id', p_contact_id, 'code', v_code);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reference number conflict. Please try again.');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'Approval failed. Please try again.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_public_contact_lead(UUID) TO authenticated;
