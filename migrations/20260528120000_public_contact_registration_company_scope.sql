-- Company/branch-scoped public contact registration (additive).
-- When p_company_id is provided, contact is created under that tenant only.

-- Remove all overloads (15-arg legacy + partial apply) so GRANT is unambiguous.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'register_public_contact_v2'
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS public.register_public_contact_v2(%s)', r.args);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.register_public_contact_v2(
  p_first_name VARCHAR(100),
  p_last_name VARCHAR(100),
  p_mobile VARCHAR(50),
  p_contact_type VARCHAR(20),
  p_email VARCHAR(255) DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_city VARCHAR(100) DEFAULT NULL,
  p_country VARCHAR(100) DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_lead_source VARCHAR(100) DEFAULT NULL,
  p_referral_code VARCHAR(100) DEFAULT NULL,
  p_device_info TEXT DEFAULT NULL,
  p_honeypot VARCHAR(255) DEFAULT NULL,
  p_captcha_answer INTEGER DEFAULT NULL,
  p_client_fingerprint VARCHAR(64) DEFAULT NULL,
  p_company_id UUID DEFAULT NULL,
  p_branch_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
  v_branch_id UUID;
  v_name VARCHAR(255);
  v_contact_id UUID;
  v_ip_hash VARCHAR(64);
  v_count INTEGER;
  v_captcha_expected INTEGER;
BEGIN
  IF p_honeypot IS NOT NULL AND p_honeypot != '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid submission');
  END IF;

  v_captcha_expected := 7;
  IF p_captcha_answer IS NULL OR p_captcha_answer != v_captcha_expected THEN
    RETURN jsonb_build_object('success', false, 'error', 'Please answer the security question correctly');
  END IF;

  v_ip_hash := coalesce(NULLIF(trim(p_client_fingerprint), ''), 'fallback');
  SELECT count(*) INTO v_count FROM public_contact_rate_limit
  WHERE ip_hash = v_ip_hash AND submitted_at > NOW() - INTERVAL '1 hour';
  IF v_count >= 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Too many submissions. Please try again later.');
  END IF;

  IF trim(coalesce(p_first_name, '')) = '' OR trim(coalesce(p_last_name, '')) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'First name and last name are required');
  END IF;
  IF trim(coalesce(p_mobile, '')) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mobile number is required');
  END IF;
  IF p_contact_type NOT IN ('customer', 'supplier', 'worker') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid contact type');
  END IF;

  IF p_company_id IS NOT NULL THEN
    SELECT id INTO v_company_id FROM companies WHERE id = p_company_id AND is_active = true;
    IF v_company_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid or inactive company for this registration link');
    END IF;
  ELSE
    SELECT company_id INTO v_company_id FROM public_registration_config WHERE is_active = true LIMIT 1;
    IF v_company_id IS NULL THEN
      SELECT id INTO v_company_id FROM companies WHERE is_active = true LIMIT 1;
    END IF;
    IF v_company_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Registration is not configured');
    END IF;
  END IF;

  IF p_branch_id IS NOT NULL THEN
    SELECT id INTO v_branch_id
    FROM branches
    WHERE id = p_branch_id AND company_id = v_company_id AND is_active = true;
    IF v_branch_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid or inactive branch for this registration link');
    END IF;
  ELSE
    SELECT id INTO v_branch_id FROM branches WHERE company_id = v_company_id AND is_active = true ORDER BY name LIMIT 1;
  END IF;

  IF EXISTS (SELECT 1 FROM contacts WHERE company_id = v_company_id AND mobile = trim(p_mobile)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'This mobile number is already registered');
  END IF;

  v_name := trim(p_first_name) || ' ' || trim(p_last_name);

  INSERT INTO contacts (
    company_id, branch_id, type, name, email, mobile, address, city, country, notes,
    lead_source, referral_code, created_from, lead_status, device_info, is_active
  ) VALUES (
    v_company_id, v_branch_id, p_contact_type::contact_type, v_name,
    NULLIF(trim(coalesce(p_email, '')), ''),
    trim(p_mobile),
    NULLIF(trim(coalesce(p_address, '')), ''),
    NULLIF(trim(coalesce(p_city, '')), ''),
    NULLIF(trim(coalesce(p_country, '')), ''),
    NULLIF(trim(coalesce(p_notes, '')), ''),
    NULLIF(trim(coalesce(p_lead_source, '')), ''),
    NULLIF(trim(coalesce(p_referral_code, '')), ''),
    'public_form',
    'New',
    NULLIF(trim(coalesce(p_device_info, '')), ''),
    true
  )
  RETURNING id INTO v_contact_id;

  INSERT INTO public_contact_rate_limit (ip_hash) VALUES (v_ip_hash);
  DELETE FROM public_contact_rate_limit WHERE submitted_at < NOW() - INTERVAL '24 hours';

  RETURN jsonb_build_object('success', true, 'contact_id', v_contact_id);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'This mobile number is already registered');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'Registration failed. Please try again.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_public_contact_v2(
  character varying,
  character varying,
  character varying,
  character varying,
  character varying,
  text,
  character varying,
  character varying,
  text,
  character varying,
  character varying,
  text,
  character varying,
  integer,
  character varying,
  uuid,
  uuid
) TO anon, authenticated;
