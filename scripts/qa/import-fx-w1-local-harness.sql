-- Minimal non-production harness for Import FX W1 live QA on empty local Postgres.
-- NOT for production. Creates only stubs required by Path 21 / Wave A / Wave 0 / W1.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE ROLE authenticated NOINHERIT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE ROLE service_role NOINHERIT BYPASSRLS;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE ROLE anon NOINHERIT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.contact_type AS ENUM ('customer', 'supplier', 'worker', 'both', 'money_exchange');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.account_type AS ENUM (
    'asset', 'liability', 'equity', 'revenue', 'expense', 'cash', 'bank', 'wallet'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  currency text NOT NULL DEFAULT 'PKR',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  type public.contact_type NOT NULL DEFAULT 'supplier',
  is_active boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text,
  name text NOT NULL,
  type public.account_type NOT NULL DEFAULT 'asset',
  parent_id uuid NULL REFERENCES public.accounts(id) ON DELETE SET NULL,
  linked_contact_id uuid NULL REFERENCES public.contacts(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  key text NOT NULL,
  value jsonb,
  UNIQUE (company_id, key)
);

CREATE TABLE IF NOT EXISTS public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id uuid NULL REFERENCES public.branches(id) ON DELETE SET NULL,
  supplier_id uuid NULL REFERENCES public.contacts(id) ON DELETE SET NULL,
  total numeric(24,2) DEFAULT 0,
  paid_amount numeric(24,2) DEFAULT 0,
  due_amount numeric(24,2) DEFAULT 0,
  status text DEFAULT 'draft',
  document_currency text,
  fx_rate_to_base numeric,
  foreign_subtotal numeric,
  foreign_total numeric
);

CREATE TABLE IF NOT EXISTS public.purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  product_name text,
  quantity numeric DEFAULT 1,
  unit_price numeric DEFAULT 0,
  total numeric DEFAULT 0,
  foreign_unit_price numeric,
  foreign_line_total numeric
);

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  amount numeric(24,2) DEFAULT 0,
  voided_at timestamptz NULL,
  foreign_amount numeric,
  fx_rate numeric,
  document_currency text
);

CREATE TABLE IF NOT EXISTS public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  entry_no text,
  reference_type text,
  reference_id uuid,
  is_void boolean DEFAULT false,
  voided_at timestamptz NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.journal_entry_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_id uuid NULL REFERENCES public.accounts(id) ON DELETE SET NULL,
  debit numeric(24,2) DEFAULT 0,
  credit numeric(24,2) DEFAULT 0
);

CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.company_id', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION public._party_slug_from_contact(p_code text, p_id uuid)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(NULLIF(regexp_replace(upper(trim(COALESCE(p_code, ''))), '[^A-Z0-9]', '', 'g'), ''), substr(replace(p_id::text, '-', ''), 1, 8));
$$;

CREATE OR REPLACE FUNCTION public.generate_document_number(
  p_company_id uuid,
  p_branch_id uuid DEFAULT NULL,
  p_document_type text DEFAULT 'payment',
  p_include_year boolean DEFAULT false
)
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN upper(trim(COALESCE(p_document_type, 'DOC'))) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
END;
$$;
