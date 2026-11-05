-- Minimal schema for worker/courier role-model isolated Postgres (not production).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE public.account_type AS ENUM (
    'asset', 'liability', 'equity', 'revenue', 'expense', 'payable', 'receivable'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  currency text DEFAULT 'PKR'
);

CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  name text NOT NULL,
  type text NOT NULL,
  code text
);

CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  code text,
  name text,
  type public.account_type,
  parent_id uuid REFERENCES public.accounts(id),
  balance numeric DEFAULT 0,
  is_active boolean DEFAULT true,
  linked_contact_id uuid,
  contact_id uuid,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (company_id, code)
);

CREATE TABLE public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  branch_id uuid,
  entry_no text,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  description text,
  reference_type text,
  reference_id uuid,
  is_void boolean DEFAULT false
);

CREATE TABLE public.journal_entry_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id),
  debit numeric(15,2) DEFAULT 0,
  credit numeric(15,2) DEFAULT 0,
  description text
);

CREATE OR REPLACE FUNCTION public._party_slug_from_contact(p_contact_code text, p_contact_id uuid)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_contact_code IS NOT NULL AND length(trim(p_contact_code)) > 0 THEN
    RETURN upper(replace(p_contact_code, '-', ''));
  END IF;
  RETURN upper(substr(replace(p_contact_id::text, '-', ''), 1, 6));
END;
$$;

-- Stub party resolution used by get_contact_party_gl_balances
CREATE OR REPLACE FUNCTION public._gl_resolve_party_id_for_journal_entry(
  p_company_id uuid,
  p_journal_or_ref uuid
) RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (SELECT je.reference_id
     FROM journal_entries je
     WHERE je.id = p_journal_or_ref AND je.company_id = p_company_id
       AND je.reference_type IN ('worker_payment', 'worker_advance_settlement', 'deposit')
     LIMIT 1),
    p_journal_or_ref
  );
$$;

CREATE OR REPLACE FUNCTION public._ensure_ap_subaccount_for_contact(
  p_company_id uuid,
  p_contact_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_control uuid;
  v_child uuid;
  v_contact record;
  v_code text;
BEGIN
  SELECT id INTO v_control FROM accounts
  WHERE company_id = p_company_id AND trim(code) = '2000' AND coalesce(is_active, true) LIMIT 1;
  IF v_control IS NULL THEN RETURN NULL; END IF;
  IF p_contact_id IS NULL THEN RETURN v_control; END IF;
  SELECT id INTO v_child FROM accounts
  WHERE company_id = p_company_id AND parent_id = v_control AND linked_contact_id = p_contact_id
    AND coalesce(is_active, true) LIMIT 1;
  IF v_child IS NOT NULL THEN RETURN v_child; END IF;
  SELECT * INTO v_contact FROM contacts WHERE id = p_contact_id;
  IF v_contact.id IS NULL OR v_contact.company_id IS DISTINCT FROM p_company_id THEN
    RAISE EXCEPTION 'AP_WRONG_COMPANY' USING ERRCODE = 'check_violation';
  END IF;
  IF lower(trim(v_contact.type)) NOT IN ('supplier', 'both', 'money_exchange') THEN
    RETURN v_control;
  END IF;
  v_code := 'AP-' || public._party_slug_from_contact(v_contact.code, p_contact_id);
  INSERT INTO accounts (company_id, code, name, type, parent_id, linked_contact_id, is_active)
  VALUES (p_company_id, v_code, 'Payable — ' || v_contact.name, 'liability', v_control, p_contact_id, true)
  ON CONFLICT (company_id, code) DO UPDATE SET linked_contact_id = EXCLUDED.linked_contact_id
  RETURNING id INTO v_child;
  RETURN v_child;
END;
$$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), current_user::text)
$$;

CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.test_user_company_id', true), '')::uuid;
$$;

DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT USAGE ON SCHEMA public TO authenticated, service_role, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;
