-- Stubs so record_payment_with_accounting can be installed & security-tested in isolation.
DO $$ BEGIN
  CREATE TYPE public.payment_type AS ENUM ('paid', 'received');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_method_enum AS ENUM (
    'cash', 'bank', 'card', 'cheque', 'online', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  branch_id uuid,
  payment_type public.payment_type,
  reference_type text,
  reference_id uuid,
  amount numeric(15,2) NOT NULL,
  payment_method public.payment_method_enum,
  payment_date date,
  payment_account_id uuid,
  reference_number text,
  notes text,
  created_by uuid,
  contact_id uuid,
  contact_name text,
  UNIQUE (company_id, reference_number)
);

ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS payment_id uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS document_no text;

CREATE TABLE IF NOT EXISTS public.worker_ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  worker_id uuid NOT NULL,
  reference_type text,
  reference_id text,
  status text DEFAULT 'unpaid'
);

CREATE OR REPLACE FUNCTION public._is_account_control_code(p_account_id uuid, p_code text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM accounts a
    WHERE a.id = p_account_id AND trim(COALESCE(a.code, '')) = trim(COALESCE(p_code, ''))
  );
$$;

CREATE OR REPLACE FUNCTION public.erp_numbering_global_branch_sentinel()
RETURNS uuid
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT '00000000-0000-0000-0000-000000000000'::uuid;
$$;

CREATE OR REPLACE FUNCTION public.generate_document_number(
  p_company_id uuid,
  p_branch_id uuid,
  p_doc_kind text,
  p_unused boolean
) RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN 'PAY-ISO-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
END;
$$;

CREATE OR REPLACE FUNCTION public._sync_payment_sequence_after_duplicate(p_company_id uuid, p_year int)
RETURNS void LANGUAGE plpgsql AS $$ BEGIN NULL; END; $$;

CREATE OR REPLACE FUNCTION public._sync_customer_receipt_sequence_after_duplicate(p_company_id uuid, p_year int)
RETURNS void LANGUAGE plpgsql AS $$ BEGIN NULL; END; $$;

CREATE TABLE IF NOT EXISTS public.erp_document_sequences (
  company_id uuid,
  branch_id uuid,
  document_type text,
  year int,
  last_number int DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- Empty stubs for sale/purchase branches (worker path does not need rows)
CREATE TABLE IF NOT EXISTS public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  branch_id uuid,
  customer_id uuid,
  total numeric DEFAULT 0,
  paid_amount numeric DEFAULT 0,
  due_amount numeric DEFAULT 0,
  payment_status text
);
CREATE TABLE IF NOT EXISTS public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  branch_id uuid,
  supplier_id uuid,
  total numeric DEFAULT 0,
  paid_amount numeric DEFAULT 0,
  due_amount numeric DEFAULT 0,
  payment_status text
);
CREATE TABLE IF NOT EXISTS public.rentals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  branch_id uuid,
  customer_id uuid,
  total numeric DEFAULT 0,
  paid_amount numeric DEFAULT 0,
  due_amount numeric DEFAULT 0
);
CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  branch_id uuid
);

DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM ('paid', 'partial', 'unpaid');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
