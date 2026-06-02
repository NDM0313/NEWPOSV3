-- Ensure AR/AP party subledger accounts exist for a contact (mobile + web backfill).

CREATE OR REPLACE FUNCTION public.ensure_party_subledgers_for_contact(p_contact_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
  v_ar UUID;
  v_ap UUID;
BEGIN
  IF p_contact_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contact id is required');
  END IF;

  SELECT id, company_id, type INTO v_row
  FROM contacts
  WHERE id = p_contact_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contact not found');
  END IF;

  v_ar := NULL;
  v_ap := NULL;

  IF v_row.type::text IN ('customer', 'both') THEN
    v_ar := public._ensure_ar_subaccount_for_contact(v_row.company_id, v_row.id);
  END IF;

  IF v_row.type::text IN ('supplier', 'both') THEN
    v_ap := public._ensure_ap_subaccount_for_contact(v_row.company_id, v_row.id);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'contact_id', v_row.id,
    'ar_account_id', v_ar,
    'ap_account_id', v_ap
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_party_subledgers_for_contact(UUID) TO authenticated;

COMMENT ON FUNCTION public.ensure_party_subledgers_for_contact(UUID) IS
  'Create or resolve AR (1100) / AP (2000) subledger accounts for a contact. Used after mobile contact create and statement picker backfill.';
