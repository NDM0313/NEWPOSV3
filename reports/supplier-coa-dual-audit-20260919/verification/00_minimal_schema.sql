-- Minimal schema for isolated JE guard tests (not production dump).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL
);

CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  code text,
  name text,
  is_active boolean DEFAULT true,
  linked_contact_id uuid
);

CREATE TABLE public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  entry_no text,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  description text,
  is_void boolean DEFAULT false,
  total_debit numeric(15,2) DEFAULT 0,
  total_credit numeric(15,2) DEFAULT 0
);

CREATE TABLE public.journal_entry_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id),
  debit numeric(15,2) DEFAULT 0,
  credit numeric(15,2) DEFAULT 0,
  description text
);

-- Stub of real-schema balance/report helper (accounting_validate_journal_balance_trigger.sql)
CREATE OR REPLACE FUNCTION public.check_journal_entries_balance()
RETURNS TABLE (
  journal_entry_id uuid,
  entry_no text,
  entry_date date,
  total_debit numeric(15,2),
  total_credit numeric(15,2),
  is_balanced boolean
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    je.id,
    je.entry_no,
    je.entry_date,
    COALESCE(SUM(jel.debit), 0)::numeric(15,2),
    COALESCE(SUM(jel.credit), 0)::numeric(15,2),
    (ABS(COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0)) < 0.01)
  FROM journal_entries je
  LEFT JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
  GROUP BY je.id, je.entry_no, je.entry_date;
$$;

-- Lightweight totals sync (mirrors real trg_journal_entry_lines_refresh_totals intent)
CREATE OR REPLACE FUNCTION public.trg_journal_entry_lines_refresh_totals()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE journal_entries je
  SET total_debit = COALESCE((SELECT SUM(debit) FROM journal_entry_lines WHERE journal_entry_id = je.id), 0),
      total_credit = COALESCE((SELECT SUM(credit) FROM journal_entry_lines WHERE journal_entry_id = je.id), 0)
  WHERE je.id = COALESCE(NEW.journal_entry_id, OLD.journal_entry_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_journal_entry_lines_refresh_totals
AFTER INSERT OR UPDATE OR DELETE ON public.journal_entry_lines
FOR EACH ROW EXECUTE FUNCTION public.trg_journal_entry_lines_refresh_totals();

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
