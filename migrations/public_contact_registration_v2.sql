-- ============================================================================
-- PUBLIC CONTACT REGISTRATION & LEAD CAPTURE SYSTEM v2
-- ============================================================================
-- Run in Supabase SQL Editor
-- Adds: lead fields, rate limiting, RPC for public form
-- ============================================================================

-- 1. Add lead/registration columns to contacts (if not exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'lead_source') THEN
    ALTER TABLE public.contacts ADD COLUMN lead_source VARCHAR(100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'referral_code') THEN
    ALTER TABLE public.contacts ADD COLUMN referral_code VARCHAR(100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'created_from') THEN
    ALTER TABLE public.contacts ADD COLUMN created_from VARCHAR(50);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'lead_status') THEN
    ALTER TABLE public.contacts ADD COLUMN lead_status VARCHAR(50) DEFAULT 'New';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'assigned_to') THEN
    ALTER TABLE public.contacts ADD COLUMN assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'device_info') THEN
    ALTER TABLE public.contacts ADD COLUMN device_info TEXT;
  END IF;
END $$;

-- 2. Add worker to contact_type enum if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'contact_type' AND e.enumlabel = 'worker'
  ) THEN
    ALTER TYPE contact_type ADD VALUE IF NOT EXISTS 'worker';
  END IF;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- 3. Unique constraint: (company_id, mobile) - one contact per mobile per company
-- Allow multiple NULL mobiles
DROP INDEX IF EXISTS idx_contacts_company_mobile_unique;
CREATE UNIQUE INDEX idx_contacts_company_mobile_unique ON public.contacts (company_id, mobile) WHERE mobile IS NOT NULL AND mobile != '';

-- 4. Rate limit table: track submissions by IP
CREATE TABLE IF NOT EXISTS public.public_contact_rate_limit (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ip_hash VARCHAR(64) NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rate_limit_ip_hash ON public.public_contact_rate_limit(ip_hash);
CREATE INDEX IF NOT EXISTS idx_rate_limit_submitted ON public.public_contact_rate_limit(submitted_at);

-- 5. Public form config: which company receives public registrations
CREATE TABLE IF NOT EXISTS public.public_registration_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Insert default: use first company (run once, ignore if rows exist)
INSERT INTO public.public_registration_config (company_id, is_active)
SELECT id, true FROM companies WHERE is_active = true LIMIT 1
WHERE NOT EXISTS (SELECT 1 FROM public_registration_config LIMIT 1);

-- 6. RPC: register_public_contact_v2
CREATE OR REPLACE FUNCTION public.register_public_contact_v2(
  p_first_name VARCHAR(100),
  p_last_name VARCHAR(100),
  p_mobile VARCHAR(50),
  p_email VARCHAR(255) DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_city VARCHAR(100) DEFAULT NULL,
  p_country VARCHAR(100) DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_contact_type VARCHAR(20),
  p_lead_source VARCHAR(100) DEFAULT NULL,
  p_referral_code VARCHAR(100) DEFAULT NULL,
  p_device_info TEXT DEFAULT NULL,
  p_honeypot VARCHAR(255) DEFAULT NULL,
  p_captcha_answer INTEGER DEFAULT NULL,
  p_client_fingerprint VARCHAR(64) DEFAULT NULL
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
  -- Spam: reject if honeypot filled
  IF p_honeypot IS NOT NULL AND p_honeypot != '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid submission');
  END IF;

  -- Simple captcha: expect 7 (e.g. 3+4)
  v_captcha_expected := 7;
  IF p_captcha_answer IS NULL OR p_captcha_answer != v_captcha_expected THEN
    RETURN jsonb_build_object('success', false, 'error', 'Please answer the security question correctly');
  END IF;

  -- Rate limit: 5 per fingerprint per hour (client sends hashed fingerprint)
  v_ip_hash := coalesce(NULLIF(trim(p_client_fingerprint), ''), 'fallback');
  SELECT count(*) INTO v_count FROM public_contact_rate_limit
  WHERE ip_hash = v_ip_hash AND submitted_at > NOW() - INTERVAL '1 hour';
  IF v_count >= 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Too many submissions. Please try again later.');
  END IF;

  -- Validate required
  IF trim(coalesce(p_first_name, '')) = '' OR trim(coalesce(p_last_name, '')) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'First name and last name are required');
  END IF;
  IF trim(coalesce(p_mobile, '')) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Mobile number is required');
  END IF;
  IF p_contact_type NOT IN ('customer', 'supplier', 'worker') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid contact type');
  END IF;

  -- Get company and branch
  SELECT company_id INTO v_company_id FROM public_registration_config WHERE is_active = true LIMIT 1;
  IF v_company_id IS NULL THEN
    SELECT id INTO v_company_id FROM companies WHERE is_active = true LIMIT 1;
  END IF;
  IF v_company_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Registration is not configured');
  END IF;

  SELECT id INTO v_branch_id FROM branches WHERE company_id = v_company_id AND is_active = true ORDER BY name LIMIT 1;

  -- Check duplicate mobile
  IF EXISTS (SELECT 1 FROM contacts WHERE company_id = v_company_id AND mobile = trim(p_mobile)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'This mobile number is already registered');
  END IF;

  v_name := trim(p_first_name) || ' ' || trim(p_last_name);

  -- Insert contact
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

  -- Record rate limit
  INSERT INTO public_contact_rate_limit (ip_hash) VALUES (v_ip_hash);

  -- Clean old rate limit rows (older than 24h)
  DELETE FROM public_contact_rate_limit WHERE submitted_at < NOW() - INTERVAL '24 hours';

  RETURN jsonb_build_object('success', true, 'contact_id', v_contact_id);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'This mobile number is already registered');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'Registration failed. Please try again.');
END;
$$;

-- Grant execute to anon (public form uses anon key)
GRANT EXECUTE ON FUNCTION public.register_public_contact_v2 TO anon;
GRANT EXECUTE ON FUNCTION public.register_public_contact_v2 TO authenticated;

-- RLS: rate limit table - only RPC can write
ALTER TABLE public.public_contact_rate_limit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "RPC only" ON public.public_contact_rate_limit;
CREATE POLICY "Service role only" ON public.public_contact_rate_limit FOR ALL USING (false);
